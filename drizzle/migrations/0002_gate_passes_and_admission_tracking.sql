-- Who admitted each ticket
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS admitted_by_user uuid;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS admitted_by_name text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS admitted_via text;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS gate_pass_id uuid;

-- Gate passes: an email + secret code the host hands to door staff (no account needed)
CREATE TABLE public.gate_passes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label text NOT NULL,
  email text NOT NULL,
  secret_code text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);
CREATE INDEX gate_passes_email_idx ON public.gate_passes (lower(email));
GRANT SELECT, UPDATE, DELETE ON public.gate_passes TO authenticated;
GRANT ALL ON public.gate_passes TO service_role;
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosts read gate passes" ON public.gate_passes FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hosts update gate passes" ON public.gate_passes FOR UPDATE TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "hosts delete gate passes" ON public.gate_passes FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Signed-in gate sessions (only reachable through the functions below)
CREATE TABLE public.gate_sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_id uuid NOT NULL REFERENCES public.gate_passes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '18 hours')
);
GRANT ALL ON public.gate_sessions TO service_role;
ALTER TABLE public.gate_sessions ENABLE ROW LEVEL SECURITY;

-- Every scan at the gate
CREATE TABLE public.admission_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  code text NOT NULL,
  ticket_type text,
  attendee_name text,
  result text NOT NULL CHECK (result IN ('admitted','undone','already','invalid','locked')),
  actor_user uuid,
  actor_name text,
  via text,
  gate_pass_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admission_log_event_idx ON public.admission_log (event_id, created_at DESC);
GRANT SELECT ON public.admission_log TO authenticated;
GRANT ALL ON public.admission_log TO service_role;
ALTER TABLE public.admission_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event team reads admission log" ON public.admission_log FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin') OR public.is_event_staff(event_id, auth.uid()));

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.admission_log;
EXCEPTION WHEN others THEN NULL; END $$;

-- Core admission logic shared by staff accounts and gate passes
CREATE OR REPLACE FUNCTION public._do_admit(_event_id uuid, _code text, _undo boolean, _actor_user uuid, _actor_name text, _via text, _pass_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c text := upper(trim(regexp_replace(coalesce(_code, ''), '^\s*USIKOSE:', '', 'i')));
  t record;
  total int;
  admitted int;
BEGIN
  SELECT tk.id, tk.code, tk.checked_in_at, tk.attendee_name, tk.admitted_by_name, tt.name AS type_name
    INTO t
    FROM public.tickets tk LEFT JOIN public.ticket_types tt ON tt.id = tk.ticket_type_id
   WHERE tk.event_id = _event_id AND tk.code = c;

  IF NOT FOUND THEN
    INSERT INTO public.admission_log (event_id, code, result, actor_user, actor_name, via, gate_pass_id)
    VALUES (_event_id, left(c, 64), 'invalid', _actor_user, _actor_name, _via, _pass_id);
    RETURN jsonb_build_object('result', 'invalid', 'code', c);
  END IF;

  IF _undo THEN
    UPDATE public.tickets SET checked_in_at = NULL, admitted_by_user = NULL, admitted_by_name = NULL,
           admitted_via = NULL, gate_pass_id = NULL WHERE id = t.id;
    INSERT INTO public.admission_log (event_id, ticket_id, code, ticket_type, attendee_name, result, actor_user, actor_name, via, gate_pass_id)
    VALUES (_event_id, t.id, t.code, t.type_name, t.attendee_name, 'undone', _actor_user, _actor_name, _via, _pass_id);
    RETURN jsonb_build_object('result', 'undone', 'code', t.code, 'type', t.type_name, 'name', t.attendee_name);
  END IF;

  IF t.checked_in_at IS NOT NULL THEN
    INSERT INTO public.admission_log (event_id, ticket_id, code, ticket_type, attendee_name, result, actor_user, actor_name, via, gate_pass_id)
    VALUES (_event_id, t.id, t.code, t.type_name, t.attendee_name, 'already', _actor_user, _actor_name, _via, _pass_id);
    RETURN jsonb_build_object('result', 'already', 'code', t.code, 'type', t.type_name, 'name', t.attendee_name,
                              'at', t.checked_in_at, 'by', t.admitted_by_name);
  END IF;

  IF EXISTS (SELECT 1 FROM public.resale_listings WHERE ticket_id = t.id AND status IN ('active','reserved')) THEN
    INSERT INTO public.admission_log (event_id, ticket_id, code, ticket_type, attendee_name, result, actor_user, actor_name, via, gate_pass_id)
    VALUES (_event_id, t.id, t.code, t.type_name, t.attendee_name, 'locked', _actor_user, _actor_name, _via, _pass_id);
    RETURN jsonb_build_object('result', 'locked', 'code', t.code, 'type', t.type_name, 'name', t.attendee_name);
  END IF;

  UPDATE public.tickets SET checked_in_at = now(), admitted_by_user = _actor_user, admitted_by_name = _actor_name,
         admitted_via = _via, gate_pass_id = _pass_id WHERE id = t.id;
  IF _pass_id IS NOT NULL THEN
    UPDATE public.gate_passes SET last_used_at = now() WHERE id = _pass_id;
  END IF;
  INSERT INTO public.admission_log (event_id, ticket_id, code, ticket_type, attendee_name, result, actor_user, actor_name, via, gate_pass_id)
  VALUES (_event_id, t.id, t.code, t.type_name, t.attendee_name, 'admitted', _actor_user, _actor_name, _via, _pass_id);

  SELECT count(*), count(checked_in_at) INTO total, admitted FROM public.tickets WHERE event_id = _event_id;
  RETURN jsonb_build_object('result', 'admitted', 'code', t.code, 'type', t.type_name, 'name', t.attendee_name,
                            'admitted', admitted, 'total', total);
END $$;

-- Signed-in organizer, admin or admission staff
CREATE OR REPLACE FUNCTION public.admit_ticket(_event_id uuid, _code text, _undo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  via text;
  nm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  IF public.is_event_owner(_event_id, uid) THEN via := 'organizer';
  ELSIF public.has_role(uid, 'admin') THEN via := 'admin';
  ELSIF public.is_event_staff(_event_id, uid) THEN via := 'staff';
  ELSE RAISE EXCEPTION 'You are not on the admission team for this event';
  END IF;
  SELECT coalesce(nullif(trim(p.full_name), ''), u.email) INTO nm
    FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id WHERE u.id = uid;
  RETURN public._do_admit(_event_id, _code, _undo, uid, coalesce(nm, 'Staff'), via, NULL);
END $$;

-- Host creates or resets a gate pass; returns the secret code
CREATE OR REPLACE FUNCTION public.create_gate_pass(_event_id uuid, _label text, _email text, _code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
  e text := lower(trim(coalesce(_email, '')));
  r public.gate_passes;
BEGIN
  IF NOT (public.is_event_owner(_event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the event host can create gate passes';
  END IF;
  IF e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;
  IF length(trim(coalesce(_label, ''))) < 2 THEN RAISE EXCEPTION 'Give this pass a name, e.g. Gate A'; END IF;
  IF c = '' THEN
    SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      INTO c FROM generate_series(1, 8);
  END IF;
  IF length(c) < 6 OR length(c) > 32 THEN RAISE EXCEPTION 'The secret code must be 6 to 32 characters'; END IF;
  INSERT INTO public.gate_passes (event_id, label, email, secret_code, created_by)
  VALUES (_event_id, left(trim(_label), 60), e, c, auth.uid())
  ON CONFLICT (event_id, email) DO UPDATE
    SET label = EXCLUDED.label, secret_code = EXCLUDED.secret_code, is_active = true,
        failed_attempts = 0, locked_until = NULL
  RETURNING * INTO r;
  DELETE FROM public.gate_sessions WHERE pass_id = r.id;
  RETURN jsonb_build_object('id', r.id, 'email', r.email, 'label', r.label, 'code', r.secret_code);
END $$;

-- Anyone with an email + secret code opens the gate scanner
CREATE OR REPLACE FUNCTION public.gate_login(_email text, _code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e text := lower(trim(coalesce(_email, '')));
  c text := upper(regexp_replace(coalesce(_code, ''), '\s', '', 'g'));
  p record;
  tok uuid;
BEGIN
  IF e = '' OR c = '' THEN RETURN jsonb_build_object('ok', false, 'error', 'Enter the email and secret code from the host'); END IF;
  IF EXISTS (SELECT 1 FROM public.gate_passes WHERE lower(email) = e AND locked_until > now()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many wrong codes. Try again in 15 minutes.');
  END IF;
  SELECT gp.id, gp.label, gp.email, ev.id AS event_id, ev.title, ev.starts_at, ev.venue, ev.city
    INTO p
    FROM public.gate_passes gp JOIN public.events ev ON ev.id = gp.event_id
   WHERE lower(gp.email) = e AND gp.secret_code = c AND gp.is_active
   ORDER BY abs(extract(epoch FROM ev.starts_at - now()))
   LIMIT 1;
  IF NOT FOUND THEN
    UPDATE public.gate_passes
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 8 THEN now() + interval '15 minutes' ELSE locked_until END
     WHERE lower(email) = e;
    UPDATE public.gate_passes SET failed_attempts = 0 WHERE lower(email) = e AND locked_until > now();
    RETURN jsonb_build_object('ok', false, 'error', 'That email and secret code don''t match an active gate pass');
  END IF;
  UPDATE public.gate_passes SET failed_attempts = 0, locked_until = NULL WHERE id = p.id;
  DELETE FROM public.gate_sessions WHERE expires_at < now();
  INSERT INTO public.gate_sessions (pass_id) VALUES (p.id) RETURNING token INTO tok;
  RETURN jsonb_build_object('ok', true, 'token', tok, 'event_id', p.event_id, 'event_title', p.title,
                            'starts_at', p.starts_at, 'venue', p.venue, 'city', p.city, 'label', p.label, 'email', p.email);
END $$;

CREATE OR REPLACE FUNCTION public.gate_session_info(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
  total int;
  admitted int;
  mine int;
BEGIN
  SELECT gp.id, gp.label, gp.email, ev.id AS event_id, ev.title, ev.starts_at, ev.venue, ev.city
    INTO p
    FROM public.gate_sessions s
    JOIN public.gate_passes gp ON gp.id = s.pass_id AND gp.is_active
    JOIN public.events ev ON ev.id = gp.event_id
   WHERE s.token = _token AND s.expires_at > now();
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT count(*), count(checked_in_at), count(*) FILTER (WHERE gate_pass_id = p.id AND checked_in_at IS NOT NULL)
    INTO total, admitted, mine FROM public.tickets WHERE event_id = p.event_id;
  RETURN jsonb_build_object('ok', true, 'event_id', p.event_id, 'event_title', p.title, 'starts_at', p.starts_at,
                            'venue', p.venue, 'city', p.city, 'label', p.label, 'email', p.email,
                            'total', total, 'admitted', admitted, 'mine', mine);
END $$;

CREATE OR REPLACE FUNCTION public.gate_admit(_token uuid, _code text, _undo boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
BEGIN
  SELECT gp.id, gp.label, gp.email, gp.event_id
    INTO p
    FROM public.gate_sessions s JOIN public.gate_passes gp ON gp.id = s.pass_id AND gp.is_active
   WHERE s.token = _token AND s.expires_at > now();
  IF NOT FOUND THEN RETURN jsonb_build_object('result', 'expired'); END IF;
  RETURN public._do_admit(p.event_id, _code, _undo, NULL, p.label || ' · ' || p.email, 'gate_pass', p.id);
END $$;

CREATE OR REPLACE FUNCTION public.gate_logout(_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.gate_sessions WHERE token = _token;
$$;

-- Host adds an admission-staff account by email (works on any host, no server keys needed)
CREATE OR REPLACE FUNCTION public.add_event_staff(_event_id uuid, _email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e text := lower(trim(coalesce(_email, '')));
  u uuid;
  sid uuid;
BEGIN
  IF NOT (public.is_event_owner(_event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Only the event organizer can manage staff';
  END IF;
  SELECT id INTO u FROM auth.users WHERE lower(email) = e LIMIT 1;
  IF u IS NULL THEN
    RAISE EXCEPTION 'No Usikose360 account uses that email. Ask them to sign up first, or create a gate pass instead.';
  END IF;
  INSERT INTO public.event_staff (event_id, user_id, email, role, added_by)
  VALUES (_event_id, u, e, 'admission', auth.uid())
  ON CONFLICT (event_id, user_id) DO UPDATE SET email = EXCLUDED.email
  RETURNING id INTO sid;
  RETURN sid;
END $$;

REVOKE ALL ON FUNCTION public._do_admit(uuid, text, boolean, uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admit_ticket(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_gate_pass(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_event_staff(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gate_login(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_session_info(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_admit(uuid, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gate_logout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._do_admit(uuid, text, boolean, uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admit_ticket(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_gate_pass(uuid, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_event_staff(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gate_login(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gate_session_info(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gate_admit(uuid, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gate_logout(uuid) TO anon, authenticated, service_role;
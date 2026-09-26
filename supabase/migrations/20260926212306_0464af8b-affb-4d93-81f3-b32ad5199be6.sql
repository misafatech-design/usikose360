CREATE TABLE public.mpesa_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL UNIQUE CHECK (environment IN ('sandbox','production')),
  is_active boolean NOT NULL DEFAULT false,
  shortcode text,
  party_b text,
  passkey text,
  consumer_key text,
  consumer_secret text,
  transaction_type text NOT NULL DEFAULT 'CustomerPayBillOnline',
  callback_base_url text,
  b2c_shortcode text,
  b2c_initiator_name text,
  b2c_security_credential text,
  b2c_consumer_key text,
  b2c_consumer_secret text,
  b2c_command_id text NOT NULL DEFAULT 'BusinessPayment',
  callback_token text NOT NULL DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.mpesa_config TO service_role;
ALTER TABLE public.mpesa_config ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mpesa_config_touch BEFORE UPDATE ON public.mpesa_config FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN checkout_request_id text UNIQUE,
  ADD COLUMN merchant_request_id text,
  ADD COLUMN result_code integer,
  ADD COLUMN result_desc text,
  ADD COLUMN mpesa_receipt text,
  ADD COLUMN environment text,
  ADD COLUMN paid_at timestamptz;

CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL,
  amount_kes numeric NOT NULL CHECK (amount_kes > 0),
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  environment text,
  conversation_id text,
  originator_conversation_id text UNIQUE,
  result_code integer,
  result_desc text,
  mpesa_receipt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizers read own payouts" ON public.payouts FOR SELECT TO authenticated
  USING (auth.uid() = organizer_id OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER payouts_touch BEFORE UPDATE ON public.payouts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.event_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'admission',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, DELETE ON public.event_staff TO authenticated;
GRANT ALL ON public.event_staff TO service_role;
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_event_staff(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.event_staff WHERE event_id = _event_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_event_owner(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND organizer_id = _user_id)
$$;

CREATE POLICY "staff visible to self and owners" ON public.event_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owners remove staff" ON public.event_staff FOR DELETE TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(),'admin'));

-- Staff can see events they admit for
DROP POLICY "published events public" ON public.events;
CREATE POLICY "published events public" ON public.events FOR SELECT
  USING (status = 'published' OR auth.uid() = organizer_id OR public.has_role(auth.uid(),'admin') OR public.is_event_staff(id, auth.uid()));

DROP POLICY "holders read tickets" ON public.tickets;
CREATE POLICY "holders read tickets" ON public.tickets FOR SELECT TO authenticated
  USING (auth.uid() = holder_id OR public.has_role(auth.uid(),'admin') OR public.is_event_owner(event_id, auth.uid()) OR public.is_event_staff(event_id, auth.uid()));
DROP POLICY "organizers check in tickets" ON public.tickets;
CREATE POLICY "organizers check in tickets" ON public.tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_event_owner(event_id, auth.uid()) OR public.is_event_staff(event_id, auth.uid()));

-- Payments are now created server-side only
DROP POLICY "buyers create orders" ON public.orders;
DROP POLICY "buyers update own orders" ON public.orders;
DROP POLICY "holders create tickets" ON public.tickets;

-- Never allow self-assigned admin at signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN NEW.raw_user_meta_data->>'role' = 'organizer' THEN 'organizer'::public.app_role ELSE 'attendee'::public.app_role END)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.payouts;
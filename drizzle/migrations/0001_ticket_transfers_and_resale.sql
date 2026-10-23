-- Event-level controls for transfers and fan resale
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS transfers_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS resale_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS resale_max_markup_pct integer;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS transfer_count integer NOT NULL DEFAULT 0;

-- Transfer history
CREATE TABLE public.ticket_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  from_user uuid,
  to_user uuid,
  to_email text,
  to_name text,
  kind text NOT NULL DEFAULT 'gift',
  trade_id uuid,
  note text,
  old_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ticket_transfers_ticket_idx ON public.ticket_transfers(ticket_id);
GRANT SELECT ON public.ticket_transfers TO authenticated;
GRANT ALL ON public.ticket_transfers TO service_role;
ALTER TABLE public.ticket_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transfer parties read" ON public.ticket_transfers FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_event_owner(event_id, auth.uid()));

-- Resale listings
CREATE TABLE public.resale_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ticket_type_id uuid NOT NULL REFERENCES public.ticket_types(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  seller_name text,
  price_kes numeric(12,2) NOT NULL CHECK (price_kes > 0),
  face_value_kes numeric(12,2) NOT NULL DEFAULT 0,
  payout_phone text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','reserved','sold','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz
);
CREATE UNIQUE INDEX resale_listings_one_open_per_ticket ON public.resale_listings(ticket_id) WHERE status IN ('active','reserved');
CREATE INDEX resale_listings_event_idx ON public.resale_listings(event_id, status);
-- payout_phone is deliberately not readable through the public API
GRANT SELECT (id, ticket_id, event_id, ticket_type_id, seller_id, seller_name, price_kes, face_value_kes, note, status, created_at, updated_at, sold_at)
  ON public.resale_listings TO anon, authenticated;
GRANT ALL ON public.resale_listings TO service_role;
ALTER TABLE public.resale_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open listings public" ON public.resale_listings FOR SELECT TO anon, authenticated
  USING (status IN ('active','reserved') OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.is_event_owner(event_id, auth.uid()));
CREATE TRIGGER resale_listings_touch BEFORE UPDATE ON public.resale_listings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- P2P trades (buyer pays seller directly, seller releases)
CREATE TABLE public.resale_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.resale_listings(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  buyer_id uuid NOT NULL,
  price_kes numeric(12,2) NOT NULL,
  seller_phone text NOT NULL,
  seller_name text,
  buyer_phone text,
  buyer_name text,
  payment_ref text,
  status text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','paid','released','cancelled','disputed','expired')),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  released_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  dispute_reason text,
  disputed_by uuid,
  resolved_by uuid,
  resolution text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resale_trades_buyer_idx ON public.resale_trades(buyer_id);
CREATE INDEX resale_trades_seller_idx ON public.resale_trades(seller_id);
GRANT SELECT ON public.resale_trades TO authenticated;
GRANT ALL ON public.resale_trades TO service_role;
ALTER TABLE public.resale_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade parties read" ON public.resale_trades FOR SELECT TO authenticated
  USING (buyer_id = auth.uid() OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER resale_trades_touch BEFORE UPDATE ON public.resale_trades FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.is_trade_party(_trade_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.resale_trades t WHERE t.id = _trade_id AND (t.buyer_id = _user_id OR t.seller_id = _user_id))
$$;

-- Trade chat
CREATE TABLE public.resale_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.resale_trades(id) ON DELETE CASCADE,
  sender_id uuid,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX resale_messages_trade_idx ON public.resale_messages(trade_id, created_at);
GRANT SELECT, INSERT ON public.resale_messages TO authenticated;
GRANT ALL ON public.resale_messages TO service_role;
ALTER TABLE public.resale_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade parties read messages" ON public.resale_messages FOR SELECT TO authenticated
  USING (public.is_trade_party(trade_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "trade parties send messages" ON public.resale_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND is_system = false AND (public.is_trade_party(trade_id, auth.uid()) OR public.has_role(auth.uid(), 'admin')));

-- ---------- internal helpers ----------
CREATE OR REPLACE FUNCTION public._resale_sys_msg(_trade_id uuid, _body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.resale_messages (trade_id, sender_id, body, is_system) VALUES (_trade_id, NULL, _body, true);
$$;

CREATE OR REPLACE FUNCTION public.expire_resale_trades()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT id, listing_id FROM public.resale_trades WHERE status = 'awaiting_payment' AND expires_at < now() FOR UPDATE LOOP
    UPDATE public.resale_trades SET status = 'expired', cancelled_at = now(), cancel_reason = 'Payment window expired' WHERE id = r.id;
    UPDATE public.resale_listings SET status = 'active' WHERE id = r.listing_id AND status = 'reserved';
    PERFORM public._resale_sys_msg(r.id, 'Payment window expired. The ticket is back on the market.');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public._move_ticket(_ticket_id uuid, _from uuid, _to uuid, _to_email text, _to_name text, _to_phone text, _kind text, _trade_id uuid, _note text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; new_code text;
BEGIN
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF t IS NULL THEN RAISE EXCEPTION 'Ticket not found'; END IF;
  IF t.checked_in_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket has already been used at the gate'; END IF;
  new_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  UPDATE public.tickets SET
    holder_id = _to,
    attendee_name = COALESCE(NULLIF(trim(_to_name), ''), attendee_name),
    attendee_email = COALESCE(NULLIF(lower(trim(_to_email)), ''), attendee_email),
    attendee_phone = COALESCE(NULLIF(trim(_to_phone), ''), attendee_phone),
    code = new_code,
    transfer_count = transfer_count + 1
  WHERE id = _ticket_id;
  INSERT INTO public.ticket_transfers (ticket_id, event_id, from_user, to_user, to_email, to_name, kind, trade_id, note, old_code)
  VALUES (_ticket_id, t.event_id, _from, _to, lower(trim(_to_email)), _to_name, _kind, _trade_id, _note, t.code);
  RETURN new_code;
END $$;

CREATE OR REPLACE FUNCTION public._assert_event_open(_event_id uuid)
RETURNS public.events LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e public.events;
BEGIN
  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF e IS NULL THEN RAISE EXCEPTION 'Event not found'; END IF;
  IF e.status IN ('cancelled','completed') OR COALESCE(e.ends_at, e.starts_at + interval '12 hours') < now() THEN
    RAISE EXCEPTION 'This event has ended';
  END IF;
  RETURN e;
END $$;

-- ---------- P2P gift transfer ----------
CREATE OR REPLACE FUNCTION public.gift_ticket(_ticket_id uuid, _to_email text, _to_name text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t record; e public.events; recipient uuid; code text; my_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  IF _to_email IS NULL OR _to_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Enter a valid email address'; END IF;
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id;
  IF t IS NULL OR t.holder_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'You can only transfer tickets you hold'; END IF;
  e := public._assert_event_open(t.event_id);
  IF NOT e.transfers_enabled THEN RAISE EXCEPTION 'The organizer has turned off transfers for this event'; END IF;
  IF EXISTS (SELECT 1 FROM public.resale_listings WHERE ticket_id = _ticket_id AND status IN ('active','reserved')) THEN
    RAISE EXCEPTION 'Cancel the resale listing before transferring this ticket';
  END IF;
  SELECT email INTO my_email FROM auth.users WHERE id = uid;
  IF lower(trim(_to_email)) = lower(my_email) THEN RAISE EXCEPTION 'You already hold this ticket'; END IF;
  SELECT id INTO recipient FROM auth.users WHERE lower(email) = lower(trim(_to_email)) LIMIT 1;
  code := public._move_ticket(_ticket_id, uid, recipient, _to_email, _to_name, NULL, 'gift', NULL, _note);
  RETURN jsonb_build_object('code', code, 'to_user', recipient, 'event_id', t.event_id);
END $$;

-- Claim tickets sent to my email before I had an account
CREATE OR REPLACE FUNCTION public.claim_my_tickets()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); my_email text; n integer;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  SELECT lower(email) INTO my_email FROM auth.users WHERE id = uid AND email_confirmed_at IS NOT NULL;
  IF my_email IS NULL THEN RETURN 0; END IF;
  UPDATE public.tickets SET holder_id = uid WHERE holder_id IS NULL AND lower(attendee_email) = my_email;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.ticket_transfers SET to_user = uid WHERE to_user IS NULL AND to_email = my_email;
  RETURN n;
END $$;

-- ---------- Resale listings ----------
CREATE OR REPLACE FUNCTION public.create_resale_listing(_ticket_id uuid, _price numeric, _phone text, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); t record; e public.events; face numeric; cap numeric; lid uuid; sname text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id;
  IF t IS NULL OR t.holder_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'You can only sell tickets you hold'; END IF;
  IF t.checked_in_at IS NOT NULL THEN RAISE EXCEPTION 'This ticket has already been used'; END IF;
  e := public._assert_event_open(t.event_id);
  IF e.starts_at < now() THEN RAISE EXCEPTION 'Resale closes when the event starts'; END IF;
  IF NOT e.resale_enabled THEN RAISE EXCEPTION 'The organizer has turned off resale for this event'; END IF;
  IF _price IS NULL OR _price < 10 OR _price > 1000000 THEN RAISE EXCEPTION 'Price must be between KES 10 and KES 1,000,000'; END IF;
  IF _phone IS NULL OR _phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa number'; END IF;
  SELECT price_kes INTO face FROM public.ticket_types WHERE id = t.ticket_type_id;
  IF e.resale_max_markup_pct IS NOT NULL AND face > 0 THEN
    cap := round(face * (1 + e.resale_max_markup_pct / 100.0));
    IF _price > cap THEN RAISE EXCEPTION 'The organizer caps resale for this event at KES %', cap; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.resale_listings WHERE ticket_id = _ticket_id AND status IN ('active','reserved')) THEN
    RAISE EXCEPTION 'This ticket is already listed';
  END IF;
  SELECT NULLIF(trim(full_name), '') INTO sname FROM public.profiles WHERE id = uid;
  INSERT INTO public.resale_listings (ticket_id, event_id, ticket_type_id, seller_id, seller_name, price_kes, face_value_kes, payout_phone, note)
  VALUES (_ticket_id, t.event_id, t.ticket_type_id, uid, COALESCE(sname, 'Verified fan'), round(_price), COALESCE(face, 0), _phone, NULLIF(trim(_note), ''))
  RETURNING id INTO lid;
  RETURN lid;
END $$;

CREATE OR REPLACE FUNCTION public.update_resale_listing(_listing_id uuid, _price numeric, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); l record; e public.events; cap numeric;
BEGIN
  SELECT * INTO l FROM public.resale_listings WHERE id = _listing_id FOR UPDATE;
  IF l IS NULL OR l.seller_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'Only live listings can be edited'; END IF;
  IF _price IS NULL OR _price < 10 OR _price > 1000000 THEN RAISE EXCEPTION 'Price must be between KES 10 and KES 1,000,000'; END IF;
  SELECT * INTO e FROM public.events WHERE id = l.event_id;
  IF e.resale_max_markup_pct IS NOT NULL AND l.face_value_kes > 0 THEN
    cap := round(l.face_value_kes * (1 + e.resale_max_markup_pct / 100.0));
    IF _price > cap THEN RAISE EXCEPTION 'The organizer caps resale for this event at KES %', cap; END IF;
  END IF;
  UPDATE public.resale_listings SET price_kes = round(_price), note = NULLIF(trim(_note), '') WHERE id = _listing_id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_resale_listing(_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); l record;
BEGIN
  PERFORM public.expire_resale_trades();
  SELECT * INTO l FROM public.resale_listings WHERE id = _listing_id FOR UPDATE;
  IF l IS NULL OR (l.seller_id IS DISTINCT FROM uid AND NOT public.has_role(uid, 'admin')) THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF l.status = 'reserved' THEN RAISE EXCEPTION 'A buyer is paying for this ticket right now. Wait for the trade to finish or expire.'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'This listing is no longer live'; END IF;
  UPDATE public.resale_listings SET status = 'cancelled' WHERE id = _listing_id;
END $$;

-- ---------- Trades ----------
CREATE OR REPLACE FUNCTION public.start_resale_trade(_listing_id uuid, _buyer_phone text, _buyer_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); l record; e public.events; tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Please sign in to buy resale tickets'; END IF;
  PERFORM public.expire_resale_trades();
  SELECT * INTO l FROM public.resale_listings WHERE id = _listing_id FOR UPDATE;
  IF l IS NULL OR l.status <> 'active' THEN RAISE EXCEPTION 'Someone else is buying this ticket. Try another listing.'; END IF;
  IF l.seller_id = uid THEN RAISE EXCEPTION 'You can''t buy your own listing'; END IF;
  IF _buyer_phone IS NULL OR _buyer_phone !~ '^254[17][0-9]{8}$' THEN RAISE EXCEPTION 'Enter a valid M-Pesa number'; END IF;
  e := public._assert_event_open(l.event_id);
  IF (SELECT count(*) FROM public.resale_trades WHERE buyer_id = uid AND status = 'awaiting_payment') >= 3 THEN
    RAISE EXCEPTION 'Finish or cancel your open trades first';
  END IF;
  UPDATE public.resale_listings SET status = 'reserved' WHERE id = _listing_id;
  INSERT INTO public.resale_trades (listing_id, ticket_id, event_id, seller_id, buyer_id, price_kes, seller_phone, seller_name, buyer_phone, buyer_name, expires_at)
  VALUES (_listing_id, l.ticket_id, l.event_id, l.seller_id, uid, l.price_kes, l.payout_phone, l.seller_name, _buyer_phone, NULLIF(trim(_buyer_name), ''), now() + interval '30 minutes')
  RETURNING id INTO tid;
  PERFORM public._resale_sys_msg(tid, 'Ticket reserved for 30 minutes. Buyer: send the money by M-Pesa, then tap "I''ve paid". Seller: release the ticket once the money arrives.');
  RETURN tid;
END $$;

CREATE OR REPLACE FUNCTION public.mark_trade_paid(_trade_id uuid, _payment_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tr record;
BEGIN
  PERFORM public.expire_resale_trades();
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  IF tr IS NULL OR tr.buyer_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF tr.status = 'expired' THEN RAISE EXCEPTION 'The payment window expired. Start a new purchase.'; END IF;
  IF tr.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'This trade is already %', replace(tr.status, '_', ' '); END IF;
  IF _payment_ref IS NULL OR upper(trim(_payment_ref)) !~ '^[A-Z0-9]{8,12}$' THEN RAISE EXCEPTION 'Enter the M-Pesa confirmation code (e.g. SGH7XK2LQ1)'; END IF;
  UPDATE public.resale_trades SET status = 'paid', paid_at = now(), payment_ref = upper(trim(_payment_ref)) WHERE id = _trade_id;
  PERFORM public._resale_sys_msg(_trade_id, 'Buyer marked as paid (M-Pesa code ' || upper(trim(_payment_ref)) || '). Seller: confirm the money arrived, then release the ticket.');
END $$;

CREATE OR REPLACE FUNCTION public._finish_release(_trade_id uuid, _by uuid, _kind text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tr record; b_email text; t record; code text;
BEGIN
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  SELECT * INTO t FROM public.tickets WHERE id = tr.ticket_id;
  IF t.holder_id IS DISTINCT FROM tr.seller_id THEN RAISE EXCEPTION 'The seller no longer holds this ticket'; END IF;
  SELECT email INTO b_email FROM auth.users WHERE id = tr.buyer_id;
  code := public._move_ticket(tr.ticket_id, tr.seller_id, tr.buyer_id, b_email, tr.buyer_name, tr.buyer_phone, _kind, tr.id, NULL);
  UPDATE public.resale_trades SET status = 'released', released_at = now(), resolved_by = CASE WHEN _by <> tr.seller_id THEN _by ELSE resolved_by END WHERE id = _trade_id;
  UPDATE public.resale_listings SET status = 'sold', sold_at = now() WHERE id = tr.listing_id;
  PERFORM public._resale_sys_msg(_trade_id, 'Ticket released to the buyer with a brand-new QR code. Enjoy the event!');
  RETURN code;
END $$;

CREATE OR REPLACE FUNCTION public.release_trade(_trade_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tr record;
BEGIN
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  IF tr IS NULL OR tr.seller_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Only the seller can release this ticket'; END IF;
  IF tr.status NOT IN ('awaiting_payment','paid','disputed') THEN RAISE EXCEPTION 'This trade is already %', replace(tr.status, '_', ' '); END IF;
  RETURN public._finish_release(_trade_id, uid, 'resale');
END $$;

CREATE OR REPLACE FUNCTION public.cancel_trade(_trade_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tr record;
BEGIN
  PERFORM public.expire_resale_trades();
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  IF tr IS NULL OR tr.buyer_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Only the buyer can cancel. Sellers can open a dispute instead.'; END IF;
  IF tr.status NOT IN ('awaiting_payment','paid','disputed') THEN RAISE EXCEPTION 'This trade is already %', replace(tr.status, '_', ' '); END IF;
  UPDATE public.resale_trades SET status = 'cancelled', cancelled_at = now(), cancel_reason = COALESCE(NULLIF(trim(_reason), ''), 'Cancelled by buyer') WHERE id = _trade_id;
  UPDATE public.resale_listings SET status = 'active' WHERE id = tr.listing_id AND status = 'reserved';
  PERFORM public._resale_sys_msg(_trade_id, 'Buyer cancelled the trade. The ticket is back on the market.');
END $$;

CREATE OR REPLACE FUNCTION public.dispute_trade(_trade_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tr record;
BEGIN
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  IF tr IS NULL OR NOT (tr.buyer_id = uid OR tr.seller_id = uid) THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF tr.status <> 'paid' THEN RAISE EXCEPTION 'Disputes can be opened after the buyer marks the trade as paid'; END IF;
  IF _reason IS NULL OR char_length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'Tell us briefly what went wrong'; END IF;
  UPDATE public.resale_trades SET status = 'disputed', dispute_reason = left(trim(_reason), 1000), disputed_by = uid WHERE id = _trade_id;
  PERFORM public._resale_sys_msg(_trade_id, 'A dispute was opened. An administrator will review the trade. The ticket stays locked until then.');
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_trade(_trade_id uuid, _action text, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tr record;
BEGIN
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'Only administrators can resolve trades'; END IF;
  SELECT * INTO tr FROM public.resale_trades WHERE id = _trade_id FOR UPDATE;
  IF tr IS NULL THEN RAISE EXCEPTION 'Trade not found'; END IF;
  IF tr.status NOT IN ('awaiting_payment','paid','disputed') THEN RAISE EXCEPTION 'This trade is already %', replace(tr.status, '_', ' '); END IF;
  IF _action = 'release' THEN
    PERFORM public._finish_release(_trade_id, uid, 'admin');
    UPDATE public.resale_trades SET resolution = COALESCE(NULLIF(trim(_note), ''), 'Released by administrator'), resolved_by = uid WHERE id = _trade_id;
  ELSIF _action = 'cancel' THEN
    UPDATE public.resale_trades SET status = 'cancelled', cancelled_at = now(), resolved_by = uid,
      resolution = COALESCE(NULLIF(trim(_note), ''), 'Cancelled by administrator'), cancel_reason = 'Cancelled by administrator' WHERE id = _trade_id;
    UPDATE public.resale_listings SET status = 'active' WHERE id = tr.listing_id AND status = 'reserved';
    PERFORM public._resale_sys_msg(_trade_id, 'An administrator cancelled this trade. ' || COALESCE(_note, ''));
  ELSE
    RAISE EXCEPTION 'Unknown action';
  END IF;
END $$;

-- Tickets that are listed or in a trade cannot be admitted at the gate
CREATE OR REPLACE FUNCTION public.guard_ticket_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.resale_listings WHERE ticket_id = NEW.id AND status IN ('active','reserved')) THEN
      RAISE EXCEPTION 'This ticket is listed for resale and can''t be admitted until the holder cancels the listing';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tickets_guard_checkin BEFORE UPDATE OF checked_in_at ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.guard_ticket_checkin();

-- Lock down internal helpers; expose user-facing actions to signed-in users only
REVOKE ALL ON FUNCTION public._resale_sys_msg(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._move_ticket(uuid, uuid, uuid, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._finish_release(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._assert_event_open(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gift_ticket(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_my_tickets() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_resale_listing(uuid, numeric, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_resale_listing(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_resale_listing(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_resale_trade(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_trade_paid(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.release_trade(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_trade(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dispute_trade(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_trade(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gift_ticket(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_my_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_resale_listing(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_resale_listing(uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_resale_listing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_resale_trade(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_trade_paid(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_trade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_trade(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dispute_trade(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_trade(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.expire_resale_trades() TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.resale_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.resale_trades;
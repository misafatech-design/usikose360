ALTER TABLE public.events
  ADD COLUMN vendor_applications_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN vendor_requirements text;

CREATE TABLE public.event_vendor_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 100),
  min_bid_kes numeric(12,2) NOT NULL DEFAULT 1 CHECK (min_bid_kes >= 1),
  spaces integer NOT NULL DEFAULT 1 CHECK (spaces BETWEEN 1 AND 5000),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_vendor_categories TO authenticated;
GRANT ALL ON public.event_vendor_categories TO service_role;
ALTER TABLE public.event_vendor_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event owners manage vendor categories"
  ON public.event_vendor_categories FOR ALL TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_vendor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.event_vendor_categories(id) ON DELETE RESTRICT,
  vendor_name text NOT NULL CHECK (length(trim(vendor_name)) BETWEEN 2 AND 100),
  business_name text NOT NULL CHECK (length(trim(business_name)) BETWEEN 2 AND 140),
  email text NOT NULL,
  phone text NOT NULL,
  notes text,
  bid_kes numeric(12,2) NOT NULL CHECK (bid_kes >= 1),
  approved_bid_kes numeric(12,2) CHECK (approved_bid_kes IS NULL OR approved_bid_kes >= 1),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'payment_pending', 'payment_failed', 'paid')),
  vendor_token_hash text NOT NULL UNIQUE CHECK (length(vendor_token_hash) = 64),
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  mpesa_receipt text,
  result_desc text,
  environment text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_vendor_applications TO authenticated;
GRANT ALL ON public.event_vendor_applications TO service_role;
ALTER TABLE public.event_vendor_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event owners read vendor applications"
  ON public.event_vendor_applications FOR SELECT TO authenticated
  USING (public.is_event_owner(event_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX event_vendor_categories_event_idx ON public.event_vendor_categories (event_id, created_at);
CREATE INDEX event_vendor_applications_event_idx ON public.event_vendor_applications (event_id, created_at DESC);
CREATE INDEX event_vendor_applications_category_status_idx ON public.event_vendor_applications (category_id, status);
CREATE INDEX event_vendor_applications_checkout_idx ON public.event_vendor_applications (checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE TRIGGER event_vendor_applications_touch_updated_at
  BEFORE UPDATE ON public.event_vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.review_vendor_application(
  _application_id uuid,
  _action text,
  _approved_bid_kes numeric,
  _vendor_token_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_application public.event_vendor_applications%ROWTYPE;
  v_organizer_id uuid;
  v_min_bid numeric;
  v_spaces integer;
  v_reserved integer;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  SELECT * INTO v_application
    FROM public.event_vendor_applications
    WHERE id = _application_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  SELECT organizer_id INTO v_organizer_id FROM public.events WHERE id = v_application.event_id;
  IF v_organizer_id IS DISTINCT FROM auth.uid()
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only this event organizer can review applications';
  END IF;
  IF v_application.status <> 'pending' THEN RAISE EXCEPTION 'This application was already reviewed'; END IF;
  IF _action = 'declined' THEN
    UPDATE public.event_vendor_applications SET status = 'declined' WHERE id = _application_id;
    RETURN jsonb_build_object('id', _application_id, 'status', 'declined');
  END IF;
  IF _action <> 'approved' THEN RAISE EXCEPTION 'Choose approve or decline'; END IF;
  IF _vendor_token_hash IS NULL OR length(_vendor_token_hash) <> 64 THEN RAISE EXCEPTION 'Invalid vendor access token'; END IF;
  SELECT min_bid_kes, spaces INTO v_min_bid, v_spaces
    FROM public.event_vendor_categories
    WHERE id = v_application.category_id AND event_id = v_application.event_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vendor category not found'; END IF;
  SELECT count(*) INTO v_reserved
    FROM public.event_vendor_applications
    WHERE category_id = v_application.category_id
      AND status IN ('approved', 'payment_pending', 'payment_failed', 'paid');
  IF v_reserved >= v_spaces THEN RAISE EXCEPTION 'No spaces remain in this vendor category'; END IF;
  v_amount := coalesce(_approved_bid_kes, v_application.bid_kes);
  IF v_amount < v_min_bid OR v_amount < 1 THEN RAISE EXCEPTION 'Accepted bid must meet the category minimum'; END IF;
  UPDATE public.event_vendor_applications
    SET status = 'approved', approved_bid_kes = v_amount, vendor_token_hash = _vendor_token_hash, result_desc = NULL
    WHERE id = _application_id;
  RETURN jsonb_build_object('id', _application_id, 'status', 'approved', 'approved_bid_kes', v_amount);
END;
$$;
REVOKE ALL ON FUNCTION public.review_vendor_application(uuid, text, numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_vendor_application(uuid, text, numeric, text) TO authenticated, service_role;
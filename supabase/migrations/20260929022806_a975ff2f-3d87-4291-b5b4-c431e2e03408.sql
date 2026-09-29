CREATE TABLE public.email_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  host text,
  port int NOT NULL DEFAULT 465,
  security text NOT NULL DEFAULT 'ssl',
  username text,
  password text,
  from_name text NOT NULL DEFAULT 'Usikose360',
  from_email text,
  reply_to text,
  allow_self_signed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_settings TO service_role;
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER email_settings_touch BEFORE UPDATE ON public.email_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  recipient text NOT NULL,
  subject text,
  status text NOT NULL,
  error text,
  order_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_log TO service_role;
ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX email_log_created_idx ON public.email_log (created_at DESC);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS access_token text NOT NULL DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  ADD COLUMN IF NOT EXISTS site_origin text,
  ADD COLUMN IF NOT EXISTS emails_sent_at timestamptz;
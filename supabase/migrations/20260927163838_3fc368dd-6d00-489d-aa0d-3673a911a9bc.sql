ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS events_featured_idx ON public.events(is_featured) WHERE is_featured;

CREATE OR REPLACE FUNCTION public.guard_event_featured()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_featured AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
      NEW.is_featured := false;
    END IF;
  ELSIF NEW.is_featured IS DISTINCT FROM OLD.is_featured
     AND auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.is_featured := OLD.is_featured;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_event_featured() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER events_guard_featured BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.guard_event_featured();

CREATE POLICY "organizers upload covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text
    AND (public.has_role(auth.uid(),'organizer') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "owners read covers" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owners update covers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "owners delete covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
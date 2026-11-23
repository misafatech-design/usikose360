ALTER POLICY "profiles readable" ON public.profiles
USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

ALTER POLICY "event covers readable by anyone" ON storage.objects
USING (
  bucket_id = 'event-covers'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.events AS e
      WHERE e.status = 'published'
        AND e.organizer_id::text = (storage.foldername(storage.objects.name))[1]
        AND e.cover_url = ('/api/public/covers/' || storage.objects.name)
    )
  )
);
DROP POLICY IF EXISTS "Open insert" ON public.payments;
DROP POLICY IF EXISTS "Open update" ON public.payments;
DROP POLICY IF EXISTS "Open delete" ON public.payments;
DROP POLICY IF EXISTS "Open read" ON public.payments;

GRANT SELECT ON public.payments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

CREATE POLICY "Public read" ON public.payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update" ON public.payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Auth delete" ON public.payments FOR DELETE TO authenticated USING (true);

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname ILIKE '%payment%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
  END LOOP;
END $$;

CREATE POLICY "payment-docs read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-docs') WITH CHECK (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-docs');
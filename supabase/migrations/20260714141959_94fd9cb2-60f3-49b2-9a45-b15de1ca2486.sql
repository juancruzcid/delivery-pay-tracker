
CREATE POLICY "payment-docs open select" ON storage.objects FOR SELECT USING (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs open insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs open update" ON storage.objects FOR UPDATE USING (bucket_id = 'payment-docs') WITH CHECK (bucket_id = 'payment-docs');
CREATE POLICY "payment-docs open delete" ON storage.objects FOR DELETE USING (bucket_id = 'payment-docs');

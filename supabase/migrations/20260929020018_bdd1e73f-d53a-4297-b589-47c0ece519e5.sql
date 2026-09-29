DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Signups are disabled; existing account(s) are the owner.
INSERT INTO public.user_roles (user_id, role) SELECT id, 'admin' FROM auth.users ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS "Auth delete" ON public.payments;
DROP POLICY IF EXISTS "Auth insert" ON public.payments;
DROP POLICY IF EXISTS "Auth update" ON public.payments;
CREATE POLICY "Admin insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin update" ON public.payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete" ON public.payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Auth delete items" ON public.pedido_items;
DROP POLICY IF EXISTS "Auth insert items" ON public.pedido_items;
DROP POLICY IF EXISTS "Auth read items" ON public.pedido_items;
CREATE POLICY "Admin read items" ON public.pedido_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin insert items" ON public.pedido_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete items" ON public.pedido_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "payment-docs insert" ON storage.objects;
DROP POLICY IF EXISTS "payment-docs update" ON storage.objects;
DROP POLICY IF EXISTS "payment-docs delete" ON storage.objects;
CREATE POLICY "payment-docs admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'payment-docs' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "payment-docs admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'payment-docs' AND public.has_role(auth.uid(),'admin')) WITH CHECK (bucket_id = 'payment-docs' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "payment-docs admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-docs' AND public.has_role(auth.uid(),'admin'));
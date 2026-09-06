CREATE TABLE public.pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  producto text NOT NULL,
  cantidad numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pedido_items_payment_id_idx ON public.pedido_items(payment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_items TO authenticated;
GRANT ALL ON public.pedido_items TO service_role;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read items" ON public.pedido_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert items" ON public.pedido_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth delete items" ON public.pedido_items FOR DELETE TO authenticated USING (true);
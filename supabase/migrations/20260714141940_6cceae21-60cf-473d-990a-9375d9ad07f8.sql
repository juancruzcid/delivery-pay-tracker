
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha DATE NOT NULL,
  cliente TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  recibo BOOLEAN NOT NULL DEFAULT false,
  transferencia NUMERIC(14,2) NOT NULL DEFAULT 0,
  efectivo NUMERIC(14,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  recibo_pdf_path TEXT,
  transferencia_pdf_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Personal-use app without login: allow open access as chosen by the owner
CREATE POLICY "Open read" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Open insert" ON public.payments FOR INSERT WITH CHECK (true);
CREATE POLICY "Open update" ON public.payments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Open delete" ON public.payments FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payments_fecha ON public.payments(fecha DESC);

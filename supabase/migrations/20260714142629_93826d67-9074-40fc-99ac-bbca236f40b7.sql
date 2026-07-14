
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envio NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retira BOOLEAN NOT NULL DEFAULT false;

-- Backfill: use existing monto as subtotal for pre-existing rows
UPDATE public.payments SET subtotal = monto WHERE subtotal = 0 AND monto <> 0;

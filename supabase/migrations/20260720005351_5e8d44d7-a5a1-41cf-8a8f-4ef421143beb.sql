ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS estado_envio text NOT NULL DEFAULT 'pendiente';
UPDATE public.payments SET estado_envio = CASE WHEN retira THEN 'retiro' ELSE 'pendiente' END;
ALTER TABLE public.payments ADD CONSTRAINT payments_estado_envio_check CHECK (estado_envio IN ('retiro','pendiente','enviado'));
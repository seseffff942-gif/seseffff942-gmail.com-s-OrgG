CREATE TABLE IF NOT EXISTS public.corte_sales_dispatches (
  corte_key TEXT PRIMARY KEY,
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_by TEXT
);

INSERT INTO public.corte_sales_dispatches (corte_key, dispatched_at, dispatched_by)
VALUES ('2026-09-14_12:00', NOW(), 'system_protection')
ON CONFLICT (corte_key) DO NOTHING;

SELECT * FROM public.corte_sales_dispatches;

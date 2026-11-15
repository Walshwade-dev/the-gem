CREATE TABLE IF NOT EXISTS mpesa_stk_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  initiated_by_type text NOT NULL,
  initiated_by_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'INTASEND',
  invoice_id text UNIQUE,
  api_ref text NOT NULL UNIQUE,
  phone_e164 text NOT NULL,
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED')),
  mpesa_receipt text,
  failed_code text,
  failed_reason text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mpesa_stk_requests_master_idx
  ON mpesa_stk_requests (master_id, created_at DESC);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_source_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_source_check
  CHECK (source IN ('MANUAL', 'DARAJA_C2B', 'INTASEND_STK', 'DARAJA_STK'));

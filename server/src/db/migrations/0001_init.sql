-- gen_random_uuid() is built-in in PostgreSQL 13+

CREATE TABLE IF NOT EXISTS masters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL,
  store_name text NOT NULL,
  phone_e164 text,
  national_id text,
  allow_by_weight_sellers bool NOT NULL DEFAULT true,
  rounding_rule text NOT NULL DEFAULT 'ROUND_TO_SHILLING',
  credit_terms_days int NOT NULL DEFAULT 4,
  policy_accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS salespeople (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  phone_e164 text NOT NULL,
  full_name text NOT NULL,
  email text,
  clerk_user_id text UNIQUE,
  national_id text,
  passphrase_hash text,
  status text NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  credit_cap_nominal_grams int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  salesperson_id uuid NOT NULL REFERENCES salespeople(id),
  terms_version text NOT NULL,
  device_id uuid,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  user_type text NOT NULL CHECK (user_type IN ('MASTER', 'SELLER')),
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  platform text,
  blocked_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_type, user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid REFERENCES masters(id),
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  purpose text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  salesperson_id uuid NOT NULL REFERENCES salespeople(id),
  device_id uuid NOT NULL REFERENCES devices(id),
  refresh_token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  user_type text NOT NULL CHECK (user_type IN ('MASTER', 'SELLER')),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES devices(id),
  expo_push_token text UNIQUE NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid REFERENCES masters(id),
  event_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('TIER_1', 'TIER_2', 'TIER_3')),
  actor_type text,
  actor_id uuid,
  device_id uuid REFERENCES devices(id),
  phone_e164 text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS security_lockdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  reason text NOT NULL,
  is_active bool NOT NULL DEFAULT true,
  triggered_by uuid NOT NULL REFERENCES masters(id),
  unlocked_by uuid REFERENCES masters(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  unlocked_at timestamptz
);

CREATE TABLE IF NOT EXISTS ncc_tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  rate_per_net_cents int NOT NULL DEFAULT 2000,
  discount_cents int NOT NULL DEFAULT 200000,
  min_payable_cents int NOT NULL DEFAULT 600000,
  daily_fee_cents int NOT NULL DEFAULT 100000,
  default_max_days int NOT NULL DEFAULT 4,
  effective_from date NOT NULL,
  effective_to date
);

CREATE TABLE IF NOT EXISTS shrinkage_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  loss_per_net_per_day_g int NOT NULL DEFAULT 200,
  floor_per_net_g int NOT NULL DEFAULT 18000,
  extra_tolerance_percent numeric(5,2) NOT NULL DEFAULT 0.50,
  effective_from date NOT NULL,
  effective_to date
);

CREATE TABLE IF NOT EXISTS recurring_daily_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  category_code text NOT NULL,
  amount_cents int NOT NULL DEFAULT 10000,
  is_active bool NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS truck_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_number text NOT NULL,
  truck_plate text NOT NULL,
  origin_region_id text,
  origin_region_name text,
  origin_specific_location text,
  farmer_supplier_notes text,
  arrival_time timestamptz NOT NULL DEFAULT now(),
  business_date date NOT NULL,
  day_number int NOT NULL DEFAULT 1,
  is_negotiated_extension bool NOT NULL DEFAULT false,
  trucks_departed_at timestamptz,
  packaging_grams int NOT NULL DEFAULT 20000,
  nets_loaded int NOT NULL,
  initial_grade1_nominal_grams int NOT NULL,
  initial_grade2_nominal_grams int NOT NULL,
  ncc_counted_nets int NOT NULL,
  ncc_tariff_id uuid NOT NULL REFERENCES ncc_tariffs(id),
  ncc_computed_payable_cents int NOT NULL,
  ncc_receipt_no text,
  ncc_official_amount_cents int,
  ncc_amount_mismatch bool NOT NULL DEFAULT false,
  is_ncc_cess_paid bool NOT NULL DEFAULT false,
  ncc_cess_paid_at timestamptz,
  price_g1_cents int,
  min_price_g1_cents int,
  price_g2_cents int,
  min_price_g2_cents int,
  purchase_costs jsonb,
  photo_urls jsonb NOT NULL DEFAULT '[]',
  quality_notes text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'LOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE TABLE IF NOT EXISTS weigh_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  sample_weight_g int NOT NULL CHECK (sample_weight_g > 0),
  sampled_date date NOT NULL,
  sampled_by_type text NOT NULL CHECK (sampled_by_type IN ('MASTER', 'SELLER')),
  sampled_by_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  title text NOT NULL,
  grade text NOT NULL CHECK (grade IN ('GRADE_1', 'GRADE_2')),
  packaging text NOT NULL,
  weight_grams int NOT NULL,
  price_cents int NOT NULL,
  min_price_cents int NOT NULL,
  photo_url text,
  photo_urls jsonb NOT NULL DEFAULT '[]',
  description text,
  tags jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  salesperson_id uuid NOT NULL REFERENCES salespeople(id),
  expected_price_g1_cents int NOT NULL,
  expected_price_g2_cents int NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'REVOKED')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  closed_by uuid REFERENCES masters(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment_per_seller_batch
  ON stock_assignments (salesperson_id, batch_id) WHERE status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS assignment_daily_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  assignment_id uuid NOT NULL REFERENCES stock_assignments(id),
  business_date date NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('DAILY_OPEN', 'TOPUP')),
  expected_g1_nominal_grams int NOT NULL,
  expected_g2_nominal_grams int NOT NULL,
  physical_g1_nominal_grams int,
  physical_g2_nominal_grams int,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'DISCREPANCY', 'RESOLVED')),
  note text,
  acknowledged_at timestamptz,
  resolved_by uuid REFERENCES masters(id),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  grade text NOT NULL CHECK (grade IN ('GRADE_1', 'GRADE_2')),
  movement_type text NOT NULL CHECK (movement_type IN (
    'LOAD', 'ALLOCATE', 'TOPUP', 'RESERVE', 'RELEASE', 'SALE', 'SALE_REVERSAL', 'RETURN', 'WRITE_OFF'
  )),
  delta_nominal_grams int NOT NULL,
  reference_id uuid,
  actor_type text NOT NULL,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  full_name text NOT NULL,
  phone_e164 text NOT NULL,
  national_id text NOT NULL,
  marketing_consent bool NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_id, phone_e164)
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  seller_type text NOT NULL CHECK (seller_type IN ('MASTER', 'SELLER')),
  seller_id uuid NOT NULL,
  buyer_id uuid REFERENCES buyers(id),
  buyer_name text,
  grade text NOT NULL CHECK (grade IN ('GRADE_1', 'GRADE_2')),
  pricing_mode text NOT NULL CHECK (pricing_mode IN ('PER_NET', 'BY_WEIGHT')),
  quantity_nominal_grams int NOT NULL CHECK (quantity_nominal_grams > 0),
  weighed_grams int NOT NULL CHECK (weighed_grams > 0),
  billed_grams int NOT NULL CHECK (billed_grams > 0),
  list_price_cents int NOT NULL,
  floor_price_cents int NOT NULL,
  unit_price_per_net_cents int NOT NULL,
  total_amount_cents int NOT NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('CASH', 'MPESA', 'CREDIT', 'SPLIT')),
  status text NOT NULL CHECK (status IN ('PENDING_APPROVAL', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'EXPIRED')),
  is_late_sale bool NOT NULL DEFAULT false,
  is_offline_synced bool NOT NULL DEFAULT false,
  pending_review bool NOT NULL DEFAULT false,
  business_date date NOT NULL,
  client_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS price_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  sale_id uuid UNIQUE NOT NULL REFERENCES sales(id),
  requested_price_cents int NOT NULL,
  list_price_cents int NOT NULL,
  floor_price_cents int NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
  decided_by uuid REFERENCES masters(id),
  decided_at timestamptz,
  expires_at timestamptz NOT NULL,
  reason text
);

CREATE TABLE IF NOT EXISTS credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  sale_id uuid UNIQUE NOT NULL REFERENCES sales(id),
  buyer_id uuid NOT NULL REFERENCES buyers(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  seller_type text NOT NULL CHECK (seller_type IN ('MASTER', 'SELLER')),
  seller_id uuid NOT NULL,
  grade text NOT NULL CHECK (grade IN ('GRADE_1', 'GRADE_2')),
  quantity_nominal_grams int NOT NULL,
  total_owed_cents int NOT NULL,
  approval_status text NOT NULL CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  approved_by uuid REFERENCES masters(id),
  approved_at timestamptz,
  due_date date NOT NULL,
  guarantor_type text NOT NULL CHECK (guarantor_type IN ('MASTER', 'SELLER')),
  guarantor_id uuid NOT NULL,
  guarantor_accepted_at timestamptz,
  guarantor_terms_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  sale_id uuid REFERENCES sales(id),
  credit_entry_id uuid REFERENCES credit_entries(id),
  method text NOT NULL CHECK (method IN ('CASH', 'MPESA')),
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  mpesa_receipt text UNIQUE,
  payer_phone_e164 text,
  source text NOT NULL CHECK (source IN ('MANUAL', 'DARAJA_C2B')),
  recorded_by_type text NOT NULL,
  recorded_by_id uuid NOT NULL,
  business_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (method <> 'MPESA' OR (mpesa_receipt ~ '^[A-Z0-9]{10}$' AND payer_phone_e164 IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS sms_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  to_phone_e164 text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  body_text text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENT', 'FAILED')),
  provider_message_id text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  code text NOT NULL,
  label text NOT NULL,
  is_system bool NOT NULL DEFAULT false,
  UNIQUE (master_id, code)
);

CREATE TABLE IF NOT EXISTS daily_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  category_id uuid NOT NULL REFERENCES expense_categories(id),
  business_date date NOT NULL,
  description text NOT NULL,
  amount_cents int NOT NULL,
  paid_via text NOT NULL CHECK (paid_via IN ('CASH', 'MPESA')),
  receipt_ref text,
  is_paid bool NOT NULL DEFAULT true,
  review_status text NOT NULL CHECK (review_status IN ('APPROVED', 'UNREVIEWED')),
  added_by_type text NOT NULL,
  added_by_id uuid NOT NULL,
  reviewed_by uuid REFERENCES masters(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS casual_laborers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  business_date date NOT NULL,
  worker_name text NOT NULL,
  task text NOT NULL,
  agreed_wage_cents int NOT NULL,
  is_paid bool NOT NULL DEFAULT false,
  paid_via text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  business_date date NOT NULL,
  market_close_time time NOT NULL DEFAULT '14:00:00',
  late_session_open bool NOT NULL DEFAULT false,
  late_reason text,
  late_ends_at timestamptz,
  opened_by uuid REFERENCES masters(id),
  closed_at timestamptz,
  UNIQUE (master_id, business_date)
);

CREATE TABLE IF NOT EXISTS daily_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  responsible_name text NOT NULL,
  business_date date NOT NULL,
  day_number int NOT NULL,
  opening_g1_nominal_grams int NOT NULL,
  opening_g2_nominal_grams int NOT NULL,
  physical_g1_nominal_grams int,
  physical_g2_nominal_grams int,
  expected_g1_nominal_grams int NOT NULL,
  expected_g2_nominal_grams int NOT NULL,
  variance_g1_nominal_grams int,
  variance_g2_nominal_grams int,
  sold_g1_nominal_grams int NOT NULL,
  sold_g2_nominal_grams int NOT NULL,
  expected_price_g1_cents int NOT NULL,
  expected_price_g2_cents int NOT NULL,
  negotiation_discount_cents int NOT NULL DEFAULT 0,
  weight_concession_cents int NOT NULL DEFAULT 0,
  sample_avg_weight_g int,
  expected_net_weight_g int,
  weight_check_flagged bool NOT NULL DEFAULT false,
  cash_sales_cents int NOT NULL,
  mpesa_sales_cents int NOT NULL,
  credit_sales_cents int NOT NULL,
  cash_repayments_cents int NOT NULL,
  mpesa_repayments_cents int NOT NULL,
  cash_expenses_cents int NOT NULL,
  mpesa_expenses_cents int NOT NULL,
  expected_cash_cents int NOT NULL,
  actual_cash_cents int,
  cash_discrepancy_cents int,
  expected_mpesa_cents int NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'SUBMITTED', 'BALANCED', 'DISCREPANCY', 'AUDIT_FLAGGED')),
  master_approval_status text NOT NULL DEFAULT 'PENDING_MASTER_APPROVAL'
    CHECK (master_approval_status IN ('PENDING_MASTER_APPROVAL', 'APPROVED')),
  approved_by uuid REFERENCES masters(id),
  approved_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variance_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  batch_id uuid NOT NULL REFERENCES truck_batches(id),
  assignment_id uuid REFERENCES stock_assignments(id),
  reconciliation_id uuid REFERENCES daily_reconciliations(id),
  responsible_type text NOT NULL CHECK (responsible_type IN ('MASTER', 'SELLER')),
  responsible_id uuid NOT NULL,
  shortfall_nominal_grams int NOT NULL,
  estimated_value_cents int NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'EXPLAINED', 'DECIDED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variance_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  variance_case_id uuid NOT NULL REFERENCES variance_cases(id),
  version int NOT NULL,
  reason_code text NOT NULL CHECK (reason_code IN (
    'SPOILAGE', 'WEIGHING_DIFFERENCE', 'MISCOUNT', 'UNRECORDED_SALE', 'THEFT', 'OTHER'
  )),
  explanation_text text NOT NULL,
  submitted_by_type text NOT NULL,
  submitted_by_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS variance_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  variance_case_id uuid UNIQUE NOT NULL REFERENCES variance_cases(id),
  decision text NOT NULL CHECK (decision IN ('ACCEPT', 'PARTIAL', 'CHARGE')),
  charge_amount_cents int NOT NULL DEFAULT 0,
  decided_by uuid NOT NULL REFERENCES masters(id),
  notes text,
  decided_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS liability_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL REFERENCES masters(id),
  salesperson_id uuid NOT NULL REFERENCES salespeople(id),
  variance_case_id uuid REFERENCES variance_cases(id),
  entry_type text NOT NULL CHECK (entry_type IN ('CHARGE', 'PAYMENT')),
  amount_cents int NOT NULL,
  is_disputed bool NOT NULL DEFAULT false,
  dispute_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid REFERENCES masters(id),
  actor_type text NOT NULL,
  actor_id uuid,
  actor_role text,
  device_id uuid,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('SUCCESS', 'DENIED', 'FAILED')),
  before_state jsonb,
  after_state jsonb,
  server_time timestamptz NOT NULL DEFAULT now(),
  client_time timestamptz
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key text NOT NULL,
  master_id uuid NOT NULL REFERENCES masters(id),
  actor_id uuid NOT NULL,
  route text NOT NULL,
  request_hash text NOT NULL,
  response_status int,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, actor_id, route)
);

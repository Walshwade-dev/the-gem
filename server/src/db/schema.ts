import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  numeric,
  primaryKey,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const masters = pgTable('masters', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull(),
  fullName: text('full_name').notNull(),
  storeName: text('store_name').notNull(),
  phoneE164: text('phone_e164'),
  nationalId: text('national_id'),
  allowByWeightSellers: boolean('allow_by_weight_sellers').notNull().default(true),
  roundingRule: text('rounding_rule').notNull().default('ROUND_TO_SHILLING'),
  creditTermsDays: integer('credit_terms_days').notNull().default(4),
  policyAcceptedAt: timestamp('policy_accepted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const salespeople = pgTable(
  'salespeople',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    phoneE164: text('phone_e164').notNull(),
    fullName: text('full_name').notNull(),
    nationalId: text('national_id'),
    passphraseHash: text('passphrase_hash'),
    status: text('status').notNull().default('INVITED'),
    creditCapNominalGrams: integer('credit_cap_nominal_grams'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_salespeople_master_phone').on(t.masterId, t.phoneE164)]
);

export const termsAcceptances = pgTable('terms_acceptances', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  salespersonId: uuid('salesperson_id').notNull().references(() => salespeople.id),
  termsVersion: text('terms_version').notNull(),
  deviceId: uuid('device_id'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
});

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    userType: text('user_type').notNull(),
    userId: uuid('user_id').notNull(),
    deviceFingerprint: text('device_fingerprint').notNull(),
    platform: text('platform'),
    blockedAt: timestamp('blocked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_devices_user_fp').on(t.userType, t.userId, t.deviceFingerprint)]
);

export const otpChallenges = pgTable('otp_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').references(() => masters.id),
  phoneE164: text('phone_e164').notNull(),
  codeHash: text('code_hash').notNull(),
  purpose: text('purpose').notNull(),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(5),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  salespersonId: uuid('salesperson_id').notNull().references(() => salespeople.id),
  deviceId: uuid('device_id').notNull().references(() => devices.id),
  refreshTokenHash: text('refresh_token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  userType: text('user_type').notNull(),
  userId: uuid('user_id').notNull(),
  deviceId: uuid('device_id').references(() => devices.id),
  expoPushToken: text('expo_push_token').notNull().unique(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const securityEvents = pgTable('security_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').references(() => masters.id),
  eventType: text('event_type').notNull(),
  severity: text('severity').notNull(),
  actorType: text('actor_type'),
  actorId: uuid('actor_id'),
  deviceId: uuid('device_id').references(() => devices.id),
  phoneE164: text('phone_e164'),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const securityLockdowns = pgTable('security_lockdowns', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  reason: text('reason').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  triggeredBy: uuid('triggered_by').notNull().references(() => masters.id),
  unlockedBy: uuid('unlocked_by').references(() => masters.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }),
});

export const nccTariffs = pgTable('ncc_tariffs', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  ratePerNetCents: integer('rate_per_net_cents').notNull().default(2000),
  discountCents: integer('discount_cents').notNull().default(200000),
  minPayableCents: integer('min_payable_cents').notNull().default(600000),
  dailyFeeCents: integer('daily_fee_cents').notNull().default(100000),
  defaultMaxDays: integer('default_max_days').notNull().default(4),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
});

export const shrinkageConfig = pgTable('shrinkage_config', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  lossPerNetPerDayG: integer('loss_per_net_per_day_g').notNull().default(200),
  floorPerNetG: integer('floor_per_net_g').notNull().default(18000),
  extraTolerancePercent: numeric('extra_tolerance_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0.50'),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
});

export const recurringDailyExpenses = pgTable('recurring_daily_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  categoryCode: text('category_code').notNull(),
  amountCents: integer('amount_cents').notNull().default(10000),
  isActive: boolean('is_active').notNull().default(true),
});

export const truckBatches = pgTable('truck_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchNumber: text('batch_number').notNull(),
  truckPlate: text('truck_plate').notNull(),
  originRegionId: text('origin_region_id'),
  originRegionName: text('origin_region_name'),
  originSpecificLocation: text('origin_specific_location'),
  farmerSupplierNotes: text('farmer_supplier_notes'),
  arrivalTime: timestamp('arrival_time', { withTimezone: true }).notNull().defaultNow(),
  businessDate: date('business_date').notNull(),
  dayNumber: integer('day_number').notNull().default(1),
  isNegotiatedExtension: boolean('is_negotiated_extension').notNull().default(false),
  trucksDepartedAt: timestamp('trucks_departed_at', { withTimezone: true }),
  packagingGrams: integer('packaging_grams').notNull().default(20000),
  netsLoaded: integer('nets_loaded').notNull(),
  initialGrade1NominalGrams: integer('initial_grade1_nominal_grams').notNull(),
  initialGrade2NominalGrams: integer('initial_grade2_nominal_grams').notNull(),
  nccCountedNets: integer('ncc_counted_nets').notNull(),
  nccTariffId: uuid('ncc_tariff_id').notNull().references(() => nccTariffs.id),
  nccComputedPayableCents: integer('ncc_computed_payable_cents').notNull(),
  nccReceiptNo: text('ncc_receipt_no'),
  nccOfficialAmountCents: integer('ncc_official_amount_cents'),
  nccAmountMismatch: boolean('ncc_amount_mismatch').notNull().default(false),
  isNccCessPaid: boolean('is_ncc_cess_paid').notNull().default(false),
  nccCessPaidAt: timestamp('ncc_cess_paid_at', { withTimezone: true }),
  priceG1Cents: integer('price_g1_cents'),
  minPriceG1Cents: integer('min_price_g1_cents'),
  priceG2Cents: integer('price_g2_cents'),
  minPriceG2Cents: integer('min_price_g2_cents'),
  purchaseCosts: jsonb('purchase_costs'),
  photoUrls: jsonb('photo_urls').notNull().default([]),
  qualityNotes: text('quality_notes'),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const weighSamples = pgTable('weigh_samples', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  sampleWeightG: integer('sample_weight_g').notNull(),
  sampledDate: date('sampled_date').notNull(),
  sampledByType: text('sampled_by_type').notNull(),
  sampledById: uuid('sampled_by_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const batchProducts = pgTable('batch_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  title: text('title').notNull(),
  grade: text('grade').notNull(),
  packaging: text('packaging').notNull(),
  weightGrams: integer('weight_grams').notNull(),
  priceCents: integer('price_cents').notNull(),
  minPriceCents: integer('min_price_cents').notNull(),
  photoUrl: text('photo_url'),
  photoUrls: jsonb('photo_urls').notNull().default([]),
  description: text('description'),
  tags: jsonb('tags').notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stockAssignments = pgTable(
  'stock_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
    salespersonId: uuid('salesperson_id').notNull().references(() => salespeople.id),
    expectedPriceG1Cents: integer('expected_price_g1_cents').notNull(),
    expectedPriceG2Cents: integer('expected_price_g2_cents').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    closedBy: uuid('closed_by').references(() => masters.id),
  },
  (t) => [
    uniqueIndex('uq_active_assignment_per_seller_batch')
      .on(t.salespersonId, t.batchId)
      .where(sql`${t.status} = 'ACTIVE'`),
  ]
);

export const assignmentDailyAcknowledgments = pgTable('assignment_daily_acknowledgments', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  assignmentId: uuid('assignment_id').notNull().references(() => stockAssignments.id),
  businessDate: date('business_date').notNull(),
  eventType: text('event_type').notNull(),
  expectedG1NominalGrams: integer('expected_g1_nominal_grams').notNull(),
  expectedG2NominalGrams: integer('expected_g2_nominal_grams').notNull(),
  physicalG1NominalGrams: integer('physical_g1_nominal_grams'),
  physicalG2NominalGrams: integer('physical_g2_nominal_grams'),
  status: text('status').notNull().default('PENDING'),
  note: text('note'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedBy: uuid('resolved_by').references(() => masters.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  grade: text('grade').notNull(),
  movementType: text('movement_type').notNull(),
  deltaNominalGrams: integer('delta_nominal_grams').notNull(),
  referenceId: uuid('reference_id'),
  actorType: text('actor_type').notNull(),
  actorId: uuid('actor_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const buyers = pgTable(
  'buyers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    fullName: text('full_name').notNull(),
    phoneE164: text('phone_e164').notNull(),
    nationalId: text('national_id').notNull(),
    marketingConsent: boolean('marketing_consent').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('uq_buyers_master_phone').on(t.masterId, t.phoneE164)]
);

export const sales = pgTable('sales', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  sellerType: text('seller_type').notNull(),
  sellerId: uuid('seller_id').notNull(),
  buyerId: uuid('buyer_id').references(() => buyers.id),
  buyerName: text('buyer_name'),
  grade: text('grade').notNull(),
  pricingMode: text('pricing_mode').notNull(),
  quantityNominalGrams: integer('quantity_nominal_grams').notNull(),
  weighedGrams: integer('weighed_grams').notNull(),
  billedGrams: integer('billed_grams').notNull(),
  listPriceCents: integer('list_price_cents').notNull(),
  floorPriceCents: integer('floor_price_cents').notNull(),
  unitPricePerNetCents: integer('unit_price_per_net_cents').notNull(),
  totalAmountCents: integer('total_amount_cents').notNull(),
  paymentMode: text('payment_mode').notNull(),
  status: text('status').notNull(),
  isLateSale: boolean('is_late_sale').notNull().default(false),
  isOfflineSynced: boolean('is_offline_synced').notNull().default(false),
  pendingReview: boolean('pending_review').notNull().default(false),
  businessDate: date('business_date').notNull(),
  clientTime: timestamp('client_time', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const priceApprovals = pgTable('price_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  saleId: uuid('sale_id').notNull().unique().references(() => sales.id),
  requestedPriceCents: integer('requested_price_cents').notNull(),
  listPriceCents: integer('list_price_cents').notNull(),
  floorPriceCents: integer('floor_price_cents').notNull(),
  status: text('status').notNull().default('PENDING'),
  decidedBy: uuid('decided_by').references(() => masters.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  reason: text('reason'),
});

export const creditEntries = pgTable('credit_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  saleId: uuid('sale_id').notNull().unique().references(() => sales.id),
  buyerId: uuid('buyer_id').notNull().references(() => buyers.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  sellerType: text('seller_type').notNull(),
  sellerId: uuid('seller_id').notNull(),
  grade: text('grade').notNull(),
  quantityNominalGrams: integer('quantity_nominal_grams').notNull(),
  totalOwedCents: integer('total_owed_cents').notNull(),
  approvalStatus: text('approval_status').notNull(),
  approvedBy: uuid('approved_by').references(() => masters.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  dueDate: date('due_date').notNull(),
  guarantorType: text('guarantor_type').notNull(),
  guarantorId: uuid('guarantor_id').notNull(),
  guarantorAcceptedAt: timestamp('guarantor_accepted_at', { withTimezone: true }),
  guarantorTermsVersion: text('guarantor_terms_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  saleId: uuid('sale_id').references(() => sales.id),
  creditEntryId: uuid('credit_entry_id').references(() => creditEntries.id),
  method: text('method').notNull(),
  amountCents: integer('amount_cents').notNull(),
  mpesaReceipt: text('mpesa_receipt').unique(),
  payerPhoneE164: text('payer_phone_e164'),
  source: text('source').notNull(),
  recordedByType: text('recorded_by_type').notNull(),
  recordedById: uuid('recorded_by_id').notNull(),
  businessDate: date('business_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const smsOutbox = pgTable('sms_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  toPhoneE164: text('to_phone_e164').notNull(),
  template: text('template').notNull(),
  payload: jsonb('payload').notNull().default({}),
  bodyText: text('body_text').notNull(),
  status: text('status').notNull().default('QUEUED'),
  providerMessageId: text('provider_message_id'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
});

export const expenseCategories = pgTable(
  'expense_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    code: text('code').notNull(),
    label: text('label').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
  },
  (t) => [uniqueIndex('uq_expense_cat_master_code').on(t.masterId, t.code)]
);

export const dailyExpenses = pgTable('daily_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  categoryId: uuid('category_id').notNull().references(() => expenseCategories.id),
  businessDate: date('business_date').notNull(),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  paidVia: text('paid_via').notNull(),
  receiptRef: text('receipt_ref'),
  isPaid: boolean('is_paid').notNull().default(true),
  reviewStatus: text('review_status').notNull(),
  addedByType: text('added_by_type').notNull(),
  addedById: uuid('added_by_id').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => masters.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const casualLaborers = pgTable('casual_laborers', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  businessDate: date('business_date').notNull(),
  workerName: text('worker_name').notNull(),
  task: text('task').notNull(),
  agreedWageCents: integer('agreed_wage_cents').notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  paidVia: text('paid_via'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const marketSessions = pgTable(
  'market_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    businessDate: date('business_date').notNull(),
    marketCloseTime: time('market_close_time').notNull().default('14:00:00'),
    lateSessionOpen: boolean('late_session_open').notNull().default(false),
    lateReason: text('late_reason'),
    lateEndsAt: timestamp('late_ends_at', { withTimezone: true }),
    openedBy: uuid('opened_by').references(() => masters.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('uq_market_session_master_date').on(t.masterId, t.businessDate)]
);

export const dailyReconciliations = pgTable('daily_reconciliations', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  responsibleName: text('responsible_name').notNull(),
  businessDate: date('business_date').notNull(),
  dayNumber: integer('day_number').notNull(),
  openingG1NominalGrams: integer('opening_g1_nominal_grams').notNull(),
  openingG2NominalGrams: integer('opening_g2_nominal_grams').notNull(),
  physicalG1NominalGrams: integer('physical_g1_nominal_grams'),
  physicalG2NominalGrams: integer('physical_g2_nominal_grams'),
  expectedG1NominalGrams: integer('expected_g1_nominal_grams').notNull(),
  expectedG2NominalGrams: integer('expected_g2_nominal_grams').notNull(),
  varianceG1NominalGrams: integer('variance_g1_nominal_grams'),
  varianceG2NominalGrams: integer('variance_g2_nominal_grams'),
  soldG1NominalGrams: integer('sold_g1_nominal_grams').notNull(),
  soldG2NominalGrams: integer('sold_g2_nominal_grams').notNull(),
  expectedPriceG1Cents: integer('expected_price_g1_cents').notNull(),
  expectedPriceG2Cents: integer('expected_price_g2_cents').notNull(),
  negotiationDiscountCents: integer('negotiation_discount_cents').notNull().default(0),
  weightConcessionCents: integer('weight_concession_cents').notNull().default(0),
  sampleAvgWeightG: integer('sample_avg_weight_g'),
  expectedNetWeightG: integer('expected_net_weight_g'),
  weightCheckFlagged: boolean('weight_check_flagged').notNull().default(false),
  cashSalesCents: integer('cash_sales_cents').notNull(),
  mpesaSalesCents: integer('mpesa_sales_cents').notNull(),
  creditSalesCents: integer('credit_sales_cents').notNull(),
  cashRepaymentsCents: integer('cash_repayments_cents').notNull(),
  mpesaRepaymentsCents: integer('mpesa_repayments_cents').notNull(),
  cashExpensesCents: integer('cash_expenses_cents').notNull(),
  mpesaExpensesCents: integer('mpesa_expenses_cents').notNull(),
  expectedCashCents: integer('expected_cash_cents').notNull(),
  actualCashCents: integer('actual_cash_cents'),
  cashDiscrepancyCents: integer('cash_discrepancy_cents'),
  expectedMpesaCents: integer('expected_mpesa_cents').notNull(),
  status: text('status').notNull(),
  masterApprovalStatus: text('master_approval_status').notNull().default('PENDING_MASTER_APPROVAL'),
  approvedBy: uuid('approved_by').references(() => masters.id),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const varianceCases = pgTable('variance_cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  batchId: uuid('batch_id').notNull().references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  reconciliationId: uuid('reconciliation_id').references(() => dailyReconciliations.id),
  responsibleType: text('responsible_type').notNull(),
  responsibleId: uuid('responsible_id').notNull(),
  shortfallNominalGrams: integer('shortfall_nominal_grams').notNull(),
  estimatedValueCents: integer('estimated_value_cents').notNull(),
  status: text('status').notNull().default('OPEN'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const varianceExplanations = pgTable('variance_explanations', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  varianceCaseId: uuid('variance_case_id').notNull().references(() => varianceCases.id),
  version: integer('version').notNull(),
  reasonCode: text('reason_code').notNull(),
  explanationText: text('explanation_text').notNull(),
  submittedByType: text('submitted_by_type').notNull(),
  submittedById: uuid('submitted_by_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const varianceDecisions = pgTable('variance_decisions', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  varianceCaseId: uuid('variance_case_id').notNull().unique().references(() => varianceCases.id),
  decision: text('decision').notNull(),
  chargeAmountCents: integer('charge_amount_cents').notNull().default(0),
  decidedBy: uuid('decided_by').notNull().references(() => masters.id),
  notes: text('notes'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
});

export const liabilityEntries = pgTable('liability_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').notNull().references(() => masters.id),
  salespersonId: uuid('salesperson_id').notNull().references(() => salespeople.id),
  varianceCaseId: uuid('variance_case_id').references(() => varianceCases.id),
  entryType: text('entry_type').notNull(),
  amountCents: integer('amount_cents').notNull(),
  isDisputed: boolean('is_disputed').notNull().default(false),
  disputeNote: text('dispute_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id').references(() => masters.id),
  actorType: text('actor_type').notNull(),
  actorId: uuid('actor_id'),
  actorRole: text('actor_role'),
  deviceId: uuid('device_id'),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id'),
  action: text('action').notNull(),
  outcome: text('outcome').notNull(),
  beforeState: jsonb('before_state'),
  afterState: jsonb('after_state'),
  serverTime: timestamp('server_time', { withTimezone: true }).notNull().defaultNow(),
  clientTime: timestamp('client_time', { withTimezone: true }),
});

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').notNull(),
    masterId: uuid('master_id').notNull().references(() => masters.id),
    actorId: uuid('actor_id').notNull(),
    route: text('route').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.key, t.actorId, t.route] })]
);

export const mpesaStkRequests = pgTable('mpesa_stk_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  masterId: uuid('master_id')
    .notNull()
    .references(() => masters.id),
  batchId: uuid('batch_id').references(() => truckBatches.id),
  assignmentId: uuid('assignment_id').references(() => stockAssignments.id),
  initiatedByType: text('initiated_by_type').notNull(),
  initiatedById: uuid('initiated_by_id').notNull(),
  provider: text('provider').notNull().default('INTASEND'),
  invoiceId: text('invoice_id').unique(),
  apiRef: text('api_ref').notNull().unique(),
  phoneE164: text('phone_e164').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').notNull().default('PENDING'),
  mpesaReceipt: text('mpesa_receipt'),
  failedCode: text('failed_code'),
  failedReason: text('failed_reason'),
  rawResponse: jsonb('raw_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

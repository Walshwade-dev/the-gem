/**
 * Integer-only rounding to nearest whole shilling (100 cents), half-up.
 * total_amount_cents = round_to_shilling(unit_price_per_net_cents * billed_grams / packaging_grams)
 */
export function calculateBilledAmountCents(
  unitPricePerNetCents: number,
  billedGrams: number,
  packagingGrams: number,
  roundingRule: string = 'ROUND_TO_SHILLING'
): number {
  if (packagingGrams <= 0) {
    throw new Error('packagingGrams must be positive');
  }
  const numerator = BigInt(unitPricePerNetCents) * BigInt(billedGrams);
  const denom = BigInt(packagingGrams);

  if (roundingRule === 'NONE') {
    return Number((numerator + denom / 2n) / denom);
  }

  // Round to nearest 100 cents (1 KSh) using integer arithmetic:
  // scaled = (numerator + (denom * 50)) / (denom * 100) * 100
  const hundredDenom = denom * 100n;
  const shillings = (numerator + denom * 50n) / hundredDenom;
  return Number(shillings * 100n);
}

/**
 * NCC Day-1 fee calculation:
 * gross = ncc_counted_nets * rate_per_net_cents
 * payable = max(gross - discount_cents, min_payable_cents)
 */
export function computeNccPayableCents(
  nccCountedNets: number,
  ratePerNetCents: number = 2000,
  discountCents: number = 200000,
  minPayableCents: number = 600000
): number {
  const gross = nccCountedNets * ratePerNetCents;
  return Math.max(gross - discountCents, minPayableCents);
}

/**
 * Derived expected net weight on read (shrinkage never mutates nominal stock):
 * expected_net_weight_g(day) = max(nominal - loss_per_net_per_day_g * days_held, floor_per_net_g)
 */
export function computeExpectedNetWeightGrams(
  nominalNetGrams: number,
  daysHeld: number,
  lossPerNetPerDayGrams: number = 200,
  floorPerNetGrams: number = 18000
): number {
  const raw = nominalNetGrams - lossPerNetPerDayGrams * Math.max(0, daysHeld);
  return Math.max(raw, floorPerNetGrams);
}

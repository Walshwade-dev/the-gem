export function buildPochiPaymentSms(params: {
  pochiNumber: string;
  amountKsh: number;
  itemDesc: string;
  buyerName?: string;
}): string {
  const num = (params.pochiNumber || '0115148000').trim();
  const buyerLine = params.buyerName?.trim() ? `\nBuyer: ${params.buyerName.trim()}` : '';
  return (
    `THE GEM — OFFICIAL PAYMENT DETAILS\n` +
    `Pay via M-Pesa / Pochi la Biashara to:\n` +
    `${num}\n` +
    `Amount: KES ${Math.round(params.amountKsh).toLocaleString()}\n` +
    `Order: ${params.itemDesc}${buyerLine}\n` +
    `Please reply or share your M-Pesa confirmation code after paying.`
  );
}

export function buildThankYouReceiptSms(params: {
  buyerName?: string;
  itemDesc: string;
  amountKsh: number;
  paymentMethod: string;
  mpesaCode?: string;
}): string {
  const greeting = params.buyerName?.trim() ? ` ${params.buyerName.trim()}` : '';
  const codePart = params.mpesaCode?.trim() ? ` (Ref: ${params.mpesaCode.trim()})` : '';
  return (
    `THE GEM — OFFICIAL RECEIPT\n` +
    `Thank you${greeting} for your purchase!\n` +
    `Item: ${params.itemDesc}\n` +
    `Paid: KES ${Math.round(params.amountKsh).toLocaleString()} via ${params.paymentMethod}${codePart}\n` +
    `We appreciate your business!`
  );
}

export function buildCreditAgreementSms(params: {
  buyerName: string;
  nationalId: string;
  quantity: number;
  gradeLabel: string;
  totalAmount: number;
  truckPlate: string;
}): string {
  return (
    `THE GEM — CREDIT ACKNOWLEDGEMENT\n` +
    `Dear ${params.buyerName.trim()} (ID: ${params.nationalId.trim()}), ` +
    `you have taken ${params.quantity} nets of ${params.gradeLabel} on credit ` +
    `worth KES ${Math.round(params.totalAmount).toLocaleString()} (Truck ${params.truckPlate}).\n` +
    `Reply YES to confirm and sign off this credit record.`
  );
}

export function buildSellerOtpInviteSms(params: {
  sellerName: string;
  code: string;
  storeName?: string;
}): string {
  const store = params.storeName?.trim() || 'The Gem';
  return (
    `${store.toUpperCase()} — SELLER LOGIN OTP\n` +
    `Hello ${params.sellerName.trim()}, your one-time access code is:\n` +
    `${params.code}\n` +
    `Open the app -> Sales Login, enter this code to access your account and set up your passphrase. Valid for 24 hours.`
  );
}

export function buildCreditReminderSms(params: {
  customerName: string;
  balanceKsh: number;
  dueDate: string;
  pochiNumber?: string;
  storeName?: string;
}): string {
  const store = params.storeName?.trim() || 'The Gem';
  const pochi = (params.pochiNumber || '0115148000').trim();
  return (
    `${store.toUpperCase()} — CREDIT REPAYMENT REMINDER\n` +
    `Dear ${params.customerName.trim()}, your credit balance of KES ${Math.round(params.balanceKsh).toLocaleString()} is due (${params.dueDate}).\n` +
    `Pay via M-Pesa / Pochi la Biashara to:\n` +
    `${pochi}\n` +
    `Thank you.`
  );
}

export function buildDayClosureReceiptSms(params: {
  sellerName: string;
  storeName: string;
  dateText: string;
  truckPlate?: string;
  g1Sold: number;
  g2Sold: number;
  grossSales: number;
  creditTotal: number;
  expensesTotal: number;
  cashInHand: number;
  mpesaDirect: number;
  totalRemitted: number;
}): string {
  const truckPart = params.truckPlate ? ` | Truck ${params.truckPlate}` : '';
  return (
    `THE GEM — DAY CLOSURE RECEIPT\n` +
    `Store: ${params.storeName}${truckPart}\n` +
    `Date: ${params.dateText}\n` +
    `Seller: ${params.sellerName}\n` +
    `Sold: G1=${params.g1Sold} nets, G2=${params.g2Sold} nets\n` +
    `Gross Sales: KES ${Math.round(params.grossSales).toLocaleString()}\n` +
    `Credit: KES ${Math.round(params.creditTotal).toLocaleString()}\n` +
    `Expenses: KES ${Math.round(params.expensesTotal).toLocaleString()}\n` +
    `Cash In Hand: KES ${Math.round(params.cashInHand).toLocaleString()}\n` +
    `M-Pesa Direct: KES ${Math.round(params.mpesaDirect).toLocaleString()}\n` +
    `TOTAL REMITTED: KES ${Math.round(params.totalRemitted).toLocaleString()}`
  );
}

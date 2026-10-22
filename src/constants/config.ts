// ============================================================================
// Wakulima Market (Marikiti) Operational & Business Configuration
// ============================================================================

export const MARKET_CONFIG = {
  // Physical Stay Regulations at Wakulima Bay
  standardMaxTruckStayDays: 4,      // Standard permitted stay
  negotiatedMaxTruckStayDays: 5,    // Extended stay permitted via negotiation

  // Demurrage & Municipal Nairobi City Council (NCC) Rules
  nccRules: {
    day1BaseCessPerNet: 70,         // On Day 1, NCC counts nets & charges per-net cess (covers Day 1 in full)
    consecutiveDayFlatFee: 1000,    // Days 2 to 4 (and Day 5): NCC does NOT recount nets. They collect flat Ksh 1,000/day
  },
  
  // Daily Mandatory Bay Overheads (Paid daily while truck & sales are active in the market)
  fixedDailyFees: {
    watchman: 100, // Ksh 100 / day for overnight security watchman
    cleaner: 100,  // Ksh 100 / day for market bay cleaning & sanitation
    total: 200,    // Ksh 200 / day combined overhead
  },

  // Target Operating Schedule
  schedule: {
    truckArrivalHour: 5,   // ~05:00 AM EAT (Truck opens & NCC inspects)
    cobReconciliationHour: 14, // ~14:00 PM EAT (Close of Business stock & cash balance)
  },

  // Security & Kenya DPA 2019 Parameters
  security: {
    maxFailedOtpAttempts: 5,
    lockoutDurationMinutes: 15,
    masterAdminPhone: '+254700000001',
    emergencyPanicKey: 'MARIKITI-999-SECURE',
  },

  // Baseline Grade Descriptions
  grades: {
    GRADE_1: {
      code: 'G1',
      label: 'Grade 1 (G1 - Kubwa)',
      description: 'Large, firm, well-cured bulb with intact papery skin. Premium price.',
      defaultBaselinePrice: 2600, // Ksh
    },
    GRADE_2: {
      code: 'G2',
      label: 'Grade 2 (G2 - Wastani/Ndogo)',
      description: 'Medium to smaller size bulbs. Quick moving for retail mama mbogas.',
      defaultBaselinePrice: 2100, // Ksh
    }
  }
};

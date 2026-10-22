// ============================================================================
// Wakulima Market (Marikiti) Operational & Business Configuration
// ============================================================================

export const MARKET_CONFIG = {
  // Physical Stay Regulations
  maxTruckStayDays: 4,
  
  // Demurrage (Overstay penalty fees per consecutive day)
  demurrageRatePerConsecutiveDay: 1000, // Ksh 1,000 / day after Day 1
  
  // Daily Mandatory Bay Fees
  fixedDailyFees: {
    watchman: 100, // Ksh 100 / day for overnight security
    cleaner: 100,  // Ksh 100 / day for market sanitation
    total: 200,    // Ksh 200 / day combined
  },

  // Target Operating Schedule
  schedule: {
    truckArrivalHour: 5,   // ~05:00 AM EAT
    cobReconciliationHour: 14, // ~14:00 PM EAT
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

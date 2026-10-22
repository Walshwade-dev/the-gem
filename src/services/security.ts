// ============================================================================
// The Gem: Security, Tamper Watchdog & Kenya DPA 2019 Compliance Layer
// ============================================================================

import { SecurityState, UserRole } from '../types';
import { MARKET_CONFIG } from '../constants/config';

export interface OtpSession {
  phoneNumber: string;
  expectedOtp: string;
  expiresAt: number; // epoch ms
  attempts: number;
  role: UserRole;
  userName: string;
}

// In-memory security vault (persisted to secure storage in production)
let currentSecurityState: SecurityState = {
  isLockedDown: false,
  lockdownReason: undefined,
  lockdownTimestamp: undefined,
  failedAuthAttempts: 0,
  maxFailedAttemptsBeforeLockout: MARKET_CONFIG.security.maxFailedOtpAttempts,
  isBiometricsAvailable: false,
  activeSessionRole: 'MERCHANT',
  activeUserId: 'usr-merchant-01',
  activeUserName: 'Main Merchant (Admin)',
  activeUserPhone: '+254712345678',
};

// Active OTP verification cache
let activeOtpSession: OtpSession | null = null;

/**
 * Initiates Phone + SMS OTP Request
 */
export function requestSmsOtp(phoneNumber: string, role: UserRole, userName: string): { success: boolean; message: string; mockOtp?: string } {
  if (currentSecurityState.isLockedDown) {
    return {
      success: false,
      message: 'System is currently LOCKED DOWN for security. Contact Master Admin.'
    };
  }

  // Sanitize phone number (Kenyan format e.g. +254 7XX XXX XXX or 07XX...)
  let cleanPhone = phoneNumber.replace(/\s+/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '+254' + cleanPhone.slice(1);
  } else if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  // Generate 6-digit OTP code (Deterministic mock 123456 or random in production)
  const mockOtp = '123456'; 
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minute validity

  activeOtpSession = {
    phoneNumber: cleanPhone,
    expectedOtp: mockOtp,
    expiresAt,
    attempts: 0,
    role,
    userName
  };

  return {
    success: true,
    message: `OTP sent to ${maskPhoneNumber(cleanPhone)}. (Dev Mock Code: ${mockOtp})`,
    mockOtp
  };
}

/**
 * Verifies entered OTP against active session
 */
export function verifySmsOtp(enteredOtp: string): { success: boolean; message: string; role?: UserRole } {
  if (currentSecurityState.isLockedDown) {
    return {
      success: false,
      message: 'System is locked down. Master unlock required.'
    };
  }

  if (!activeOtpSession) {
    return {
      success: false,
      message: 'No active OTP session found. Please request a new OTP.'
    };
  }

  if (Date.now() > activeOtpSession.expiresAt) {
    activeOtpSession = null;
    return {
      success: false,
      message: 'OTP has expired. Please request a new one.'
    };
  }

  activeOtpSession.attempts += 1;

  if (enteredOtp.trim() === activeOtpSession.expectedOtp) {
    // Auth Successful
    const authenticatedRole = activeOtpSession.role;
    currentSecurityState = {
      ...currentSecurityState,
      failedAuthAttempts: 0,
      activeSessionRole: authenticatedRole,
      activeUserId: `usr-${Date.now()}`,
      activeUserName: activeOtpSession.userName,
      activeUserPhone: activeOtpSession.phoneNumber
    };

    activeOtpSession = null;
    return {
      success: true,
      message: 'Authentication successful.',
      role: authenticatedRole
    };
  }

  // Failed Attempt Counter
  currentSecurityState.failedAuthAttempts += 1;

  if (currentSecurityState.failedAuthAttempts >= currentSecurityState.maxFailedAttemptsBeforeLockout) {
    triggerSecurityLockdown('Excessive failed OTP attempts detected. System locked for security.');
    return {
      success: false,
      message: 'SECURITY BREACH TRIGGERED: Maximum failed attempts exceeded. Device locked down.'
    };
  }

  return {
    success: false,
    message: `Invalid OTP. ${currentSecurityState.maxFailedAttemptsBeforeLockout - currentSecurityState.failedAuthAttempts} attempts remaining before lockdown.`
  };
}

/**
 * Emergency Kill-Switch: Locks down the application completely
 */
export function triggerSecurityLockdown(reason: string): SecurityState {
  currentSecurityState = {
    ...currentSecurityState,
    isLockedDown: true,
    lockdownReason: reason,
    lockdownTimestamp: new Date().toISOString(),
  };

  // In production, revoke tokens and clear cached credentials
  activeOtpSession = null;
  return currentSecurityState;
}

/**
 * Unlocks the system using the Master Admin Recovery Key
 */
export function unlockSystemWithMasterKey(recoveryKey: string): { success: boolean; message: string } {
  if (recoveryKey.trim() === MARKET_CONFIG.security.emergencyPanicKey) {
    currentSecurityState = {
      ...currentSecurityState,
      isLockedDown: false,
      lockdownReason: undefined,
      lockdownTimestamp: undefined,
      failedAuthAttempts: 0,
      activeSessionRole: 'MERCHANT', // Restores to Merchant Admin
    };
    return {
      success: true,
      message: 'Security lockdown successfully cleared by Master Admin.'
    };
  }

  return {
    success: false,
    message: 'Invalid Master Recovery Key. Contact System Administrator.'
  };
}

/**
 * Returns current security state
 */
export function getSecurityState(): SecurityState {
  return { ...currentSecurityState };
}

/**
 * Kenya DPA 2019: Phone Masking Utility
 * Masks customer phone number for display unless explicit decrypt is triggered
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return '****';
  const clean = phone.trim();
  const start = clean.slice(0, 4);
  const end = clean.slice(-3);
  return `${start} *** *${end}`;
}

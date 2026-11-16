import { useEffect, useRef } from 'react';
import { AppState, NativeModules, PermissionsAndroid, Platform, type Permission } from 'react-native';
import { apiFetch } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import { buildCreditReminderSms } from '../utils/smsTemplates';

export interface SimSlotInfo {
  subscriptionId: number;
  slotIndex: number;
  carrierName: string;
  displayName: string;
  isDefaultSmsSim: boolean;
  phoneNumber?: string;
}

interface SmsGatewayNative {
  getActiveSims?: () => Promise<SimSlotInfo[]>;
  sendSms?: (phone: string, msg: string, subscriptionId: number) => Promise<boolean>;
}

interface OutboxItem {
  id: string;
  toPhoneE164: string;
  bodyText: string;
}

export function normalizeKenyaE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length >= 10) return `+254${digits.slice(1)}`;
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return `+254${digits}`;
  }
  return raw.trim().startsWith('+') ? raw.trim() : `+${digits}`;
}

export async function ensureSimSmsPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const perms: Permission[] = [
    PermissionsAndroid.PERMISSIONS.SEND_SMS,
    PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
  ];
  if (Number(Platform.Version) >= 33 && PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS) {
    perms.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_NUMBERS);
  }
  const checks = await Promise.all(perms.map((p) => PermissionsAndroid.check(p)));
  if (checks.every(Boolean)) return true;

  const result = await PermissionsAndroid.requestMultiple(perms);
  return result[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED;
}

export async function listActiveSims(): Promise<SimSlotInfo[]> {
  if (Platform.OS !== 'android') return [];
  const smsMod = NativeModules.SmsGatewayModule as SmsGatewayNative | undefined;
  if (!smsMod?.getActiveSims) return [];
  try {
    return await smsMod.getActiveSims();
  } catch {
    return [];
  }
}

export async function sendDirectSimSms(
  phone: string,
  message: string,
  subscriptionId?: number | null
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    throw new Error('Direct SIM SMS is only supported on Android');
  }
  const smsMod = NativeModules.SmsGatewayModule as SmsGatewayNative | undefined;
  if (!smsMod?.sendSms) {
    throw new Error('SmsGatewayModule is not linked in this build');
  }
  const hasPerm = await ensureSimSmsPermissions();
  if (!hasPerm) {
    throw new Error('SEND_SMS permission is required');
  }
  return smsMod.sendSms(phone, message, subscriptionId ?? -1);
}

/** Polls /sms-gateway/outbox on Master's Android phone and dispatches queued SMS via native SIM. */
export function useSimSmsGateway(): void {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const role = useAppStore((s) => s.role);
  const simSmsGatewayEnabled = useAppStore((s) => s.simSmsGatewayEnabled);
  const selectedSimSubId = useAppStore((s) => s.selectedSimSubId);
  const incrementSimSmsSent = useAppStore((s) => s.incrementSimSmsSent);
  const busyRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isAuthenticated || role !== 'MERCHANT' || !simSmsGatewayEnabled) {
      return;
    }

    const smsMod = NativeModules.SmsGatewayModule as SmsGatewayNative | undefined;
    if (!smsMod?.sendSms) return;

    const drainOutbox = async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const hasPerm = await ensureSimSmsPermissions();
        if (!hasPerm) return;

        // 1. Auto-send due/overdue credit repayment reminders (max 1 per record per day)
        const state = useAppStore.getState();
        const todayYmd = new Date().toISOString().slice(0, 10);
        for (const customer of state.customerCredits ?? []) {
          const phone = (customer.customerPhone || '').trim();
          if (phone.replace(/\D/g, '').length < 9) continue;
          for (const rec of customer.records ?? []) {
            if (rec.status === 'SETTLED' || rec.approvalStatus === 'REJECTED') continue;
            const balance = Math.max(0, rec.totalOwed - rec.amountPaid);
            if (balance <= 0) continue;
            const due = rec.dueDate?.slice(0, 10);
            if (!due || todayYmd < due) continue;
            if (state.sentCreditReminderKeys?.[rec.id] === todayYmd) continue;

            state.markCreditReminderSent(rec.id, todayYmd);
            try {
              const reminderBody = buildCreditReminderSms({
                customerName: customer.customerName || 'Customer',
                balanceKsh: balance,
                dueDate: due,
                pochiNumber: state.pochiPhoneNumber,
                storeName: state.storeName,
              });
              await smsMod.sendSms!(normalizeKenyaE164(phone), reminderBody, selectedSimSubId ?? -1);
              incrementSimSmsSent();
            } catch {
              // Keep marked for today so transient failures don't spam; next day retries
            }
          }
        }

        // 2. Drain backend /sms-gateway/outbox
        const res = await apiFetch<{ messages: OutboxItem[] }>('/sms-gateway/outbox');
        for (const msg of res.messages ?? []) {
          try {
            await smsMod.sendSms!(msg.toPhoneE164, msg.bodyText, selectedSimSubId ?? -1);
            await apiFetch('/sms-gateway/ack', {
              method: 'POST',
              body: { id: msg.id, status: 'SENT' },
            });
            incrementSimSmsSent();
          } catch (err) {
            await apiFetch('/sms-gateway/ack', {
              method: 'POST',
              body: {
                id: msg.id,
                status: 'FAILED',
                error: err instanceof Error ? err.message : 'SIM send failed',
              },
            }).catch(() => undefined);
          }
        }
      } catch {
        // Ignore transient network errors; next poll will retry
      } finally {
        busyRef.current = false;
      }
    };

    void drainOutbox();
    const interval = setInterval(() => {
      void drainOutbox();
    }, 15000);
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void drainOutbox();
      }
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [isAuthenticated, role, simSmsGatewayEnabled, selectedSimSubId, incrementSimSmsSent]);
}

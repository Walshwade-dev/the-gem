import { eq } from 'drizzle-orm';
import type { AppDb } from '../db/pool.js';
import { smsOutbox } from '../db/schema.js';

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  send(toPhoneE164: string, body: string): Promise<SmsSendResult>;
}

export class ConsoleSmsProvider implements SmsProvider {
  public readonly sentMessages: Array<{ to: string; body: string; id: string }> = [];

  async send(toPhoneE164: string, body: string): Promise<SmsSendResult> {
    const id = `console-sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.sentMessages.push({ to: toPhoneE164, body, id });
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[ConsoleSMS] -> ${toPhoneE164}: ${body}`);
    }
    return { success: true, providerMessageId: id };
  }
}

export class AfricasTalkingSmsProvider implements SmsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly username: string,
    private readonly senderId: string
  ) {}

  async send(toPhoneE164: string, body: string): Promise<SmsSendResult> {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        username: this.username,
        to: toPhoneE164,
        message: body,
        from: this.senderId,
      }),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      SMSMessageData?: { Recipients?: Array<{ messageId?: string }> };
    };
    const msgId = data.SMSMessageData?.Recipients?.[0]?.messageId;
    return { success: true, providerMessageId: msgId };
  }
}

export async function processSmsOutbox(db: AppDb, provider: SmsProvider) {
  const queued = await db
    .select()
    .from(smsOutbox)
    .where(eq(smsOutbox.status, 'QUEUED'))
    .limit(50);

  for (const row of queued) {
    const result = await provider.send(row.toPhoneE164, row.bodyText);
    await db
      .update(smsOutbox)
      .set({
        status: result.success ? 'SENT' : 'FAILED',
        providerMessageId: result.providerMessageId ?? null,
        attempts: row.attempts + 1,
        sentAt: result.success ? new Date() : null,
      })
      .where(eq(smsOutbox.id, row.id));
  }
}

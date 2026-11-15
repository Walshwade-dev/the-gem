import type { FastifyReply } from 'fastify';
import { and, eq } from 'drizzle-orm';
import type { AppDb } from '../db/pool.js';
import { pushTokens } from '../db/schema.js';

export interface NotificationEvent {
  type: string;
  masterId: string;
  targetUserType?: 'MASTER' | 'SELLER' | 'ALL';
  targetUserId?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface Notifier {
  notify(event: NotificationEvent): Promise<void>;
}

interface SseClient {
  id: string;
  masterId: string;
  userType: 'MASTER' | 'SELLER';
  userId: string;
  reply: FastifyReply;
}

export class SseHub {
  private clients: SseClient[] = [];

  addClient(client: SseClient) {
    this.clients.push(client);
  }

  removeClient(id: string) {
    this.clients = this.clients.filter((c) => c.id !== id);
  }

  broadcast(event: NotificationEvent) {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const c of this.clients) {
      if (c.masterId !== event.masterId) continue;
      if (
        event.targetUserType &&
        event.targetUserType !== 'ALL' &&
        c.userType !== event.targetUserType
      ) {
        continue;
      }
      if (event.targetUserId && c.userId !== event.targetUserId) {
        continue;
      }
      try {
        c.reply.raw.write(payload);
      } catch {
        this.removeClient(c.id);
      }
    }
  }
}

export class CompositeNotifier implements Notifier {
  constructor(
    private readonly db: AppDb,
    private readonly sseHub: SseHub,
    private readonly expoAccessToken?: string
  ) {}

  async notify(event: NotificationEvent): Promise<void> {
    this.sseHub.broadcast(event);

    const conditions = [eq(pushTokens.masterId, event.masterId)];
    if (event.targetUserType && event.targetUserType !== 'ALL') {
      conditions.push(eq(pushTokens.userType, event.targetUserType));
    }
    if (event.targetUserId) {
      conditions.push(eq(pushTokens.userId, event.targetUserId));
    }

    const tokens = await this.db
      .select()
      .from(pushTokens)
      .where(and(...conditions));

    if (tokens.length === 0 || process.env.NODE_ENV === 'test') return;

    const messages = tokens.map((t) => ({
      to: t.expoPushToken,
      sound: 'default',
      title: event.title,
      body: event.body,
      data: event.data ?? {},
    }));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (this.expoAccessToken) {
      headers.Authorization = `Bearer ${this.expoAccessToken}`;
    }

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(messages),
    }).catch(() => {});
  }
}

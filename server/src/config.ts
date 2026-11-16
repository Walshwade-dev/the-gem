import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  MIGRATOR_DATABASE_URL: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SECRET: z.string().optional(),
  SELLER_JWT_SECRET: z.string().min(16).default('dev-seller-jwt-secret-change-in-prod-32c'),
  SMS_PROVIDER: z.enum(['console', 'africastalking', 'sim_gateway']).default('sim_gateway'),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().default('THEGEM'),
  EXPO_PUSH_ACCESS_TOKEN: z.string().optional(),
  INTASEND_SECRET_KEY: z.string().optional(),
  INTASEND_PUBLISHABLE_KEY: z.string().optional(),
  INTASEND_WEBHOOK_CHALLENGE: z.string().optional(),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(): AppConfig {
  return EnvSchema.parse(process.env);
}

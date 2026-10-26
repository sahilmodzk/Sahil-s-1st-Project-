import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import { db } from './db';
import { sendPasswordReset } from './mail';
import { consumeRateLimit } from './rate-limit';

const username = z.string().trim().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 lowercase letters, numbers, or underscores.');
function validateProfile(user: Record<string, unknown>) {
  if (user.name !== undefined && (typeof user.name !== 'string' || user.name.trim().length < 1 || user.name.trim().length > 60)) {
    throw new APIError('BAD_REQUEST', { message: 'Display name must contain 1–60 characters.' });
  }
  if (user.image !== undefined && user.image !== null && (typeof user.image !== 'string' || !/^\/api\/media\/[a-zA-Z0-9_-]{1,100}\.webp$/.test(user.image))) {
    throw new APIError('BAD_REQUEST', { message: 'Please upload an image before using it.' });
  }
}

export const auth = betterAuth({
  appName: 'Gather',
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: 'postgresql', transaction: true }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => sendPasswordReset(user.email, url),
  },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      username: { type: 'string', required: true, input: true, unique: true, validator: { input: username } },
      bio: { type: 'string', required: false, defaultValue: '', input: false },
      role: { type: 'string', required: false, defaultValue: 'USER', input: false },
    },
  },
  databaseHooks: {
    user: {
      create: { before: async user => {
        validateProfile(user);
        const result = username.safeParse(user.username);
        if (!result.success) throw new APIError('BAD_REQUEST', { message: 'Choose a username with 3–24 lowercase letters, numbers, or underscores.' });
        if (await db.user.findUnique({ where: { username: result.data } })) throw new APIError('CONFLICT', { message: 'This username is already taken.' });
        return { data: { ...user, name: user.name.trim(), username: result.data, role: 'USER' } };
      } },
      update: { before: async user => {
        validateProfile(user);
        if (user.username !== undefined && !username.safeParse(user.username).success) throw new APIError('BAD_REQUEST', { message: 'Invalid username.' });
        return { data: { ...user, ...(typeof user.name === 'string' ? { name: user.name.trim() } : {}) } };
      } },
    },
  },
  rateLimit: { enabled: true, window: 60, max: 60, customStorage: { consume: (key, rule) => consumeRateLimit(`auth:${key}`, rule.max, rule.window) }, customRules: {
    '/sign-in/email': { window: 60, max: 10 },
    '/sign-up/email': { window: 60, max: 5 },
    '/request-password-reset': { window: 60, max: 3 },
    '/reset-password': { window: 60, max: 5 },
  } },
  advanced: { useSecureCookies: process.env.NODE_ENV === 'production' && process.env.BETTER_AUTH_URL?.startsWith('https://') === true },
});

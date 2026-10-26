import { test, expect, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { unlink } from 'node:fs/promises';
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
test.afterAll(async () => { await db.$disconnect(); });

const origin = process.env.E2E_BASE_URL || 'http://localhost:3000';
const suffix = randomUUID().replaceAll('-', '').slice(0, 9);
const password = 'GatherTest123!';

test('HTTP authentication, permissions, persistent social actions, and validated uploads', async ({ playwright }) => {
  const alice = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const bob = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const anonymous = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin } });
  const createdUsers: string[] = [];
  let uploadedUrl: string | undefined;
  const register = async (client: APIRequestContext, name: string) => {
    const response = await client.post('/api/auth/sign-up/email', { data: { name, email: `${name}-${suffix}@example.test`, username: `${name}_${suffix}`, password, role: 'ADMIN' } });
    expect(response.status(), await response.text()).toBe(200);
    const id = (await response.json()).user.id as string;
    createdUsers.push(id);
    return id;
  };
  try {
    expect((await anonymous.get('/api/social?resource=feed')).status()).toBe(401);
    const aliceId = await register(alice, 'alice');
    const bobId = await register(bob, 'bob');
    const mutate = async (client: APIRequestContext, data: Record<string, unknown>, status = 200) => {
      const response = await client.post('/api/social', { data });
      expect(response.status(), await response.text()).toBe(status);
      return response.json();
    };
    const profile = await (await alice.get('/api/social?resource=settings')).json();
    expect(profile.user.role).toBe('USER');
    expect((await alice.get('/api/social?resource=admin')).status()).toBe(403);
    expect((await alice.post('/api/social', { headers: { Origin: 'https://untrusted.example' }, data: { action: 'createPost', content: 'Must not persist' } })).status()).toBe(403);

    const image = await sharp({ create: { width: 24, height: 24, channels: 3, background: '#5268ec' } }).png().toBuffer();
    const upload = await alice.post('/api/upload', { multipart: { file: { name: 'sample.png', mimeType: 'image/png', buffer: image } } });
    expect(upload.status(), await upload.text()).toBe(201);
    const imageUrl = (await upload.json()).url as string;
    uploadedUrl = imageUrl;
    const media = await anonymous.get(imageUrl);
    expect(media.status()).toBe(200);
    expect(media.headers()['content-type']).toBe('image/webp');
    const invalidImage = await alice.post('/api/upload', { multipart: { file: { name: 'invalid.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') } } });
    expect(invalidImage.status()).toBe(400);

    await mutate(alice, { action: 'createPost', content: `Persistent post ${suffix}`, image: imageUrl });
    const timeline = await (await alice.get('/api/social?resource=feed')).json();
    const post = timeline.posts.find((item: { content: string }) => item.content === `Persistent post ${suffix}`);
    expect(post).toBeTruthy();
    expect(post.image).toBe(imageUrl);
    await mutate(bob, { action: 'editPost', postId: post.id, content: 'Stolen edit' }, 403);
    await mutate(bob, { action: 'deletePost', postId: post.id }, 403);
    await mutate(bob, { action: 'follow', userId: aliceId });
    await mutate(bob, { action: 'like', postId: post.id });
    await mutate(bob, { action: 'bookmark', postId: post.id });
    await mutate(bob, { action: 'comment', postId: post.id, content: `A thoughtful comment ${suffix}` });
    const detail = await (await bob.get(`/api/social?resource=post&postId=${post.id}`)).json();
    expect(detail.post.liked).toBe(true);
    expect(detail.post.bookmarked).toBe(true);
    expect(detail.post._count.likes).toBe(1);
    expect(detail.post._count.comments).toBe(1);
    const comment = detail.post.comments.find((item: { content: string }) => item.content === `A thoughtful comment ${suffix}`);
    expect(comment).toBeTruthy();
    const bookmarks = await (await bob.get('/api/social?resource=bookmarks')).json();
    expect(bookmarks.posts.some((item: { id: string }) => item.id === post.id)).toBe(true);
    const notifications = await (await alice.get('/api/social?resource=notifications')).json();
    expect(notifications.notifications.filter((item: { actor: { id: string } }) => item.actor.id === bobId)).toHaveLength(3);
    const search = await (await bob.get(`/api/social?resource=search&q=${encodeURIComponent(`Persistent post ${suffix}`)}`)).json();
    expect(search.posts.some((item: { id: string }) => item.id === post.id)).toBe(true);

    await mutate(bob, { action: 'report', postId: post.id, reason: 'Integration test content report' });
    await mutate(alice, { action: 'block', userId: bobId });
    const blockedFeed = await (await bob.get('/api/social?resource=explore')).json();
    expect(blockedFeed.posts.some((item: { id: string }) => item.id === post.id)).toBe(false);
    expect((await bob.get(`/api/social?resource=post&postId=${post.id}`)).status()).toBe(404);
    await mutate(bob, { action: 'like', postId: post.id }, 404);
    await mutate(alice, { action: 'unblock', userId: bobId });
    await mutate(bob, { action: 'deleteComment', commentId: comment.id });
    await mutate(bob, { action: 'unlike', postId: post.id });
    await mutate(bob, { action: 'unbookmark', postId: post.id });
    await mutate(alice, { action: 'editPost', postId: post.id, content: `Edited post ${suffix}` });
    await mutate(alice, { action: 'deletePost', postId: post.id });
    expect((await alice.get(`/api/social?resource=post&postId=${post.id}`)).status()).toBe(404);
    expect((await alice.post('/api/auth/sign-out', { data: {} })).status()).toBe(200);
    expect((await alice.get('/api/social?resource=feed')).status()).toBe(401);
    expect((await alice.post('/api/auth/sign-in/email', { data: { email: `alice-${suffix}@example.test`, password: 'WrongPassword123!' } })).status()).toBe(401);
    expect((await alice.post('/api/auth/sign-in/email', { data: { email: `alice-${suffix}@example.test`, password } })).status()).toBe(200);
  } finally {
    await db.user.deleteMany({ where: { id: { in: createdUsers } } });
    if (uploadedUrl) await unlink(path.join(process.cwd(), 'uploads', path.basename(uploadedUrl))).catch(() => {});
    await alice.dispose(); await bob.dispose(); await anonymous.dispose();
  }
});

test('password reset delivers a usable, single-use local development reset link', async ({ request }) => {
  let createdUserId: string | undefined;
  let mailFile: string | undefined;
  try {
  const email = `reset-${suffix}@example.test`;
  const headers = { Origin: origin };
  const signup = await request.post('/api/auth/sign-up/email', { headers, data: { name: 'Reset Tester', username: `reset_${suffix}`, email, password } });
  expect(signup.status(), await signup.text()).toBe(200);
  createdUserId = (await signup.json()).user.id;
  const response = await request.post('/api/auth/request-password-reset', { headers, data: { email, redirectTo: `${origin}/?reset=true` } });
  expect(response.status(), await response.text()).toBe(200);
  const directory = path.join(process.cwd(), '.local', 'mail');
  let message: { to: string; url: string } | undefined;
  await expect.poll(async () => {
    const files = await readdir(directory).catch(() => []);
    for (const file of files) {
      const mail = JSON.parse(await readFile(path.join(directory, file), 'utf8')) as { to: string; url: string };
      if (mail.to === email) { message = mail; mailFile = path.join(directory, file); }
    }
    return Boolean(message);
  }).toBe(true);
  const url = new URL(message!.url);
  const token = url.searchParams.get('token') || url.pathname.split('/').pop();
  expect(token).toBeTruthy();
  const reset = await request.post('/api/auth/reset-password', { headers, data: { token, newPassword: 'GatherChanged123!' } });
  expect(reset.status(), await reset.text()).toBe(200);
  const reused = await request.post('/api/auth/reset-password', { headers, data: { token, newPassword: 'GatherReused123!' } });
  expect(reused.status()).toBe(400);
  await request.post('/api/auth/sign-out', { headers, data: {} });
  expect((await request.post('/api/auth/sign-in/email', { headers, data: { email, password } })).status()).toBe(401);
  expect((await request.post('/api/auth/sign-in/email', { headers, data: { email, password: 'GatherChanged123!' } })).status()).toBe(200);
  } finally {
    if (createdUserId) await db.user.deleteMany({ where: { id: createdUserId } });
    if (mailFile) await unlink(mailFile).catch(() => {});
  }
});

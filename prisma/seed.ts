import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { hashPassword } from 'better-auth/crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

if (existsSync('.env')) process.loadEnvFile('.env');
if (process.env.NODE_ENV === 'production') throw new Error('Development seed is disabled in production.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function illustration(name: string, palette: string[]) {
  const file = path.join(process.cwd(), 'uploads', name);
  if (existsSync(file)) return;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="45"/></filter></defs><rect width="1200" height="720" fill="url(#bg)"/><circle cx="1050" cy="60" r="230" fill="${palette[2]}" opacity=".7" filter="url(#blur)"/><circle cx="180" cy="660" r="260" fill="${palette[2]}" opacity=".3" filter="url(#blur)"/><g fill="none" stroke="${palette[3]}" stroke-width="2" opacity=".5"><ellipse cx="600" cy="360" rx="340" ry="180" transform="rotate(-30 600 360)"/><ellipse cx="600" cy="360" rx="340" ry="180" transform="rotate(30 600 360)"/><ellipse cx="600" cy="360" rx="180" ry="300"/></g><circle cx="600" cy="360" r="100" fill="${palette[3]}" opacity=".8"/><circle cx="790" cy="135" r="18" fill="${palette[3]}"/></svg>`;
  await writeFile(file, await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer());
}

async function main() {
  await mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  await illustration('seed-orbit.webp', ['#233c69', '#8884d4', '#e9aeae', '#f8edce']);
  await illustration('seed-garden.webp', ['#143d35', '#739a75', '#d8e2b7', '#f2e8c9']);
  const definitions = [
    { id: 'seed-demo', email: 'demo@gather.local', name: 'Alex Morgan', username: 'alexmorgan', bio: 'Collecting little moments. Building things for people, with people. ✨', password: 'GatherDemo123!', role: 'USER' },
    { id: 'seed-maya', email: 'maya@gather.local', name: 'Maya Chen', username: 'mayachen', bio: 'Designer, weekend wanderer, and believer in the beautiful ordinary.', password: 'GatherDemo123!', role: 'USER' },
    { id: 'seed-theo', email: 'theo@gather.local', name: 'Theo Parker', username: 'theoparker', bio: 'A little code, a lot of coffee. Making room for good ideas.', password: 'GatherDemo123!', role: 'USER' },
    { id: 'seed-admin', email: 'admin@gather.local', name: 'Gather Team', username: 'gatherteam', bio: 'Keeping this little corner of the internet welcoming. Say hello! 👋', password: 'GatherAdmin123!', role: 'ADMIN' },
  ];
  const users = [];
  for (const { password, ...data } of definitions) {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) { users.push(existing); continue; }
    const user = await db.user.create({ data: {
      ...data,
      emailVerified: true,
      accounts: { create: { id: `${data.id}-account`, accountId: data.id, providerId: 'credential', password: await hashPassword(password) } },
    } });
    users.push(user);
  }
  const [alex, maya, theo, admin] = users;
  const posts = [
    { id: 'seed-post-welcome', authorId: admin.id, content: 'Welcome to Gather. A place for your people, your ideas, and everything in between. Introduce yourself in the comments — we’re glad you’re here. 🌱' },
    { id: 'seed-post-orbit', authorId: maya.id, content: 'A small visual experiment from this morning. Playing with soft gradients, a few imperfect circles, and the idea that everything is connected. What have you been making lately?', image: '/api/media/seed-orbit.webp' },
    { id: 'seed-post-morning', authorId: alex.id, content: 'Today’s reminder: you don’t have to turn every hobby into a side hustle. Some things are allowed to just make you happy. ☕' },
    { id: 'seed-post-build', authorId: theo.id, content: 'Shipped a tiny project today that I’ve been putting off for weeks. Turns out “done” feels a lot better than “almost perfect.” What’s one small thing you finished this week?' },
    { id: 'seed-post-garden', authorId: maya.id, content: 'Stepping away from the screen and finding inspiration in quieter places. This palette is coming home with me. 🌿', image: '/api/media/seed-garden.webp' },
    { id: 'seed-post-question', authorId: alex.id, content: 'Looking for your favorite book, album, or film that made you see things a little differently. Drop a recommendation below — my weekend needs a new rabbit hole.' },
    { id: 'seed-post-open', authorId: theo.id, content: 'The best part of making things on the internet is meeting people who care about the same oddly specific things you do. Here’s to more of that.' },
    { id: 'seed-post-kindness', authorId: admin.id, content: 'A gentle community note: be curious, be kind, and give people room to learn. If something feels wrong, you can report a post from its menu and our team will review it.' },
  ];
  for (let i = 0; i < posts.length; i++) {
    await db.post.upsert({ where: { id: posts[i].id }, create: { ...posts[i], createdAt: new Date(Date.now() - (i + 1) * 45 * 60_000) }, update: {} });
  }
  for (const [followerId, followingId] of [[alex.id, maya.id], [alex.id, theo.id], [alex.id, admin.id], [maya.id, alex.id], [theo.id, alex.id], [maya.id, theo.id]]) {
    await db.follow.upsert({ where: { followerId_followingId: { followerId, followingId } }, create: { followerId, followingId }, update: {} });
  }
  for (const [userId, postId] of [[alex.id, 'seed-post-orbit'], [theo.id, 'seed-post-orbit'], [maya.id, 'seed-post-morning'], [theo.id, 'seed-post-morning'], [maya.id, 'seed-post-build']]) {
    await db.like.upsert({ where: { userId_postId: { userId, postId } }, create: { userId, postId }, update: {} });
  }
  await db.bookmark.upsert({ where: { userId_postId: { userId: alex.id, postId: 'seed-post-garden' } }, create: { userId: alex.id, postId: 'seed-post-garden' }, update: {} });
  for (const comment of [
    { id: 'seed-comment-1', userId: alex.id, postId: 'seed-post-orbit', content: 'These colors feel like a daydream. Love this, Maya.' },
    { id: 'seed-comment-2', userId: maya.id, postId: 'seed-post-morning', content: 'Needed to hear this today. Keeping my sketchbook just for me.' },
    { id: 'seed-comment-3', userId: theo.id, postId: 'seed-post-question', content: 'Perfect Days. A beautiful reminder to notice the everyday.' },
  ]) await db.comment.upsert({ where: { id: comment.id }, create: comment, update: {} });
  for (const notification of [
    { id: 'seed-notification-1', userId: alex.id, actorId: maya.id, type: 'FOLLOW' },
    { id: 'seed-notification-2', userId: alex.id, actorId: theo.id, type: 'LIKE', postId: 'seed-post-morning' },
    { id: 'seed-notification-3', userId: alex.id, actorId: maya.id, type: 'COMMENT', postId: 'seed-post-morning' },
  ]) await db.notification.upsert({ where: { id: notification.id }, create: notification, update: {} });
  console.log('Development sample data is available. Existing accounts and passwords were preserved.');
  console.log('Newly created demo: demo@gather.local / GatherDemo123!');
  console.log('Newly created admin: admin@gather.local / GatherAdmin123!');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from './db';

export class SocialError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Viewer = { id: string };
const publicUser = { id: true, name: true, username: true, image: true } as const;
const idSchema = z.string().min(1).max(128);
const imageSchema = z.string().regex(/^\/api\/media\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)$/).max(200).nullable().optional();
const contentSchema = z.string().trim().max(2000);
const userSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Username must be 3–24 letters, numbers, or underscores');
const postInput = z.object({ content: contentSchema, image: imageSchema }).refine(v => v.content.length > 0 || !!v.image, 'Add text or an image');
const LIMIT = 15;
const postInclude = (viewerId: string) => ({
  author: { select: publicUser },
  _count: { select: { likes: true, comments: true } },
  likes: { where: { userId: viewerId }, select: { userId: true } },
  bookmarks: { where: { userId: viewerId }, select: { userId: true } },
}) satisfies Prisma.PostInclude;
type IncludedPost = Prisma.PostGetPayload<{ include: ReturnType<typeof postInclude> }>;
const serializePost = (p: IncludedPost) => {
  const { likes, bookmarks, ...post } = p;
  return { ...post, liked: likes.length > 0, bookmarked: bookmarks.length > 0 };
};
const encode = (id: string) => Buffer.from(id).toString('base64url');
function cursor(q: URLSearchParams, key = 'cursor'): { cursor?: { id: string }; skip?: number } {
  const raw = q.get(key);
  if (!raw) return {};
  if (raw.length > 256 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new SocialError(400, 'Invalid page cursor');
  const id = Buffer.from(raw, 'base64url').toString();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new SocialError(400, 'Invalid page cursor');
  return { cursor: { id }, skip: 1 };
}
function page<T extends { id: string }>(rows: T[]) {
  const more = rows.length > LIMIT;
  const items = rows.slice(0, LIMIT);
  return { items, nextCursor: more ? encode(items[items.length - 1].id) : null };
}
async function withFollowing<T extends { id: string }>(users: T[], viewerId: string) {
  const following = await db.follow.findMany({ where: { followerId: viewerId, followingId: { in: users.map(user => user.id) } }, select: { followingId: true } });
  const followed = new Set(following.map(f => f.followingId));
  return users.map(user => ({ ...user, isFollowing: followed.has(user.id) }));
}
async function blockedIds(userId: string) {
  const rows = await db.block.findMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] }, select: { blockerId: true, blockedId: true } });
  return rows.map(b => b.blockerId === userId ? b.blockedId : b.blockerId);
}
async function assertVisibleUser(viewer: string, target: string) {
  const [user, block] = await Promise.all([
    db.user.findUnique({ where: { id: target }, select: { id: true } }),
    db.block.findFirst({ where: { OR: [{ blockerId: viewer, blockedId: target }, { blockerId: target, blockedId: viewer }] } }),
  ]);
  if (!user || block) throw new SocialError(404, 'User not found');
}
async function visiblePost(viewer: string, postId: string) {
  const p = await db.post.findUnique({ where: { id: postId } });
  if (!p) throw new SocialError(404, 'Post not found');
  await assertVisibleUser(viewer, p.authorId);
  return p;
}
async function assertAdmin(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (user?.role !== 'ADMIN') throw new SocialError(403, 'Administrator access required');
}
async function postPage(viewerId: string, where: Prisma.PostWhereInput, q: URLSearchParams) {
  const rows = await db.post.findMany({ where, include: postInclude(viewerId), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1, ...cursor(q) });
  const result = page(rows);
  return { posts: result.items.map(serializePost), nextCursor: result.nextCursor };
}
export async function getSocial(viewer: Viewer, q: URLSearchParams) {
  const userId = idSchema.parse(viewer.id);
  const resource = q.get('resource') ?? 'feed';
  const excluded = await blockedIds(userId);
  const visible: Prisma.PostWhereInput = { authorId: { notIn: excluded } };
  switch (resource) {
    case 'feed': {
      const following = await db.follow.findMany({ where: { followerId: userId }, select: { followingId: true } });
      return postPage(userId, { AND: [visible, { authorId: { in: [userId, ...following.map(f => f.followingId)] } }] }, q);
    }
    case 'explore': return postPage(userId, visible, q);
    case 'bookmarks': return postPage(userId, { AND: [visible, { bookmarks: { some: { userId } } }] }, q);
    case 'post': {
      const postId = idSchema.parse(q.get('postId'));
      await visiblePost(userId, postId);
      const post = await db.post.findUniqueOrThrow({ where: { id: postId }, include: postInclude(userId) });
      const comments = await db.comment.findMany({ where: { postId, userId: { notIn: excluded } }, include: { user: { select: publicUser } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1, ...cursor(q, 'commentsCursor') });
      const result = page(comments);
      return { post: { ...serializePost(post), comments: result.items, commentsNextCursor: result.nextCursor } };
    }
    case 'profile': {
      const username = q.get('username');
      const targetId = q.get('userId') ?? userId;
      const profile = await db.user.findUnique({ where: username ? { username: username.toLowerCase() } : { id: targetId }, select: { ...publicUser, bio: true, createdAt: true, _count: { select: { followers: true, following: true, posts: true } } } });
      if (!profile) throw new SocialError(404, 'Profile not found');
      await assertVisibleUser(userId, profile.id);
      const following = await db.follow.findUnique({ where: { followerId_followingId: { followerId: userId, followingId: profile.id } } });
      return { profile: { ...profile, isFollowing: !!following, isBlocked: false }, ...await postPage(userId, { authorId: profile.id }, q) };
    }
    case 'connections': {
      const target = idSchema.parse(q.get('userId') ?? userId);
      await assertVisibleUser(userId, target);
      const type = z.enum(['followers', 'following']).parse(q.get('type') ?? 'followers');
      const where: Prisma.UserWhereInput = type === 'followers' ? { following: { some: { followingId: target } } } : { followers: { some: { followerId: target } } };
      const rows = await db.user.findMany({ where: { AND: [where, { id: { notIn: excluded } }] }, select: publicUser, orderBy: { id: 'asc' }, take: LIMIT + 1, ...cursor(q) });
      const result = page(rows);
      return { users: await withFollowing(result.items, userId), nextCursor: result.nextCursor };
    }
    case 'discover': {
      const users = await db.user.findMany({
        where: { id: { notIn: [userId, ...excluded] }, followers: { none: { followerId: userId } } },
        select: { ...publicUser, bio: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8,
      });
      return { users: await withFollowing(users, userId) };
    }
    case 'search': {
      const term = z.string().trim().max(100).parse(q.get('q') ?? '');
      if (!term) return { users: [], posts: [], nextCursor: null };
      const users = await db.user.findMany({ where: { id: { notIn: excluded }, OR: [{ name: { contains: term, mode: 'insensitive' } }, { username: { contains: term, mode: 'insensitive' } }] }, select: { ...publicUser, bio: true }, take: LIMIT, orderBy: { username: 'asc' } });
      return { users: await withFollowing(users, userId), ...await postPage(userId, { AND: [visible, { content: { contains: term, mode: 'insensitive' } }] }, q) };
    }
    case 'notifications': {
      const where = { userId, actorId: { notIn: excluded } };
      const rows = await db.notification.findMany({ where, include: { actor: { select: publicUser } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1, ...cursor(q) });
      const result = page(rows);
      const unreadCount = await db.notification.count({ where: { ...where, read: false } });
      return { notifications: result.items, unreadCount, nextCursor: result.nextCursor };
    }
    case 'settings': {
      const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { ...publicUser, email: true, bio: true, role: true } });
      const blocks = await db.block.findMany({ where: { blockerId: userId }, include: { blocked: { select: publicUser } } });
      return { user, blockedUsers: blocks.map(b => b.blocked) };
    }
    case 'admin': {
      await assertAdmin(userId);
      const rows = await db.report.findMany({ include: { user: { select: publicUser }, post: { include: { author: { select: publicUser } } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: LIMIT + 1, ...cursor(q) });
      const result = page(rows);
      return { reports: result.items, nextCursor: result.nextCursor };
    }
    default: throw new SocialError(400, 'Unknown resource');
  }
}

export async function mutateSocial(viewer: Viewer, input: unknown) {
  const userId = idSchema.parse(viewer.id);
  const body = z.object({ action: z.string().max(40) }).passthrough().parse(input);
  switch (body.action) {
    case 'createPost': {
      const data = postInput.parse(body);
      const post = await db.post.create({ data: { authorId: userId, content: data.content, image: data.image ?? null } });
      return { ok: true, post };
    }
    case 'editPost': {
      const postId = idSchema.parse(body.postId);
      const data = postInput.parse(body);
      const updated = await db.post.updateMany({ where: { id: postId, authorId: userId }, data: { content: data.content, image: data.image ?? null } });
      if (!updated.count) throw new SocialError(403, 'You can only edit your own posts');
      return { ok: true };
    }
    case 'deletePost': {
      const postId = idSchema.parse(body.postId);
      const deleted = await db.$transaction(async tx => {
        const removed = await tx.post.deleteMany({ where: { id: postId, authorId: userId } });
        if (removed.count) await tx.notification.deleteMany({ where: { postId } });
        return removed;
      });
      if (!deleted.count) throw new SocialError(403, 'You can only delete your own posts');
      return { ok: true };
    }
    case 'follow':
    case 'unfollow': {
      const target = idSchema.parse(body.userId);
      if (target === userId) throw new SocialError(400, 'You cannot follow yourself');
      await assertVisibleUser(userId, target);
      await db.$transaction(async tx => {
        if (body.action === 'follow') {
          const created = await tx.follow.createMany({ data: [{ followerId: userId, followingId: target }], skipDuplicates: true });
          if (created.count) await tx.notification.create({ data: { userId: target, actorId: userId, type: 'FOLLOW' } });
        } else await tx.follow.deleteMany({ where: { followerId: userId, followingId: target } });
      });
      return { ok: true };
    }
    case 'like':
    case 'unlike':
    case 'bookmark':
    case 'unbookmark': {
      const postId = idSchema.parse(body.postId);
      const post = await visiblePost(userId, postId);
      await db.$transaction(async tx => {
        if (body.action === 'like') {
          const created = await tx.like.createMany({ data: [{ userId, postId }], skipDuplicates: true });
          if (created.count && post.authorId !== userId) await tx.notification.create({ data: { userId: post.authorId, actorId: userId, type: 'LIKE', postId } });
        } else if (body.action === 'unlike') await tx.like.deleteMany({ where: { userId, postId } });
        else if (body.action === 'bookmark') await tx.bookmark.createMany({ data: [{ userId, postId }], skipDuplicates: true });
        else await tx.bookmark.deleteMany({ where: { userId, postId } });
      });
      return { ok: true };
    }
    case 'comment': {
      const postId = idSchema.parse(body.postId);
      const content = z.string().trim().min(1).max(1000).parse(body.content);
      const post = await visiblePost(userId, postId);
      const comment = await db.$transaction(async tx => {
        const c = await tx.comment.create({ data: { userId, postId, content }, include: { user: { select: publicUser } } });
        if (post.authorId !== userId) await tx.notification.create({ data: { userId: post.authorId, actorId: userId, type: 'COMMENT', postId } });
        return c;
      });
      return { ok: true, comment };
    }
    case 'deleteComment': {
      const commentId = idSchema.parse(body.commentId);
      const deleted = await db.comment.deleteMany({ where: { id: commentId, userId } });
      if (!deleted.count) throw new SocialError(403, 'You can only delete your own comments');
      return { ok: true };
    }
    case 'updateProfile': {
      const data = z.object({ name: z.string().trim().min(1).max(60), username: userSchema, bio: z.string().trim().max(300), image: imageSchema }).parse(body);
      const user = await db.user.update({ where: { id: userId }, data: { ...data, image: data.image ?? null }, select: { ...publicUser, bio: true } });
      return { ok: true, user };
    }
    case 'block': {
      const target = idSchema.parse(body.userId);
      if (target === userId) throw new SocialError(400, 'You cannot block yourself');
      if (!await db.user.findUnique({ where: { id: target }, select: { id: true } })) throw new SocialError(404, 'User not found');
      await db.$transaction(async tx => {
        await tx.block.createMany({ data: [{ blockerId: userId, blockedId: target }], skipDuplicates: true });
        await tx.follow.deleteMany({ where: { OR: [{ followerId: userId, followingId: target }, { followerId: target, followingId: userId }] } });
        await tx.notification.deleteMany({ where: { OR: [{ userId, actorId: target }, { userId: target, actorId: userId }] } });
      });
      return { ok: true };
    }
    case 'unblock': {
      const target = idSchema.parse(body.userId);
      await db.block.deleteMany({ where: { blockerId: userId, blockedId: target } });
      return { ok: true };
    }
    case 'report': {
      const postId = idSchema.parse(body.postId);
      const reason = z.string().trim().min(5).max(1000).parse(body.reason);
      await visiblePost(userId, postId);
      const existing = await db.report.findFirst({ where: { userId, postId, status: 'OPEN' } });
      if (!existing) await db.report.create({ data: { userId, postId, reason } });
      return { ok: true };
    }
    case 'readNotifications': {
      await db.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
      return { ok: true };
    }
    case 'resolveReport': {
      await assertAdmin(userId);
      const reportId = idSchema.parse(body.reportId);
      const updated = await db.report.updateMany({ where: { id: reportId }, data: { status: 'RESOLVED' } });
      if (!updated.count) throw new SocialError(404, 'Report not found');
      return { ok: true };
    }
    case 'adminDeletePost': {
      await assertAdmin(userId);
      const postId = idSchema.parse(body.postId);
      await db.$transaction(async tx => {
        const removed = await tx.post.deleteMany({ where: { id: postId } });
        if (!removed.count) throw new SocialError(404, 'Post not found');
        await tx.notification.deleteMany({ where: { postId } });
      });
      return { ok: true };
    }
    default: throw new SocialError(400, 'Unknown action');
  }
}

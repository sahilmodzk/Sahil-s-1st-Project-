import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { db } from '../src/lib/db';
import { getSocial, mutateSocial, SocialError } from '../src/lib/social';

const prefix = `test_${randomUUID().replaceAll('-', '').slice(0, 10)}`;
const a = { id: `${prefix}_a` }, b = { id: `${prefix}_b` }, c = { id: `${prefix}_c` }, admin = { id: `${prefix}_admin` };
const ids = [a.id, b.id, c.id, admin.id];
const q = (resource: string, params: Record<string, string> = {}) => new URLSearchParams({ resource, ...params });
const run = (viewer: {id:string}, action: string, fields = {}) => mutateSocial(viewer, { action, ...fields });
function expectStatus(status: number) { return (e: unknown) => e instanceof SocialError && e.status === status; }

before(async () => {
  for (const [i, who] of [a, b, c, admin].entries()) await db.user.create({ data: { id: who.id, name: `Test ${i}`, email: `${who.id}@example.test`, username: `${prefix}${i}`, role: who.id === admin.id ? 'ADMIN' : 'USER' } });
});
after(async () => {
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('social persistence and authorization', () => {
  it('creates persistent posts, validates content, and enforces edit/delete ownership', async () => {
    const result = await run(a, 'createPost', { content: 'hello from test' });
    assert.ok('post' in result && result.post);
    const postId = result.post.id;
    assert.equal((await db.post.findUniqueOrThrow({ where: { id: postId } })).content, 'hello from test');
    await assert.rejects(run(a, 'createPost', { content: ' '.repeat(3) }));
    await assert.rejects(run(a, 'createPost', { content: 'x'.repeat(2001) }));
    await assert.rejects(run(a, 'createPost', { content: 'image', image: 'https://evil.example/image.svg' }));
    await assert.rejects(run(b, 'editPost', { postId, content: 'unauthorized' }), expectStatus(403));
    await assert.rejects(run(b, 'deletePost', { postId }), expectStatus(403));
    await run(a, 'editPost', { postId, content: 'edited' });
    assert.equal((await db.post.findUniqueOrThrow({ where: { id: postId } })).content, 'edited');
    await run(a, 'deletePost', { postId });
    assert.equal(await db.post.count({ where: { id: postId } }), 0);
  });
  it('follows idempotently, populates following feeds, and persists follow notifications', async () => {
    const created = await run(b, 'createPost', { content: 'following feed post' });
    assert.ok('post' in created && created.post);
    const postId = created.post.id;
    await assert.rejects(run(a, 'follow', { userId: a.id }), expectStatus(400));
    const before = await getSocial(a, q('feed'));
    assert.ok('posts' in before && before.posts);
    assert.equal(before.posts.some(p => p.id === postId), false);
    await run(a, 'follow', { userId: b.id });
    await run(a, 'follow', { userId: b.id });
    assert.equal(await db.follow.count({ where: { followerId: a.id, followingId: b.id } }), 1);
    assert.equal(await db.notification.count({ where: { userId: b.id, actorId: a.id, type: 'FOLLOW' } }), 1);
    const after = await getSocial(a, q('feed'));
    assert.ok('posts' in after && after.posts);
    assert.ok(after.posts.some(p => p.id === postId));
    const followers = await getSocial(a, q('connections', { userId: b.id, type: 'followers' }));
    assert.ok('users' in followers && followers.users);
    assert.ok(followers.users.some(user => user.id === a.id));
    await run(a, 'unfollow', { userId: b.id });
    assert.equal(await db.follow.count({ where: { followerId: a.id, followingId: b.id } }), 0);
  });
  it('persists likes, bookmarks, comments and notifications; restricts comment deletion', async () => {
    const created = await run(b, 'createPost', { content: 'interaction post' });
    assert.ok('post' in created && created.post);
    const postId = created.post.id;
    await run(a, 'like', { postId });
    await run(a, 'like', { postId });
    await run(a, 'bookmark', { postId });
    const comment = await run(a, 'comment', { postId, content: 'a useful response' });
    assert.ok('comment' in comment && comment.comment);
    await assert.rejects(run(b, 'deleteComment', { commentId: comment.comment.id }), expectStatus(403));
    const loaded = await getSocial(a, q('post', { postId }));
    assert.ok('post' in loaded && loaded.post);
    assert.equal(loaded.post.liked, true);
    assert.equal(loaded.post.bookmarked, true);
    assert.equal(loaded.post._count.likes, 1);
    assert.equal(loaded.post.comments[0].content, 'a useful response');
    const notices = await getSocial(b, q('notifications'));
    assert.ok('notifications' in notices && notices.notifications);
    assert.ok(notices.notifications.some(n => n.type === 'LIKE' && n.postId === postId));
    assert.ok(notices.notifications.some(n => n.type === 'COMMENT' && n.postId === postId));
    await run(b, 'readNotifications');
    assert.equal(await db.notification.count({ where: { userId: b.id, read: false } }), 0);
    await run(a, 'deleteComment', { commentId: comment.comment.id });
    await run(a, 'unlike', { postId });
    await run(a, 'unbookmark', { postId });
    assert.equal(await db.like.count({ where: { postId } }), 0);
    assert.equal(await db.bookmark.count({ where: { postId } }), 0);
    assert.equal(await db.comment.count({ where: { postId } }), 0);
  });
  it('blocks users in both directions and removes follow relationships', async () => {
    await run(a, 'follow', { userId: b.id });
    await run(b, 'follow', { userId: a.id });
    const created = await run(b, 'createPost', { content: 'blocked content' });
    assert.ok('post' in created && created.post);
    const postId = created.post.id;
    await run(a, 'block', { userId: b.id });
    assert.equal(await db.follow.count({ where: { OR: [{ followerId: a.id, followingId: b.id }, { followerId: b.id, followingId: a.id }] } }), 0);
    for (const [viewer, target] of [[a, b], [b, a]]) {
      await assert.rejects(getSocial(viewer, q('profile', { userId: target.id })), expectStatus(404));
      await assert.rejects(run(viewer, 'follow', { userId: target.id }), expectStatus(404));
    }
    await assert.rejects(run(a, 'like', { postId }), expectStatus(404));
    await assert.rejects(run(a, 'comment', { postId, content: 'blocked' }), expectStatus(404));
    const explore = await getSocial(a, q('explore'));
    assert.ok('posts' in explore && explore.posts);
    assert.ok(explore.posts.every(p => p.author.id !== b.id));
    const settings = await getSocial(a, q('settings'));
    assert.ok('blockedUsers' in settings && settings.blockedUsers);
    assert.ok(settings.blockedUsers.some(u => u.id === b.id));
    await run(a, 'unblock', { userId: b.id });
    await assert.doesNotReject(getSocial(a, q('post', { postId })));
  });
  it('restricts moderation to database-backed admin roles and resolves real reports', async () => {
    const created = await run(b, 'createPost', { content: 'reported post' });
    assert.ok('post' in created && created.post);
    const postId = created.post.id;
    await run(a, 'report', { postId, reason: 'This is a moderation test' });
    const report = await db.report.findFirstOrThrow({ where: { postId, userId: a.id } });
    await assert.rejects(getSocial(a, q('admin')), expectStatus(403));
    await assert.rejects(run(a, 'resolveReport', { reportId: report.id }), expectStatus(403));
    await assert.rejects(run(a, 'adminDeletePost', { postId }), expectStatus(403));
    await run(admin, 'resolveReport', { reportId: report.id });
    assert.equal((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status, 'RESOLVED');
    await run(admin, 'adminDeletePost', { postId });
    assert.equal(await db.post.count({ where: { id: postId } }), 0);
  });
  it('updates profile safely, ignores role escalation, and supports search', async () => {
    await run(a, 'updateProfile', { name: 'Searchable Person', username: `${prefix}new`, bio: 'A short bio', role: 'ADMIN' });
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: a.id } })).role, 'USER');
    await assert.rejects(run(a, 'updateProfile', { name: 'Invalid', username: '../bad', bio: '' }));
    const results = await getSocial(c, q('search', { q: 'Searchable Person' }));
    assert.ok('users' in results && results.users);
    assert.ok(results.users.some(u => u.id === a.id));
    assert.ok(results.users.every(u => !('email' in u) && !('role' in u)));
  });
  it('suggests unfollowed unblocked users and treats blank search as an empty query', async () => {
    await run(c, 'follow', { userId: a.id });
    await run(c, 'block', { userId: b.id });
    const result = await getSocial(c, q('discover'));
    assert.ok('users' in result && result.users);
    assert.ok(result.users.length > 0 && result.users.length <= 8);
    assert.ok(result.users.every(user => ![a.id, b.id, c.id].includes(user.id) && user.isFollowing === false));
    assert.ok(result.users.every(user => !('email' in user) && !('role' in user)));
    assert.deepEqual(await getSocial(c, q('search', { q: '  ' })), { users: [], posts: [], nextCursor: null });
    await run(c, 'unfollow', { userId: a.id });
    await run(c, 'unblock', { userId: b.id });
  });
  it('paginates without repeating posts', async () => {
    for (let i = 0; i < 18; i++) await run(c, 'createPost', { content: `page post ${i}` });
    const first = await getSocial(c, q('feed'));
    assert.ok('posts' in first && first.posts);
    assert.equal(first.posts.length, 15);
    assert.ok('nextCursor' in first && first.nextCursor);
    const second = await getSocial(c, q('feed', { cursor: first.nextCursor }));
    assert.ok('posts' in second && second.posts);
    assert.equal(second.posts.length, 3);
    assert.ok(second.posts.every(p => !first.posts.some(previous => previous.id === p.id)));
    assert.equal(second.nextCursor, null);
  });
});

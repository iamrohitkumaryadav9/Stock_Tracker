import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';

const URI = 'mongodb://127.0.0.1:27017/quantis_search_test'; // throwaway database, dropped afterwards
const up = await new Promise<boolean>((res) => { const s = net.connect(27017, '127.0.0.1').once('connect', () => { s.destroy(); res(true); }).once('error', () => res(false)); });

describe.skipIf(!up)('searchGlobal (real MongoDB)', () => {
  let search: typeof import('@/lib/actions/discovery.actions').searchGlobal;
  let db: import('mongodb').Db;
  beforeAll(async () => {
    process.env.MONGODB_URI = URI;
    const { connectToDatabase } = await import('@/database/mongoose');
    db = (await connectToDatabase()).connection.db as unknown as import('mongodb').Db;
    await db.collection('user').insertMany([
      { name: 'Priya Sharma', email: 'priya@example.test', image: null },
      { name: 'Rahul (admin) C++', email: 'rahul@example.test' },
    ]);
    await db.collection('posts').insertOne({ userId: 'u1', userName: 'Priya Sharma', userEmail: 'p@example.test', content: 'NVDA looks strong after earnings (C++ jokes aside)', symbol: 'NVDA', type: 'insight', likes: [], comments: [], createdAt: new Date('2025-03-01'), updatedAt: new Date() });
    search = (await import('@/lib/actions/discovery.actions')).searchGlobal;
  });
  afterAll(async () => {
    await db.dropDatabase();
    (await import('mongoose')).default.disconnect();
  });

  it('finds real accounts by name without leaking email', async () => {
    const r = await search('priya', 'users');
    expect(r.users).toHaveLength(1);
    expect(r.users[0].name).toBe('Priya Sharma');
    expect(JSON.stringify(r)).not.toContain('example.test');
  });
  it('finds posts by content and by exact ticker', async () => {
    expect((await search('earnings', 'posts')).posts).toHaveLength(1);
    const bySymbol = await search('nvda', 'posts');
    expect(bySymbol.posts[0]).toMatchObject({ symbol: 'NVDA', userName: 'Priya Sharma' });
  });
  it('treats regex metacharacters literally: no throw, and other sources are not blanked', async () => {
    for (const q of ['C++', '(', '[', '\\', '.*', 'a{2,1}']) {
      const r = await search(q, 'all');
      expect(r.errors.users, q).toBeUndefined();
      expect(r.errors.posts, q).toBeUndefined();
    }
    expect((await search('C++', 'users')).users.map((u) => u.name)).toEqual(['Rahul (admin) C++']);
    expect((await search('.*', 'users')).users).toHaveLength(0); // matched literally, not as "everything"
  });
  it('empty or whitespace query returns nothing', async () => {
    expect(await search('   ', 'all')).toEqual({ stocks: [], users: [], posts: [], errors: {} });
  });
});

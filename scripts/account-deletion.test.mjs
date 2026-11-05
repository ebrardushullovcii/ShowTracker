import test from "node:test";
import assert from "node:assert/strict";
import { request, runBatch } from "../convex/accountDeletion.ts";
import { ACCESS_TOKEN_DURATION_MS } from "../convex/lib/authPolicy.ts";

function fixture() {
  const tables = {};
  const scheduled = [];
  let nextId = 0;
  let maxRead = 0;
  const insert = (table, value) => {
    const row = { ...value, _id: `${table}:${++nextId}`, _creationTime: nextId };
    (tables[table] ??= []).push(row);
    return row._id;
  };
  const db = {
    query(table) {
      const conditions = [];
      let indexed = false;
      const read = (limit) => {
        assert.ok(indexed, `${table} must use an index`);
        const rows = (tables[table] ?? []).filter(row => conditions.every(([key, value]) => row[key] === value)).slice(0, limit);
        maxRead = Math.max(maxRead, rows.length);
        return structuredClone(rows);
      };
      const query = {
        withIndex(name, build) {
          indexed = true;
          const q = { eq(key, value) { conditions.push([key, value]); return q; } };
          build(q);
          return query;
        },
        async first() { return read(1)[0] ?? null; },
        async take(limit) { assert.ok(limit <= 100); return read(limit); },
        async paginate(options) {
          assert.equal(options.cursor, null);
          assert.ok(options.maximumBytesRead <= 1_000_000);
          const page = read(options.numItems);
          return { page, isDone: page.length < options.numItems, continueCursor: "unused" };
        },
      };
      return query;
    },
    async get(id) { return structuredClone(Object.values(tables).flat().find(row => row._id === id) ?? null); },
    async insert(table, value) { return insert(table, value); },
    async patch(id, patch) { Object.assign(Object.values(tables).flat().find(row => row._id === id), patch); },
    async delete(id) {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex(row => row._id === id);
        if (index >= 0) { rows.splice(index, 1); return; }
      }
      assert.fail(`Missing document ${id}`);
    },
  };
  const context = userId => ({
    db,
    auth: { getUserIdentity: async () => userId ? { subject: `${userId}|session` } : null },
    scheduler: { runAfter: async (delay, fn, args) => { scheduled.push({ delay, args }); return "scheduled"; } },
  });
  const drainImmediate = async () => {
    let runs = 0;
    while (scheduled.length && scheduled[0].delay === 0) {
      assert.ok(++runs < 1000, "Deletion must finish its immediate pass");
      const event = scheduled.shift();
      await runBatch._handler(context(null), event.args);
    }
  };
  return { tables, insert, context, scheduled, drainImmediate, get maxRead() { return maxRead; } };
}

test("deletion rejects unauthenticated callers and is scoped to the caller", async () => {
  const f = fixture();
  const owner = f.insert("users", { email: "owner@example.com" });
  const other = f.insert("users", { email: "other@example.com" });
  await assert.rejects(request._handler(f.context(null), { confirmation: "DELETE" }), /Sign in/);
  await request._handler(f.context(owner), { confirmation: "DELETE", userId: other });
  await request._handler(f.context(owner), { confirmation: "DELETE" });
  assert.equal(f.tables.accountDeletions.length, 1);
  assert.equal(f.tables.accountDeletions[0].userId, owner);
  assert.equal(f.scheduled.length, 1);
  assert.equal(f.tables.users.length, 2);
});

test("bounded deletion removes owned data and auth descendants without touching another account or catalogue", async () => {
  const f = fixture();
  const owner = f.insert("users", { email: "owner@example.com" });
  const other = f.insert("users", { email: "other@example.com" });
  const ownedTables = ["watchedEpisodes", "userShows", "userFavorites", "customLists", "feedProjections", "userScheduleEvents", "watchlistFutureCountProjections", "userScheduleProjectionWindows", "userAnimeHomeSettings", "userAnimeFranchiseSettings", "userProfiles", "userSocial", "userStats"];
  for (const table of ownedTables) {
    for (let i = 0; i < (table === "watchedEpisodes" ? 251 : 3); i++) f.insert(table, { userId: owner });
    f.insert(table, { userId: other });
  }
  f.insert("sharedGames", { ownerId: owner, token: "revoked-link" });
  f.insert("sharedGames", { ownerId: other, token: "preserved-link" });
  const ownSession = f.insert("authSessions", { userId: owner });
  const otherSession = f.insert("authSessions", { userId: other });
  for (let i = 0; i < 237; i++) f.insert("authRefreshTokens", { sessionId: ownSession });
  f.insert("authRefreshTokens", { sessionId: otherSession });
  f.insert("authVerifiers", { sessionId: ownSession });
  f.insert("authVerifiers", { sessionId: otherSession });
  const ownAccount = f.insert("authAccounts", { userId: owner, provider: "password" });
  const otherAccount = f.insert("authAccounts", { userId: other, provider: "password" });
  for (let i = 0; i < 115; i++) f.insert("authVerificationCodes", { accountId: ownAccount });
  f.insert("authVerificationCodes", { accountId: otherAccount });
  f.insert("authRateLimits", { identifier: ownAccount });
  f.insert("authRateLimits", { identifier: otherAccount });
  f.insert("shows", { title: "Shared catalogue" });
  f.insert("scheduleCache", { date: "2026-11-05" });
  await request._handler(f.context(owner), { confirmation: "DELETE" });
  await f.drainImmediate();
  for (const table of ownedTables) assert.deepEqual(f.tables[table].map(row => row.userId), [other], table);
  assert.deepEqual(f.tables.sharedGames.map(row => row.ownerId), [other]);
  assert.deepEqual(f.tables.authSessions.map(row => row.userId), [other]);
  assert.deepEqual(f.tables.authAccounts.map(row => row.userId), [other]);
  assert.deepEqual(f.tables.authRefreshTokens.map(row => row.sessionId), [otherSession]);
  assert.deepEqual(f.tables.authVerifiers.map(row => row.sessionId), [otherSession]);
  assert.deepEqual(f.tables.authVerificationCodes.map(row => row.accountId), [otherAccount]);
  assert.deepEqual(f.tables.authRateLimits.map(row => row.identifier), [otherAccount]);
  assert.deepEqual(f.tables.users.map(row => row._id), [other]);
  assert.equal(f.tables.shows.length, 1);
  assert.equal(f.tables.scheduleCache.length, 1);
  assert.ok(f.maxRead <= 100);
  assert.equal(f.scheduled.length, 1);
  assert.ok(f.scheduled[0].delay > ACCESS_TOKEN_DURATION_MS);

  // A previously issued access token or an already-running background task can
  // finish a write during the initial purge. The delayed pass must remove it.
  f.insert("watchedEpisodes", { userId: owner });
  const finalSweep = f.scheduled.shift();
  await runBatch._handler(f.context(null), finalSweep.args);
  await f.drainImmediate();
  assert.deepEqual(f.tables.watchedEpisodes.map(row => row.userId), [other]);
  assert.equal(f.tables.accountDeletions.length, 0);
  assert.equal(f.scheduled.length, 0);
  await runBatch._handler(f.context(null), finalSweep.args);
});

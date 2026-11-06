import test from "node:test";
import assert from "node:assert/strict";
import { approveUser, listUsers, setRegistrationPolicy } from "../convex/access.ts";
import { initializeAccountAccess, requireApproved } from "../convex/lib/accessPolicy.ts";
import * as shows from "../convex/shows.ts";
import * as schedule from "../convex/schedule.ts";
import * as stats from "../convex/stats.ts";
import * as lists from "../convex/lists.ts";
import * as sharedGameActions from "../convex/sharedGameActions.ts";
import { revoke } from "../convex/sharedGames.ts";

function fixture() {
  const rows = new Map([
    ["owner", { _id: "owner", _creationTime: 1, email: "owner@example.com" }],
    ["existing", { _id: "existing", _creationTime: 2, email: "existing@example.com" }],
    ["pending", { _id: "pending", _creationTime: 3, approvalStatus: "pending", email: "pending@example.com" }],
  ]);
  let settings = null;
  const db = {
    async get(id) { return structuredClone(rows.get(id) ?? null); },
    async patch(id, value) {
      if (id === "settings") settings = { ...settings, ...value };
      else Object.assign(rows.get(id), value);
    },
    async insert(table, value) {
      assert.equal(table, "registrationSettings"); settings = { _id: "settings", ...value }; return "settings";
    },
    query(table) {
      assert.ok(["users", "registrationSettings", "accountDeletions"].includes(table), `Unexpected data read: ${table}`);
      const filters = [];
      const query = {
        withIndex(name, callback) {
          const builder = { eq(key, value) { filters.push([key, value]); return builder; } };
          callback(builder); return query;
        },
        order() { return query; },
        async first() { assert.equal(table, "accountDeletions"); return null; },
        async unique() { assert.equal(table, "registrationSettings"); return settings; },
        async paginate(opts) {
          assert.equal(table, "users"); assert.ok(opts.numItems <= 50); assert.ok(opts.maximumBytesRead <= 256_000);
          return { page: [...rows.values()].filter(row => filters.every(([key, value]) => row[key] === value)).slice(0, opts.numItems), isDone: true, continueCursor: "done" };
        },
      }; return query;
    },
  };
  const context = (userId, claim) => ({
    db, auth: { getUserIdentity: async () => userId ? { subject: `${userId}|session`, showtrackerApproval: claim } : null },
  });
  return { db, rows, context };
}

test("legacy JWTs and approved JWTs avoid additional per-request user reads", async () => {
  for (const claim of [undefined, "approved"]) {
    await requireApproved({ auth: { getUserIdentity: async () => ({ subject: "existing|session", showtrackerApproval: claim }) },
      get db() { assert.fail("Approved requests must not read the users table again"); } });
  }
  await assert.rejects(requireApproved({ auth: { getUserIdentity: async () => null } }), /Sign in/);
});

test("every app data query, mutation and action rejects pending users before entering its handler", async () => {
  const f = fixture(); let checked = 0;
  for (const module of [shows, schedule, stats, lists, sharedGameActions, { revoke }]) {
    for (const fn of Object.values(module)) {
      if (!fn?.isPublic || !fn._handler) continue;
      const ctx = fn.isAction
        ? { auth: f.context("pending", "pending").auth, runQuery: async () => "pending" }
        : f.context("pending", "pending");
      await assert.rejects(fn._handler(ctx, {}), /awaiting approval/);
      checked++;
    }
  }
  assert.ok(checked >= 60, `Expected coverage of public app endpoints, got ${checked}`);
});

test("existing accounts remain approved; new registrations obey policy and cannot create restricted guests", async () => {
  const f = fixture();
  await initializeAccountAccess(f.context(null), { userId: "existing", existingUserId: "existing", provider: { id: "password" } });
  assert.equal(f.rows.get("existing").approvalStatus, undefined);
  await initializeAccountAccess(f.context(null), { userId: "pending", existingUserId: null, provider: { id: "password" } });
  assert.equal(f.rows.get("pending").approvalStatus, "pending");
  await assert.rejects(initializeAccountAccess(f.context(null), { userId: "pending", existingUserId: null, provider: { id: "anonymous" } }), /require approval/);
});

test("only trusted owner IDs can see users, approve accounts or change registration", async () => {
  const previous = process.env.SHOWTRACKER_ADMIN_USER_IDS;
  process.env.SHOWTRACKER_ADMIN_USER_IDS = "owner";
  try {
    const f = fixture();
    // A caller-controlled email/name is never an administrative credential.
    f.rows.get("pending").email = "owner@example.com";
    for (const userId of [null, "existing", "pending"]) {
      const ctx = f.context(userId, userId === "pending" ? "pending" : "approved");
      await assert.rejects(listUsers._handler(ctx, { filter: "all", paginationOpts: { cursor: null, numItems: 25 } }), /Owner access/);
      await assert.rejects(approveUser._handler(ctx, { userId: "pending" }), /Owner access/);
      await assert.rejects(setRegistrationPolicy._handler(ctx, { requireApproval: false }), /Owner access/);
    }
    const owner = f.context("owner", "approved");
    const result = await listUsers._handler(owner, { filter: "pending", paginationOpts: { cursor: null, numItems: 1000 } });
    assert.deepEqual(result.page.map(user => user.id), ["pending"]);
    await approveUser._handler(owner, { userId: "pending" });
    const approvedAt = f.rows.get("pending").approvedAt;
    await approveUser._handler(owner, { userId: "pending" });
    assert.equal(f.rows.get("pending").approvedAt, approvedAt);
    await requireApproved(f.context("pending", "pending"));
    await requireApproved({ auth: f.context("pending", "pending").auth, runQuery: async () => "approved" });
    await setRegistrationPolicy._handler(owner, { requireApproval: false });
    await initializeAccountAccess(owner, { userId: "existing", existingUserId: null, provider: { id: "password" } });
    assert.equal(f.rows.get("existing").approvalStatus, "approved");
  } finally {
    if (previous === undefined) delete process.env.SHOWTRACKER_ADMIN_USER_IDS;
    else process.env.SHOWTRACKER_ADMIN_USER_IDS = previous;
  }
});

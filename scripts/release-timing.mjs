#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFile, fetchTmdbDetails, fetchTvMazeEpisodes } from "./schedule-confidence.mjs";

const DAY = 86_400_000;
export const LIMITS = { providerAttemptsPerDay: 8, mutationCallsPerDay: 64, pagesPerRun: 4, attemptsPerEpisode: 3 };
const keyFor = row => `${row.tmdb_id}:${row.season_number}:${row.episode_number}:${row.air_timestamp}`;
const nameKey = name => String(name ?? "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const generic = name => /^(episode\s*\d+|tba|tbd|\d+)$/i.test(String(name).trim());

export function confirmConflict(candidate, tmdb, tvmaze, now = Date.now()) {
  const coordinate = e => e.seasonNumber === candidate.season_number && e.episodeNumber === candidate.episode_number;
  const t = tmdb.events.find(coordinate);
  const v = tvmaze.events.find(coordinate);
  if (!t || !v || t.providers?.tmdbId !== candidate.tmdb_id ||
      v.providers?.tvmazeId !== candidate.tvmaze_id || !t.name || generic(t.name) ||
      nameKey(t.name) !== nameKey(v.name)) return null;
  const airtime = Date.parse(v.airDate);
  const tmdbTime = Date.parse(t.airDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t.airDate) || !v.airDate.includes("T") ||
      !Number.isFinite(airtime) || airtime > now - 5 * 60_000 ||
      airtime < now - DAY || tmdbTime <= now || tmdbTime - airtime > DAY ||
      airtime !== candidate.air_timestamp) return null;
  const firstFuture = tmdb.events.filter(e => Date.parse(e.airDate) > now)
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber)[0];
  if (!firstFuture || !coordinate(firstFuture)) return null;
  const released = tmdb.metadata?.releasedEpisodes;
  if (!Number.isSafeInteger(released) || released <= 0 ||
      tvmaze.metadata?.releasedEpisodes !== released + 1 ||
      tmdb.metadata?.totalEpisodes < released + 1) return null;
  return { seasonNumber: t.seasonNumber, episodeNumber: t.episodeNumber,
    name: t.name, tmdbAirDate: t.airDate, airTimestamp: airtime,
    releasedEpisodes: released + 1, verifiedAt: now };
}

export async function runReleaseTiming({ dbPath, ledgerPath, dryRun = true, now = Date.now() }) {
  const source = new DatabaseSync(dbPath, { readOnly: true });
  const ledger = new DatabaseSync(dryRun ? ":memory:" : ledgerPath);
  const metrics = { candidates: 0, providerAttempts: 0, mutationCalls: 0, users: 0, writes: 0, proofs: [], deferred: 0, blockedJobs: 0 };
  try {
    ledger.exec(`CREATE TABLE IF NOT EXISTS jobs (key TEXT PRIMARY KEY, tmdb INTEGER, tvmaze INTEGER,
      attempts INTEGER NOT NULL DEFAULT 0, failures INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      payload TEXT, done INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS budgets (day TEXT PRIMARY KEY, providers INTEGER NOT NULL DEFAULT 0, mutations INTEGER NOT NULL DEFAULT 0);`);
    const day = new Date(now).toISOString().slice(0, 10);
    ledger.prepare("INSERT OR IGNORE INTO budgets(day) VALUES (?)").run(day);
    // Local housekeeping only; retain recent dedupe/checkpoints, not endless logs.
    ledger.prepare("DELETE FROM jobs WHERE created_at < ? AND (done=1 OR payload IS NULL)").run(now - 14 * DAY);
    ledger.prepare("DELETE FROM budgets WHERE day < ?").run(new Date(now - 14 * DAY).toISOString().slice(0, 10));
    const candidates = source.prepare(`SELECT DISTINCT v.tmdb_id, v.tvmaze_id, v.season_number,
      v.episode_number, v.air_timestamp, v.name, t.title FROM provider_events v
      JOIN provider_events t ON t.tmdb_id=v.tmdb_id AND t.season_number=v.season_number AND t.episode_number=v.episode_number
      WHERE v.source_provider='tvmaze' AND t.source_provider='tmdb'
      AND v.air_timestamp BETWEEN ? AND ? AND t.air_timestamp > ?
      AND t.air_timestamp-v.air_timestamp BETWEEN 1 AND ?
      AND EXISTS (SELECT 1 FROM library_items l WHERE l.tmdb_id=v.tmdb_id AND l.tvmaze_id=v.tvmaze_id AND l.media_type='tv')
      ORDER BY v.air_timestamp LIMIT 32`).all(now - DAY, now - 5 * 60_000, now, DAY);
    metrics.candidates = candidates.length;
    for (const candidate of candidates) {
      const key = keyFor(candidate);
      ledger.prepare("INSERT OR IGNORE INTO jobs(key,tmdb,tvmaze,created_at) VALUES (?,?,?,?)")
        .run(key, candidate.tmdb_id, candidate.tvmaze_id, now);
      const job = ledger.prepare("SELECT * FROM jobs WHERE key=?").get(key);
      const budget = ledger.prepare("SELECT * FROM budgets WHERE day=?").get(day);
      if (job.done || job.payload || job.next_attempt > now || job.attempts >= LIMITS.attemptsPerEpisode) continue;
      if (budget.providers >= LIMITS.providerAttemptsPerDay || metrics.providerAttempts >= 2) { metrics.deferred++; continue; }
      ledger.prepare("UPDATE jobs SET attempts=attempts+1,next_attempt=? WHERE key=?").run(now + 60 * 60_000, key);
      ledger.prepare("UPDATE budgets SET providers=providers+1 WHERE day=?").run(day);
      metrics.providerAttempts++;
      const item = { media_type: "tv", tmdb_id: candidate.tmdb_id, tvmaze_id: candidate.tvmaze_id, title: candidate.title };
      try {
        const [tmdb, tvmaze] = await Promise.all([fetchTmdbDetails(item, now), fetchTvMazeEpisodes(item, now)]);
        const proof = confirmConflict(candidate, tmdb, tvmaze, now);
        if (!proof) { metrics.deferred++; continue; }
        metrics.proofs.push({ tmdbId: candidate.tmdb_id, ...proof });
        ledger.prepare("UPDATE jobs SET payload=?,next_attempt=0 WHERE key=?").run(JSON.stringify(proof), key);
      } catch { metrics.deferred++; }
    }
    if (dryRun) return metrics;
    metrics.blockedJobs = ledger.prepare("SELECT COUNT(*) AS n FROM jobs WHERE done=0 AND payload IS NOT NULL AND failures>=3").get().n;
    const jobs = ledger.prepare("SELECT * FROM jobs WHERE payload IS NOT NULL AND done=0 AND failures<3 AND next_attempt<=? ORDER BY created_at LIMIT 4").all(now);
    if (!jobs.length) return metrics; // No client initialization or Convex call on idle ticks.
    const { ConvexHttpClient } = await import("convex/browser");
    const { makeFunctionReference } = await import("convex/server");
    const token = process.env.SCHEDULE_CONFIDENCE_IMPORT_TOKEN;
    if (!token || !process.env.EXPO_PUBLIC_CONVEX_URL) throw new Error("Missing release timing deployment configuration");
    const client = new ConvexHttpClient(process.env.EXPO_PUBLIC_CONVEX_URL);
    for (const job of jobs) {
      for (;;) {
        const budget = ledger.prepare("SELECT * FROM budgets WHERE day=?").get(day);
        if (budget.mutations >= LIMITS.mutationCallsPerDay || metrics.mutationCalls >= LIMITS.pagesPerRun) {
          metrics.deferred++; break;
        }
        // Reserve before dispatch: lost responses/crashes cannot escape the cap.
        ledger.prepare("UPDATE budgets SET mutations=mutations+1 WHERE day=?").run(day);
        metrics.mutationCalls++;
        try {
          const result = await client.mutation(makeFunctionReference("scheduleConfidence:applyConfirmedReleasePage"), {
            importToken: token, tmdbId: job.tmdb, tvmazeId: job.tvmaze, correction: JSON.parse(job.payload),
          });
          metrics.users += result.users; metrics.writes += result.writes;
          if (result.done) { ledger.prepare("UPDATE jobs SET done=1 WHERE key=?").run(job.key); break; }
        } catch {
          ledger.prepare("UPDATE jobs SET failures=failures+1,next_attempt=? WHERE key=?").run(now + 60 * 60_000, job.key);
          metrics.deferred++; break;
        }
      }
    }
    return metrics;
  } finally { source.close(); ledger.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  loadEnvFile(path.join(root, ".env.local"));
  const folder = path.join(root, ".schedule-confidence");
  const dbPath = path.join(folder, "schedule-confidence.sqlite");
  if (!existsSync(dbPath)) throw new Error("Nightly provider cache is missing");
  const result = await runReleaseTiming({ dbPath,
    ledgerPath: path.join(folder, "release-timing.sqlite"), dryRun: !process.argv.includes("--apply"),
  });
  console.log(JSON.stringify(result));
  if (result.blockedJobs) process.exitCode = 1;
}

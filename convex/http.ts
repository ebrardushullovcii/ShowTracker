import { httpRouter } from "convex/server";
import { httpAction } from "@/convex/_generated/server";
import { internal } from "@/convex/_generated/api";
import { auth } from "@/convex/auth";

const http = httpRouter();

const anilistUrl =
  process.env.EXPO_PUBLIC_ANILIST_URL ?? "https://graphql.anilist.co";
const anilistProxyBaseDelayMs = 750;
const anilistProxyMaxAttempts = 4;
const allowLocalhostOrigins = process.env.ALLOW_LOCALHOST_ORIGINS === "true";
const providerEntitlementIds = (
  process.env.MONETIZATION_ENTITLEMENT_IDS ?? "ad_free,plus"
)
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const clerkPlusPlanIds = (
  process.env.CLERK_BILLING_PLUS_PLAN_IDS ?? "showtracker_plus_monthly,plus,ShowTracker Plus"
)
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);
const allowClerkAuthorizationFallback =
  process.env.CLERK_BILLING_ALLOW_AUTHORIZATION_FALLBACK === "true";

const configuredWebOrigins = [
  process.env.SHOWTRACKER_WEB_ORIGINS,
  process.env.WEB_APP_ORIGINS,
]
  .flatMap((value) => value?.split(",") ?? [])
  .map((value) => value.trim())
  .filter(Boolean);

const corsBaseHeaders = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  Vary: "Origin",
};

function createAbortError() {
  const error = new Error("Aborted");
  error.name = "AbortError";
  return error;
}

async function waitWithAbort(ms: number, signal: AbortSignal) {
  if (signal.aborted) {
    throw createAbortError();
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function isLocalDevOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  const isAllowedOrigin =
    configuredWebOrigins.includes(origin) ||
    (allowLocalhostOrigins && isLocalDevOrigin(origin));

  if (!isAllowedOrigin) {
    return null;
  }

  const headers = new Headers(corsBaseHeaders);
  headers.set("Access-Control-Allow-Origin", origin);
  const requestedHeaders = request.headers.get("access-control-request-headers");
  if (requestedHeaders) {
    headers.set("Access-Control-Allow-Headers", requestedHeaders);
  }
  return headers;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function isAuthorizedByEnv(request: Request, exactEnvName: string, bearerEnvName?: string) {
  const authorization = request.headers.get("authorization") ?? "";
  const exact = process.env[exactEnvName];
  if (exact) {
    return constantTimeEqual(authorization, exact);
  }

  const bearerSecret = bearerEnvName ? process.env[bearerEnvName] : undefined;
  if (bearerSecret) {
    return constantTimeEqual(authorization, `Bearer ${bearerSecret}`);
  }

  return null;
}

async function parseJsonBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNested(value: unknown, path: string[]) {
  let current = value;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) {
      return undefined;
    }
    current = record[key];
  }
  return current;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(getString).filter((entry): entry is string => Boolean(entry));
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function parseTimestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 100_000_000_000 ? value * 1000 : value;
  }

  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric < 100_000_000_000 ? numeric * 1000 : numeric;
    }

    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function getFirstMatchingEntitlementId(entitlementIds: string[]) {
  return entitlementIds.find((entitlementId) =>
    providerEntitlementIds.includes(entitlementId)
  );
}

function normalizeRevenueCatStatus(eventType: string, expiresAt?: number) {
  if (eventType === "EXPIRATION") {
    return "expired" as const;
  }

  if (eventType === "BILLING_ISSUE") {
    return "past_due" as const;
  }

  if (eventType === "CANCELLATION") {
    return typeof expiresAt === "number" && expiresAt > Date.now()
      ? ("active" as const)
      : ("canceled" as const);
  }

  if (typeof expiresAt === "number" && expiresAt <= Date.now()) {
    return "expired" as const;
  }

  return "active" as const;
}

function findClerkPlanIds(data: Record<string, unknown>) {
  return uniqueStrings([
    getString(data.plan_id),
    getString(data.planId),
    getString(data.plan),
    getString(getNested(data, ["plan", "id"])),
    getString(getNested(data, ["plan", "name"])),
    getString(getNested(data, ["subscription_item", "plan", "id"])),
    getString(getNested(data, ["subscription_item", "plan", "name"])),
    getString(getNested(data, ["subscriptionItem", "plan", "id"])),
    getString(getNested(data, ["subscriptionItem", "plan", "name"])),
  ]);
}

function findClerkPeriodEnd(data: Record<string, unknown>) {
  return (
    parseTimestampMs(data.period_end) ??
    parseTimestampMs(data.periodEnd) ??
    parseTimestampMs(data.current_period_end) ??
    parseTimestampMs(data.currentPeriodEnd) ??
    parseTimestampMs(getNested(data, ["subscription_item", "period_end"])) ??
    parseTimestampMs(getNested(data, ["subscriptionItem", "periodEnd"]))
  );
}

function normalizeClerkBillingStatus(eventType: string, currentPeriodEnd?: number) {
  if (eventType.endsWith(".active")) {
    return "active" as const;
  }

  if (eventType.endsWith(".pastDue")) {
    return "past_due" as const;
  }

  if (eventType.endsWith(".canceled")) {
    return typeof currentPeriodEnd === "number" && currentPeriodEnd > Date.now()
      ? ("active" as const)
      : ("canceled" as const);
  }

  if (
    eventType.endsWith(".ended") ||
    eventType.endsWith(".abandoned") ||
    eventType.endsWith(".incomplete")
  ) {
    return "expired" as const;
  }

  return null;
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: ArrayBuffer) {
  let binary = "";
  const array = new Uint8Array(bytes);
  for (const byte of array) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function verifySvixSignature(request: Request, rawBody: string) {
  const secret =
    process.env.CLERK_BILLING_WEBHOOK_SIGNING_SECRET ??
    process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return null;
  }

  const messageId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatureHeader = request.headers.get("svix-signature");
  if (!messageId || !timestamp || !signatureHeader) {
    return false;
  }

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const secretValue = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secretValue),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payload = `${messageId}.${timestamp}.${rawBody}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );
  const expected = bytesToBase64(signature);

  return signatureHeader
    .split(" ")
    .map((entry) => entry.trim())
    .some((entry) => {
      const signatureValue = entry.startsWith("v1,") ? entry.slice("v1,".length) : entry;
      return constantTimeEqual(signatureValue, expected);
    });
}

auth.addHttpRoutes(http);

http.route({
  path: "/anilist",
  method: "OPTIONS",
  handler: httpAction(async (_ctx, request) => {
    const corsHeaders = getCorsHeaders(request);
    if (!corsHeaders) {
      return Response.json(
        { error: "Origin not allowed." },
        {
          status: 403,
          headers: corsBaseHeaders,
        }
      );
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }),
});

http.route({
  path: "/anilist",
  method: "POST",
  handler: httpAction(async (_ctx, request) => {
    const corsHeaders = getCorsHeaders(request);
    if (!corsHeaders) {
      return Response.json(
        { error: "Origin not allowed." },
        {
          status: 403,
          headers: corsBaseHeaders,
        }
      );
    }

    try {
      const body = await request.json();
      if (!body || typeof body !== "object" || typeof body.query !== "string") {
        return Response.json(
          { error: "Invalid AniList payload." },
          {
            status: 400,
            headers: corsHeaders,
          }
        );
      }

      const payload = JSON.stringify({
        query: body.query,
        variables:
          body.variables && typeof body.variables === "object"
            ? body.variables
            : {},
      });

      for (let attempt = 1; attempt <= anilistProxyMaxAttempts; attempt += 1) {
        const upstream = await fetch(anilistUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: payload,
          signal: request.signal,
        });

        if (upstream.status !== 429 || attempt === anilistProxyMaxAttempts) {
          const headers = new Headers(corsHeaders);
          headers.set(
            "Content-Type",
            upstream.headers.get("content-type") ?? "application/json"
          );

          const retryAfter = upstream.headers.get("retry-after");
          if (retryAfter) {
            headers.set("Retry-After", retryAfter);
          }

          return new Response(await upstream.text(), {
            status: upstream.status,
            headers,
          });
        }

        const retryAfter = upstream.headers.get("retry-after");
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN;
        const delayMs = Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : anilistProxyBaseDelayMs * 2 ** (attempt - 1);
        await waitWithAbort(delayMs, request.signal);
      }

      return Response.json(
        { error: "AniList proxy request failed." },
        {
          status: 500,
          headers: new Headers(corsHeaders),
        }
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return new Response(null, {
          status: 499,
          headers: new Headers(corsHeaders),
        });
      }
      console.error("AniList proxy failed", error);
      return Response.json(
        { error: "AniList proxy request failed." },
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }
  }),
});

http.route({
  path: "/revenuecat-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorized = isAuthorizedByEnv(
      request,
      "REVENUECAT_WEBHOOK_AUTHORIZATION",
      "REVENUECAT_WEBHOOK_SECRET"
    );
    if (authorized === null) {
      return Response.json(
        { error: "RevenueCat webhook authorization is not configured." },
        { status: 503 }
      );
    }
    if (!authorized) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = asRecord(await parseJsonBody(await request.text()));
    const event = asRecord(payload?.event);
    if (!payload || !event) {
      return Response.json({ error: "Invalid RevenueCat payload." }, { status: 400 });
    }

    const eventType = getString(event.type)?.toUpperCase() ?? "UNKNOWN";
    const entitlementIds = [
      ...getStringArray(event.entitlement_ids),
      getString(event.entitlement_id),
    ].filter((entry): entry is string => Boolean(entry));
    const entitlementId = getFirstMatchingEntitlementId(entitlementIds);
    if (!entitlementId) {
      return Response.json({ ok: true, ignored: "entitlement" });
    }

    const expiresAt = parseTimestampMs(event.expiration_at_ms);
    const userIdCandidates = uniqueStrings([
      getString(event.app_user_id),
      getString(event.original_app_user_id),
      ...getStringArray(event.aliases),
    ]);
    if (userIdCandidates.length === 0) {
      return Response.json({ ok: true, ignored: "user" });
    }

    const result = await ctx.runMutation(internal.monetization.syncProviderEntitlement, {
      userIdCandidates,
      key: "ad_free",
      provider: "revenuecat",
      status: normalizeRevenueCatStatus(eventType, expiresAt),
      providerEntitlementId: entitlementId,
      providerProductId: getString(event.product_id),
      providerEventId: getString(event.id),
      planId: getString(event.presented_offering_id),
      startedAt: parseTimestampMs(event.purchased_at_ms),
      currentPeriodEnd: expiresAt,
      expiresAt,
    });

    if (!result.ok) {
      return Response.json({ ok: false, reason: result.reason });
    }

    return Response.json({ ok: true });
  }),
});

http.route({
  path: "/clerk-billing-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signatureAuthorized = await verifySvixSignature(request, rawBody);
    const headerAuthorized = allowClerkAuthorizationFallback
      ? isAuthorizedByEnv(
          request,
          "CLERK_BILLING_WEBHOOK_AUTHORIZATION",
          "CLERK_BILLING_WEBHOOK_SECRET"
        )
      : null;

    const hasAuthorizationConfigured =
      signatureAuthorized !== null || headerAuthorized !== null;
    const isAuthorized = signatureAuthorized === true || headerAuthorized === true;

    if (!hasAuthorizationConfigured) {
      return Response.json(
        { error: "Clerk webhook authorization is not configured." },
        { status: 503 }
      );
    }

    if (!isAuthorized) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const payload = asRecord(await parseJsonBody(rawBody));
    const data = asRecord(payload?.data);
    const eventType = getString(payload?.type);
    if (!payload || !data || !eventType) {
      return Response.json({ error: "Invalid Clerk payload." }, { status: 400 });
    }

    const status = normalizeClerkBillingStatus(eventType, findClerkPeriodEnd(data));
    if (!status) {
      return Response.json({ ok: true, ignored: "event_type" });
    }

    const planIds = findClerkPlanIds(data);
    const matchingPlanId = planIds.find((planId) =>
      clerkPlusPlanIds.includes(planId.toLowerCase())
    );
    if (!matchingPlanId) {
      return Response.json({ ok: true, ignored: "plan" });
    }

    const currentPeriodEnd = findClerkPeriodEnd(data);
    const userIdCandidates = uniqueStrings([
      getString(data.convexUserId),
      getString(data.user_id),
      getString(data.userId),
      getString(getNested(data, ["metadata", "convexUserId"])),
      getString(getNested(data, ["public_metadata", "convexUserId"])),
      getString(getNested(data, ["private_metadata", "convexUserId"])),
      getString(getNested(data, ["payer", "convexUserId"])),
      getString(getNested(data, ["payer", "user_id"])),
      getString(getNested(data, ["payer", "userId"])),
      getString(getNested(data, ["payer", "id"])),
    ]);
    if (userIdCandidates.length === 0) {
      return Response.json({ ok: true, ignored: "user" });
    }

    const result = await ctx.runMutation(internal.monetization.syncProviderEntitlement, {
      userIdCandidates,
      key: "ad_free",
      provider: "clerk_billing",
      status,
      providerEntitlementId: "ad_free",
      providerProductId: matchingPlanId,
      providerEventId: getString(payload.id),
      planId: matchingPlanId,
      currentPeriodEnd,
      expiresAt: status === "expired" ? Date.now() : currentPeriodEnd,
    });

    if (!result.ok) {
      return Response.json({ ok: false, reason: result.reason });
    }

    return Response.json({ ok: true });
  }),
});

export default http;

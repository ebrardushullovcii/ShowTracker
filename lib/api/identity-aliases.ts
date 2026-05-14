import type {
  ExternalAliasConfidence,
  ExternalAliasProvider,
  NormalizedExternalAlias,
} from "@/lib/api/types";

type DirectIdentityAliasInput = {
  tmdbId?: number | string | null;
  tvdbId?: number | string | null;
  imdbId?: string | null;
  anilistId?: number | string | null;
  malId?: number | string | null;
  tvmazeId?: number | string | null;
};

function normalizeUrlExternalId(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    parsed.search = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return value.trim().replace(/\/+$/, "").toLowerCase();
  }
}

function getSocialHandle(value: string, provider: "twitter" | "instagram" | "facebook") {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const allowedHosts =
      provider === "twitter"
        ? new Set(["twitter.com", "x.com"])
        : provider === "instagram"
          ? new Set(["instagram.com"])
          : new Set(["facebook.com", "fb.com"]);
    if (!allowedHosts.has(host)) {
      return null;
    }

    const [firstSegment] = parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (!firstSegment) {
      return null;
    }

    return firstSegment.replace(/^@/, "").toLowerCase();
  } catch {
    return trimmed.replace(/^@/, "").toLowerCase();
  }
}

export function normalizeIdentityAliasExternalId(
  provider: ExternalAliasProvider,
  value: string | number | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed || trimmed === "0" || trimmed === "-1") {
    return null;
  }

  if (provider === "twitter" || provider === "instagram" || provider === "facebook") {
    return getSocialHandle(trimmed, provider);
  }

  if (provider === "official_site" || provider === "crunchyroll") {
    return normalizeUrlExternalId(trimmed);
  }

  return trimmed.toLowerCase();
}

export function createIdentityAlias(
  provider: ExternalAliasProvider,
  externalId: string | number | null | undefined,
  source: string,
  confidence: ExternalAliasConfidence = "provider"
): NormalizedExternalAlias | null {
  const normalizedExternalId = normalizeIdentityAliasExternalId(provider, externalId);
  if (!normalizedExternalId) {
    return null;
  }

  return {
    provider,
    externalId: normalizedExternalId,
    source,
    confidence,
  };
}

export function getIdentityAliasKey(alias: {
  provider: ExternalAliasProvider;
  externalId: string;
}) {
  const normalizedExternalId = normalizeIdentityAliasExternalId(
    alias.provider,
    alias.externalId
  );
  return normalizedExternalId ? `${alias.provider}:${normalizedExternalId}` : null;
}

export function dedupeIdentityAliases(
  aliases: Array<NormalizedExternalAlias | null | undefined>
) {
  const byKey = new Map<string, NormalizedExternalAlias>();

  for (const alias of aliases) {
    if (!alias) {
      continue;
    }

    const normalizedExternalId = normalizeIdentityAliasExternalId(
      alias.provider,
      alias.externalId
    );
    if (!normalizedExternalId) {
      continue;
    }

    const key = `${alias.provider}:${normalizedExternalId}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...alias,
        externalId: normalizedExternalId,
      });
    }
  }

  return Array.from(byKey.values());
}

export function collectDirectIdentityAliases(
  input: DirectIdentityAliasInput,
  source: string,
  confidence: ExternalAliasConfidence = "verified"
) {
  return dedupeIdentityAliases([
    createIdentityAlias("tmdb", input.tmdbId, source, confidence),
    createIdentityAlias("tvdb", input.tvdbId, source, confidence),
    createIdentityAlias("imdb", input.imdbId, source, confidence),
    createIdentityAlias("anilist", input.anilistId, source, confidence),
    createIdentityAlias("mal", input.malId, source, confidence),
    createIdentityAlias("tvmaze", input.tvmazeId, source, confidence),
  ]);
}

export function createIdentityAliasFromExternalShowId(
  showId: string,
  source: string
) {
  const parts = showId.split(":");
  const providerRaw = parts[0];
  const externalId = providerRaw === "tmdb" && parts.length >= 3 ? parts[2] : parts[1];
  const provider =
    providerRaw === "jikan"
      ? "mal"
      : providerRaw === "tmdb" ||
          providerRaw === "tvdb" ||
          providerRaw === "imdb" ||
          providerRaw === "anilist" ||
          providerRaw === "mal" ||
          providerRaw === "tvmaze"
        ? providerRaw
        : null;

  return provider ? createIdentityAlias(provider, externalId, source, "verified") : null;
}

function getProviderFromAniListExternalLink(site?: string | null, url?: string | null) {
  const normalizedSite = site?.trim().toLowerCase() ?? "";
  const normalizedUrl = url?.trim().toLowerCase() ?? "";

  if (normalizedSite === "twitter" || normalizedUrl.includes("twitter.com/")) {
    return "twitter" as const;
  }
  if (normalizedUrl.includes("x.com/")) {
    return "twitter" as const;
  }
  if (normalizedSite === "instagram" || normalizedUrl.includes("instagram.com/")) {
    return "instagram" as const;
  }
  if (normalizedSite === "facebook" || normalizedUrl.includes("facebook.com/")) {
    return "facebook" as const;
  }
  if (normalizedSite === "official site") {
    return "official_site" as const;
  }
  if (normalizedSite === "crunchyroll" || normalizedUrl.includes("crunchyroll.com/")) {
    return "crunchyroll" as const;
  }

  return null;
}

export function createIdentityAliasFromAniListExternalLink(
  link: { site?: string | null; url?: string | null },
  source: string
) {
  const provider = getProviderFromAniListExternalLink(link.site, link.url);
  if (!provider || !link.url) {
    return null;
  }

  return createIdentityAlias(provider, link.url, source, "provider");
}

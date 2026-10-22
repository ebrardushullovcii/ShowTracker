import { toHttpsImageUrl } from "../image-url";

export type ShowCastMember = {
  id: string;
  name: string;
  character?: string;
  photoUrl?: string;
  /** Character art, only provided by AniList. */
  characterImageUrl?: string;
  isVoice: boolean;
  voiceLanguage?: string;
  isMainCharacter?: boolean;
  episodeCount?: number;
  /** Only set when the person played more than one role (anthologies). */
  roleCount?: number;
};

export type ShowCrewMember = {
  id: string;
  name: string;
  job: string;
  photoUrl?: string;
};

export type ShowCredits = {
  cast: ShowCastMember[];
  crew: ShowCrewMember[];
};

export const EMPTY_SHOW_CREDITS: ShowCredits = { cast: [], crew: [] };

const MAX_CAST = 20;
const MAX_CREW = 12;
const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

const VOICE_SUFFIX = /\s*\((?:voice|uncredited voice)\)\s*$/i;

function splitVoiceCharacter(character?: string | null) {
  const trimmed = character?.trim() ?? "";
  return {
    character: trimmed.replace(VOICE_SUFFIX, "").trim() || undefined,
    isVoice: VOICE_SUFFIX.test(trimmed),
  };
}

function tmdbProfileUrl(path?: string | null) {
  return path ? `${TMDB_PROFILE_BASE}${path}` : undefined;
}

function anilistImageUrl(url?: string | null) {
  // AniList serves a generic silhouette for people and characters without art.
  if (!url || /\/default\.(?:jpg|png)$/i.test(url)) {
    return undefined;
  }
  return toHttpsImageUrl(url) || undefined;
}

function mergeCrew(entries: ShowCrewMember[]) {
  const byPerson = new Map<string, ShowCrewMember>();
  for (const entry of entries) {
    const existing = byPerson.get(entry.id);
    if (!existing) {
      byPerson.set(entry.id, { ...entry });
      continue;
    }
    if (!existing.job.split(", ").includes(entry.job)) {
      existing.job = `${existing.job}, ${entry.job}`;
    }
  }
  return Array.from(byPerson.values()).slice(0, MAX_CREW);
}

// ---------- TMDB ----------

type TmdbPerson = {
  id: number;
  name?: string;
  profile_path?: string | null;
};

export type TmdbCreditsPayload = {
  created_by?: TmdbPerson[];
  credits?: {
    cast?: (TmdbPerson & { character?: string | null; order?: number })[];
    crew?: (TmdbPerson & { job?: string | null })[];
  };
  aggregate_credits?: {
    cast?: (TmdbPerson & {
      roles?: { character?: string | null; episode_count?: number }[];
      total_episode_count?: number;
    })[];
    crew?: (TmdbPerson & {
      jobs?: { job?: string | null; episode_count?: number }[];
      total_episode_count?: number;
    })[];
  };
};

const TMDB_MOVIE_CREW_JOBS: Record<string, string> = {
  Director: "Director",
  Screenplay: "Screenplay",
  Writer: "Writer",
  Novel: "Novel",
  "Original Music Composer": "Composer",
};

const TMDB_TV_CREW_JOBS: { job: string; label: string; limit: number }[] = [
  { job: "Director", label: "Director", limit: 2 },
  { job: "Writer", label: "Writer", limit: 2 },
  { job: "Original Music Composer", label: "Composer", limit: 1 },
];

function normalizeTmdbTvCast(payload: TmdbCreditsPayload): ShowCastMember[] {
  return (payload.aggregate_credits?.cast ?? [])
    .filter((person) => person.name)
    .slice(0, MAX_CAST)
    .map((person) => {
      const roles = person.roles ?? [];
      // Anthology actors list every role; show the one they played the longest.
      const topRole = [...roles].sort(
        (a, b) => (b.episode_count ?? 0) - (a.episode_count ?? 0)
      )[0];
      const { character, isVoice } = splitVoiceCharacter(topRole?.character);
      return {
        id: `tmdb:person:${person.id}`,
        name: person.name!,
        character,
        photoUrl: tmdbProfileUrl(person.profile_path),
        isVoice,
        episodeCount: person.total_episode_count || undefined,
        roleCount: roles.length > 1 ? roles.length : undefined,
      };
    });
}

function normalizeTmdbMovieCast(payload: TmdbCreditsPayload): ShowCastMember[] {
  return (payload.credits?.cast ?? [])
    .filter((person) => person.name)
    .slice(0, MAX_CAST)
    .map((person) => {
      const { character, isVoice } = splitVoiceCharacter(person.character);
      return {
        id: `tmdb:person:${person.id}`,
        name: person.name!,
        character,
        photoUrl: tmdbProfileUrl(person.profile_path),
        isVoice,
      };
    });
}

function normalizeTmdbTvCrew(payload: TmdbCreditsPayload): ShowCrewMember[] {
  const creators = (payload.created_by ?? [])
    .filter((person) => person.name)
    .map((person) => ({
      id: `tmdb:person:${person.id}`,
      name: person.name!,
      job: "Creator",
      photoUrl: tmdbProfileUrl(person.profile_path),
    }));

  const aggregateCrew = payload.aggregate_credits?.crew ?? [];
  const byJob = TMDB_TV_CREW_JOBS.flatMap(({ job, label, limit }) =>
    aggregateCrew
      .map((person) => ({
        person,
        episodes: person.jobs?.find((entry) => entry.job === job)?.episode_count ?? 0,
      }))
      .filter(({ person, episodes }) => person.name && episodes > 0)
      .sort((a, b) => b.episodes - a.episodes)
      .slice(0, limit)
      .map(({ person }) => ({
        id: `tmdb:person:${person.id}`,
        name: person.name!,
        job: label,
        photoUrl: tmdbProfileUrl(person.profile_path),
      }))
  );

  return mergeCrew([...creators, ...byJob]);
}

function normalizeTmdbMovieCrew(payload: TmdbCreditsPayload): ShowCrewMember[] {
  const order = Object.keys(TMDB_MOVIE_CREW_JOBS);
  const entries = (payload.credits?.crew ?? [])
    .filter((person) => person.name && person.job && person.job in TMDB_MOVIE_CREW_JOBS)
    .sort((a, b) => order.indexOf(a.job!) - order.indexOf(b.job!))
    .map((person) => ({
      id: `tmdb:person:${person.id}`,
      name: person.name!,
      job: TMDB_MOVIE_CREW_JOBS[person.job!],
      photoUrl: tmdbProfileUrl(person.profile_path),
    }));
  return mergeCrew(entries);
}

export function normalizeTmdbCredits(
  mediaType: "tv" | "movie",
  payload: TmdbCreditsPayload
): ShowCredits {
  if (mediaType === "movie") {
    return { cast: normalizeTmdbMovieCast(payload), crew: normalizeTmdbMovieCrew(payload) };
  }
  return { cast: normalizeTmdbTvCast(payload), crew: normalizeTmdbTvCrew(payload) };
}

// ---------- AniList ----------

type AniListPersonImage = { large?: string | null } | null;

type AniListVoiceActor = {
  id: number;
  name?: { full?: string | null } | null;
  image?: AniListPersonImage;
  languageV2?: string | null;
};

export type AniListCreditsMedia = {
  characters?: {
    edges?: ({
      role?: string | null;
      node?: {
        id: number;
        name?: { full?: string | null } | null;
        image?: AniListPersonImage;
      } | null;
      japaneseVoiceActors?: AniListVoiceActor[] | null;
      voiceActors?: AniListVoiceActor[] | null;
    } | null)[] | null;
  } | null;
  staff?: {
    edges?: ({
      role?: string | null;
      node?: {
        id: number;
        name?: { full?: string | null } | null;
        image?: AniListPersonImage;
      } | null;
    } | null)[] | null;
  } | null;
};

// Per-episode and production-line staff roles are noise on a title page.
const ANILIST_SKIPPED_STAFF_ROLE = /\(ep|episode|assistant|key animation|in-between|2nd|storyboard|production|theme song|insert song|animation director|ADR|translation/i;

export function normalizeAniListCredits(media: AniListCreditsMedia): ShowCredits {
  const cast: ShowCastMember[] = [];
  for (const edge of media.characters?.edges ?? []) {
    const character = edge?.node;
    if (!character?.name?.full) continue;
    const voiceActor = edge?.japaneseVoiceActors?.[0] ?? edge?.voiceActors?.[0];
    const voiceLanguage = edge?.japaneseVoiceActors?.[0]
      ? "Japanese"
      : voiceActor?.languageV2 ?? undefined;
    cast.push({
      id: `anilist:character:${character.id}`,
      name: voiceActor?.name?.full ?? "",
      character: character.name.full,
      photoUrl: anilistImageUrl(voiceActor?.image?.large),
      characterImageUrl: anilistImageUrl(character.image?.large),
      isVoice: true,
      voiceLanguage,
      isMainCharacter: edge?.role === "MAIN",
    });
    if (cast.length >= MAX_CAST) break;
  }

  const crew = mergeCrew(
    (media.staff?.edges ?? [])
      .filter((edge) => edge?.node?.name?.full && edge.role && !ANILIST_SKIPPED_STAFF_ROLE.test(edge.role))
      .map((edge) => ({
        id: `anilist:staff:${edge!.node!.id}`,
        name: edge!.node!.name!.full!,
        job: edge!.role!.replace(/\s*\(.*\)\s*$/, "").trim(),
        photoUrl: anilistImageUrl(edge!.node!.image?.large),
      }))
  );

  return { cast, crew };
}

// ---------- TVMaze ----------

type TvMazeImage = { medium?: string | null; original?: string | null } | null;

export type TvMazeCastEntry = {
  person?: { id: number; name?: string | null; image?: TvMazeImage } | null;
  character?: { id: number; name?: string | null; image?: TvMazeImage } | null;
  voice?: boolean;
};

export type TvMazeCrewEntry = {
  type?: string | null;
  person?: { id: number; name?: string | null; image?: TvMazeImage } | null;
};

const TVMAZE_CREW_TYPES = ["Creator", "Developer", "Showrunner"];

export function normalizeTvMazeCredits(
  castEntries: TvMazeCastEntry[],
  crewEntries: TvMazeCrewEntry[]
): ShowCredits {
  const cast = castEntries
    .filter((entry) => entry.person?.name)
    .slice(0, MAX_CAST)
    .map((entry) => ({
      id: `tvmaze:person:${entry.person!.id}`,
      name: entry.person!.name!,
      character: entry.character?.name ?? undefined,
      photoUrl: toHttpsImageUrl(entry.person!.image?.medium) || undefined,
      isVoice: Boolean(entry.voice),
    }));

  const crew = mergeCrew(
    crewEntries
      .filter((entry) => entry.person?.name && entry.type && TVMAZE_CREW_TYPES.includes(entry.type))
      .map((entry) => ({
        id: `tvmaze:person:${entry.person!.id}`,
        name: entry.person!.name!,
        job: entry.type === "Developer" ? "Developer" : entry.type!,
        photoUrl: toHttpsImageUrl(entry.person!.image?.medium) || undefined,
      }))
  );

  return { cast, crew };
}

# ADR-0055: Multilingual TV Time Provider Identity

## Status

Accepted

## Context

A second official TV Time GDPR archive exposed provider matches that the first archive did not.
Localized movie titles such as `君の名は。` and `火垂るの墓` were either unresolved or matched to an
unrelated English search result. English TV Time aliases could also differ from the current TMDB title:
`The Brave` is the TVDB alias for the Turkish series `Hudutsuz Sevda`, which TMDB presents as
`Boundless Love`. Coverage scoring alone accepted unrelated catalogues with enough episodes, including
an unrelated Haunting title.

Three public TVDB episode records also use coordinates that TMDB represents differently. Wizards of
Waverly Place and iCarly split a finale into two source records while TMDB stores one combined episode.
Game of Thrones identifies `The Last Watch` as S00E55 while TMDB stores it as S00E314.
TVDB also stores three Naruto films as series specials while TMDB stores them as movies.

## Current Behavior

The importer hydrates TMDB candidates before final scoring and preserves their original and alternative
titles. Title comparison is Unicode-aware. Exact TVDB-to-provider lookups are evaluated before title
search candidates, while search candidates must still pass hydrated title/alias and year confidence.

TV Time anthology histories can span explicitly related titles such as `The Haunting of Hill House`
and `The Haunting of Bly Manor`. A small registry maps verified public TVDB episode IDs to their TMDB
coordinates. When split source parts resolve to one provider episode, their provenance IDs are retained
and their watch ordinals are paired instead of being counted as separate rewatches.

## Decision

- Preserve TMDB original and alternative titles in normalized provider results.
- Normalize titles with Unicode letter and number classes; do not erase non-Latin scripts.
- Search exact titles, yearless titles, and a safely stripped creator possessive variant.
- Use release-year filters when the GDPR archive supplies a movie year.
- Trust an exact external-ID lookup as provider identity even when localized display titles differ.
- Revalidate ordinary search results after details hydration; episode coverage cannot rescue a title
  that fails identity confidence.
- Treat `${source title} of ...` as an explicit anthology continuation eligible for provider spanning.
- Override coordinates only through a source episode ID verified against public TVDB and TMDB records.
- Route a series special to a movie only through the same verified source-episode identity.
- Preserve all source episode IDs when multiple source parts collapse into one canonical episode.
- Pair combined-part watch histories by watch ordinal and use the later timestamp for each completion;
  never manufacture a rewatch by summing the parts.

## Reasoning

Localized provider names are presentation data, so exact external identity is stronger than string
similarity. Search results do not have that guarantee and must satisfy hydrated aliases and year before
coverage is considered. Public episode IDs provide a narrow, reviewable correction for true catalogue
differences without turning ordinal guessing into a universal exception.

The completion of a combined provider episode occurs only after its final source part. Pairing each
part's first watch, second watch, and so on preserves real rewatches while counting the combined runtime
once.

## Provider And Data Assumptions

TV Time's `s_id` is treated as a TVDB series candidate when TMDB or TVMaze confirms it. A TV Time
`ep_id` is stored as source provenance and gains coordinate authority only when listed in the verified
alias registry. TMDB details and alternative-title responses are the canonical search metadata.

The current verified aliases are TVDB episode `7659644` to TMDB Wizards S04E27, `4432653` to TMDB
iCarly S06E13, and `7107505` to TMDB Game of Thrones S00E314. Naruto TVDB specials `4117651`,
`4564234`, and `5235891` map to TMDB movies `75624`, `118406`, and `317442` respectively.

## Edge Cases

- A localized title can match the provider original title even when no English alias exists.
- A creator prefix such as `Tyler Perry's` is removed only as an additional query; candidate scoring
  still validates the full source title.
- An exact external series may have a translated provider title absent from TMDB aliases.
- Anthology continuation matching does not apply to metadata-only entries.
- An alias is ignored when the resolved TMDB show ID differs from the registry entry.
- Existing canonical records remain valid because multi-source provenance is optional.

## Verification

- Unit-test Unicode original-title matching, alternative-title matching, alias scoping, and coordinate
  override behavior.
- Audit every item in both available official GDPR archives against live provider catalogues.
- Verify `The Brave` resolves to TMDB 231100 and `The Haunting` splits 10 + 9 across its two seasons.
- Verify the six previously unresolved localized/creator-prefixed movies resolve to their intended TMDB
  records.
- Verify all 15,782 source episode rows in the second archive are accounted for and the three known
  coordinate exceptions no longer remain unmatched.
- Run importer tests, TypeScript, lint, React Doctor, and Convex deployment validation.

## Rollback Notes

Remove hydrated alias scoring and the verified episode registry together. Existing
`sourceEpisodeIds` arrays may remain because they are optional provenance and do not alter normal
tracking. Reverting combined-part history pairing can overcount rewatches and should be avoided unless
the affected canonical records are rebuilt.

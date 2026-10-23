export type CaughtUpSaying = {
  line: string;
  source: string;
};

// Short nods to shows, anime and movies, each bent toward "nothing left to watch".
export const CAUGHT_UP_SAYINGS: readonly CaughtUpSaying[] = [
  { line: "That's all, folks!", source: "Looney Tunes" },
  { line: "To be continued...", source: "JoJo's Bizarre Adventure" },
  { line: "Yare yare daze. Nothing left to watch.", source: "JoJo's Bizarre Adventure" },
  { line: "Gotta watch 'em all. You did.", source: "Pokémon" },
  { line: "Believe it! You're all caught up.", source: "Naruto" },
  { line: "Plus Ultra! Every episode cleared.", source: "My Hero Academia" },
  { line: "Bankai complete. The queue is empty.", source: "Bleach" },
  { line: "A short wait, by elf standards.", source: "Frieren" },
  { line: "Mischief managed.", source: "Harry Potter" },
  { line: "This is the way. And you've walked all of it.", source: "The Mandalorian" },
  { line: "Winter is coming. So is the next episode.", source: "Game of Thrones" },
  { line: "You shall not pass... until the next episode airs.", source: "The Lord of the Rings" },
  { line: "The truth is out there. The next episode isn't yet.", source: "The X-Files" },
  { line: "Live long and prosper. See you next episode.", source: "Star Trek" },
  { line: "Allons-y! Off to find something new.", source: "Doctor Who" },
  { line: "How you doin'? Caught up, apparently.", source: "Friends" },
  { line: "Everything is awesome. Everything is watched.", source: "The Lego Movie" },
  { line: "Cowabunga! Not a single episode left.", source: "Teenage Mutant Ninja Turtles" },
  { line: "Elementary. You've seen every last one.", source: "Sherlock" },
  { line: "I'll be back. So will your shows.", source: "The Terminator" },
  { line: "Same time next week?", source: "Every TV show ever" },
  { line: "Previously on... everything. You've seen it all.", source: "Every recap ever" },
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Picks one saying per local calendar day, so it stays put between renders. */
export function pickCaughtUpSaying(now: Date = new Date()): CaughtUpSaying {
  const localDay = Math.floor((now.getTime() - now.getTimezoneOffset() * 60 * 1000) / DAY_MS);
  const index = ((localDay % CAUGHT_UP_SAYINGS.length) + CAUGHT_UP_SAYINGS.length) % CAUGHT_UP_SAYINGS.length;
  return CAUGHT_UP_SAYINGS[index];
}

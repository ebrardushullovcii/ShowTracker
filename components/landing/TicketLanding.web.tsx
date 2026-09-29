import type { CSSProperties, MouseEvent, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ticketLandingCss } from "./ticketLandingStyles";

// Web-only marketing page. It renders plain DOM so the ticket, perforation and marquee lights
// can use CSS that React Native styles cannot express. Assets live in `public/landing/`.
const ASSETS = "/landing";
const GITHUB_URL = "https://github.com/ebrardushullovcii/ShowTracker";

const TRAILER_CHAPTERS = [
  { label: "Discover", at: 3.1 },
  { label: "Details", at: 7.3 },
  { label: "Track", at: 11.6 },
  { label: "Schedule", at: 16.2 },
  { label: "Stats", at: 23 },
  { label: "Together & import", at: 27.3 },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

function formatTime(seconds: number) {
  return `0:${String(Math.floor(seconds)).padStart(2, "0")}`;
}

/** Plays a muted looping video only while it is on screen. */
function useVisibleAutoplay(ref: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const video = ref.current;
    if (!video || prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    video.muted = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.3 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [ref]);
}

function AppLink({ href, className, children }: { href: "/login" | "/register"; className?: string; children: ReactNode }) {
  const router = useRouter();
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    router.push(href);
  };
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function Phone({ finish, width, children }: { finish: "orange" | "blue" | "silver"; width: number; children: ReactNode }) {
  return (
    <div className={`tk-ph tk-fin-${finish}`} style={{ "--w": `${width}px` } as CSSProperties}>
      <div className="tk-ph-f">
        <div className="tk-ph-k">
          <div className="tk-ph-s">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** A stitched page that scrolls between the app's fixed top bar and tab bar. */
function TallPage({ name, top, max, duration }: { name: string; top: string; max: string; duration: string }) {
  return (
    <div className="tk-tall" style={{ "--top": top, "--max": max, "--dur": duration } as CSSProperties}>
      <img className="tk-t-img" src={`${ASSETS}/${name}.jpg`} alt="" loading="lazy" />
      <img className="tk-t-top" src={`${ASSETS}/${name}-top.jpg`} alt="" loading="lazy" />
      <img className="tk-t-tab" src={`${ASSETS}/${name}-tab.jpg`} alt="" loading="lazy" />
    </div>
  );
}

function Screen({ file, alt }: { file: string; alt: string }) {
  return <img src={`${ASSETS}/${file}`} alt={alt} loading="lazy" />;
}

type Reel = {
  id: string;
  label: string;
  title: string;
  copy: string;
  points?: string[];
  steps?: string[];
  stage: ReactNode;
};

const REELS: Reel[] = [
  {
    id: "discover",
    label: "Discover",
    title: "Find what's worth watching",
    copy: "Trending TV, anime and movies in one feed. Filter by genre, year and rating, or search all three at once.",
    points: ["Trending across TV, anime and movies", "One search box for everything", "Every season and episode, with air dates"],
    stage: (
      <Phone finish="orange" width={300}>
        <TallPage name="discover" top="8.696%" max="-58.3%" duration="26s" />
      </Phone>
    ),
  },
  {
    id: "watchlist",
    label: "Watchlist",
    title: "Your next episode, front and center",
    copy: "Home is your watchlist. Every card shows how many episodes are left, and the show you just watched moves to the front.",
    points: ["Episodes-left badge on every card", "Filter to TV shows or anime", "Paused and finished shows stay out of the way"],
    stage: (
      <Phone finish="blue" width={300}>
        <Screen file="home.jpg" alt="Home watchlist with episodes-left badges" />
      </Phone>
    ),
  },
  {
    id: "tracking",
    label: "Tracking",
    title: "One tap. Watched everywhere.",
    copy: "Tap the check on an episode and your progress updates on your phone and in your browser at the same moment. Binged a season? Mark it in one go.",
    points: ["Progress per episode, season and show", "Syncs instantly across devices", "Movies too"],
    stage: (
      <div className="tk-stage">
        <Phone finish="silver" width={300}>
          <Screen file="show-check.jpg" alt="Show page with an episode marked watched" />
        </Phone>
        <img className="tk-float tk-float-watched" src={`${ASSETS}/watched.png`} alt="" loading="lazy" />
      </div>
    ),
  },
  {
    id: "schedule",
    label: "Schedule",
    title: "This week, already sorted",
    copy: "New episodes from everything you track, grouped by day in your own time zone. A week strip on your phone and a full month calendar on desktop.",
    points: ["Premieres, weekly episodes and returns", "Tomorrow, in 3 days, next week at a glance", "TV and anime side by side"],
    stage: (
      <Phone finish="orange" width={300}>
        <TallPage name="schedwed" top="29.82%" max="-24.2%" duration="14s" />
      </Phone>
    ),
  },
  {
    id: "together",
    label: "Together",
    title: "Watch with others. Nobody gets ahead.",
    copy: "Some shows you only watch with a partner or friends. Add their names and those shows get their own section on Home, apart from the ones you watch alone.",
    points: ["Names on every shared show", "A separate queue for watching together", "Move a show back to solo any time"],
    stage: (
      <div className="tk-stage">
        <Phone finish="blue" width={300}>
          <Screen file="tracking.jpg" alt="Watching with others settings on a show" />
        </Phone>
        <img className="tk-float tk-float-shared" src={`${ASSETS}/shared.png`} alt="" loading="lazy" />
      </div>
    ),
  },
  {
    id: "import",
    label: "Import",
    title: "Leaving TV Time? Bring your history.",
    copy: "Your watched episodes, statuses, favorites and lists come with you.",
    steps: ["Request your TV Time GDPR archive.", "Select the ZIP. No extracting.", "It's parsed on your device. Review, then import."],
    stage: (
      <Phone finish="silver" width={300}>
        <Screen file="import.jpg" alt="TV Time import screen" />
      </Phone>
    ),
  },
  {
    id: "stats",
    label: "Stats",
    title: "Your watch history, added up",
    copy: "Total watch time, episodes logged and how many shows you've finished, calculated live from what you've watched.",
    points: ["Watch time in months, days and hours", "Completion across your library", "Split by TV, anime and movies"],
    stage: (
      <Phone finish="orange" width={300}>
        <Screen file="profile.jpg" alt="Profile stats with total watch time" />
      </Phone>
    ),
  },
];

const FAQ = [
  { q: "What does it cost?", a: "Nothing. There's no subscription and no ads." },
  { q: "What can I track?", a: "TV shows, anime and movies: single episodes, whole seasons, finished shows and films." },
  { q: "Where does the data come from?", a: "Catalog details and air dates come from TMDB, AniList, TVMaze and Jikan." },
  { q: "Can I bring my TV Time history?", a: "Yes. Request your GDPR archive from TV Time and select the ZIP. It's read on your device." },
  { q: "Which devices?", a: "Any browser, plus iPhone and Android. One account keeps them all in sync." },
  { q: "Is it open source?", a: "Yes. The code is public on GitHub, and anyone can read it or suggest changes." },
];

/** In-page link that scrolls the landing's own container instead of changing the route. */
function SectionLink({ target, children, className }: { target: string; children: ReactNode; className?: string }) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (target === "top") document.querySelector(".tk")?.scrollTo({ top: 0, behavior });
    else document.getElementById(target)?.scrollIntoView({ behavior, block: "start" });
  };
  return (
    <a href={target === "top" ? "/" : `#${target}`} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

export function TicketLanding() {
  const trailerRef = useRef<HTMLVideoElement>(null);
  const desktopRef = useRef<HTMLVideoElement>(null);
  const [chapter, setChapter] = useState(-1);
  useVisibleAutoplay(trailerRef);
  useVisibleAutoplay(desktopRef);

  const reduceMotion = prefersReducedMotion();

  const seek = (at: number) => {
    const video = trailerRef.current;
    if (!video) return;
    video.muted = true;
    video.currentTime = at;
    void video.play().catch(() => undefined);
  };

  const onTrailerTime = () => {
    const time = trailerRef.current?.currentTime ?? 0;
    let active = -1;
    TRAILER_CHAPTERS.forEach((c, i) => {
      if (time >= c.at - 0.2) active = i;
    });
    setChapter(active);
  };

  return (
    <div className="tk">
      <style>{ticketLandingCss}</style>

      <header className="tk-nav">
        <div className="tk-wrap">
          <SectionLink target="top" className="tk-logo">
            <img src={`${ASSETS}/mark.png`} alt="" />
            ShowTracker
          </SectionLink>
          <nav aria-label="Sections">
            <SectionLink target="trailer">Trailer</SectionLink>
            <SectionLink target="program">Program</SectionLink>
            <SectionLink target="box-office">Box office</SectionLink>
          </nav>
          <div className="tk-nav-cta">
            <AppLink href="/login" className="tk-btn tk-btn-ghost">Sign in</AppLink>
            <AppLink href="/register" className="tk-btn tk-btn-paper">Get started</AppLink>
          </div>
        </div>
      </header>

      <main>
        <section className="tk-wrap tk-hero">
          <p className="tk-kick">Now showing on every screen</p>
          <div className="tk-ticket">
            <div className="tk-t-main">
              <span className="tk-t-k">Feature presentation</span>
              <h1>ShowTracker</h1>
              <p>One queue for every show, anime and movie you watch. It remembers where you left off and tells you what airs next.</p>
              <dl className="tk-fine">
                <div><dt>Screens</dt><dd>Web · iOS · Android</dd></div>
                <div><dt>Admission</dt><dd>Free</dd></div>
                <div><dt>Ads</dt><dd>None</dd></div>
                <div><dt>Source</dt><dd>Open</dd></div>
              </dl>
            </div>
            <div className="tk-t-stub">
              <span className="tk-admit">Admit<br />one</span>
              <div className="tk-barcode" aria-hidden="true" />
              <span className="tk-no">NO. 000001 · ROW A</span>
              <AppLink href="/register" className="tk-btn tk-btn-ink">Get in free</AppLink>
              <small>Have an account? <AppLink href="/login">Sign in</AppLink></small>
            </div>
          </div>
          <div className="tk-genres" aria-label="What you can track">
            <span>TV shows</span><span>Anime</span><span>Movies</span>
          </div>
        </section>

        <section className="tk-wrap tk-sec" id="trailer">
          <div className="tk-head">
            <small>The trailer</small>
            <h2>ShowTracker in 38 seconds</h2>
          </div>
          <div className="tk-marquee">
            <video
              ref={trailerRef}
              src={`${ASSETS}/product.mp4`}
              poster={`${ASSETS}/product-poster.jpg`}
              muted
              loop
              playsInline
              controls
              preload="metadata"
              onTimeUpdate={onTrailerTime}
            />
          </div>
          <div className="tk-chaps" role="group" aria-label="Jump to a scene">
            {TRAILER_CHAPTERS.map((c, i) => (
              <button key={c.label} type="button" aria-current={chapter === i} onClick={() => seek(c.at)}>
                <small>{formatTime(c.at)}</small>
                {c.label}
              </button>
            ))}
          </div>
          <p className="tk-note">Every scene is the real app on an iPhone and in a desktop browser.</p>
        </section>

        <section className="tk-wrap tk-sec" id="program">
          <div className="tk-head">
            <small>Tonight's program</small>
            <h2>Seven reels. One app.</h2>
            <p>Everything ShowTracker does, in the order you'll use it.</p>
          </div>
          <div className="tk-reels">
            {REELS.map((reel, i) => (
              <article className="tk-reel" key={reel.id}>
                <div className="tk-reel-copy">
                  <span className="tk-seat"><span>Reel {String(i + 1).padStart(2, "0")}</span><span>{reel.label}</span></span>
                  <h3>{reel.title}</h3>
                  <p>{reel.copy}</p>
                  {reel.points ? (
                    <ul>{reel.points.map((p) => <li key={p}>{p}</li>)}</ul>
                  ) : null}
                  {reel.steps ? (
                    <ol className="tk-steps">
                      {reel.steps.map((s, n) => <li key={s}><b>0{n + 1}</b>{s}</li>)}
                    </ol>
                  ) : null}
                </div>
                {reel.stage}
              </article>
            ))}
          </div>
        </section>

        <section className="tk-wrap tk-sec" id="screens">
          <div className="tk-head">
            <small>Playing on every screen</small>
            <h2>Same queue. Any screen.</h2>
          </div>
          <div className="tk-screens">
            <div className="tk-browser">
              <div className="tk-browser-bar"><i /><i /><i /><span>showtrackerapp.netlify.app</span></div>
              <video
                ref={desktopRef}
                src={`${ASSETS}/desktop-loop.mp4`}
                poster={`${ASSETS}/desktop-loop-poster.jpg`}
                muted
                loop
                playsInline
                controls={reduceMotion}
                preload="none"
              />
            </div>
            <div className="tk-platforms">
              <div><b>Web</b><span>A wide Watchlist and a month calendar for the Schedule.</span></div>
              <div><b>iPhone &amp; Android</b><span>The same app in your pocket, built for one-handed tracking.</span></div>
              <div><b>In sync</b><span>One account. Mark an episode anywhere and it's marked everywhere.</span></div>
            </div>
          </div>
        </section>

        <section className="tk-wrap tk-sec" id="box-office">
          <div className="tk-head">
            <small>Box office</small>
            <h2>Questions at the counter</h2>
          </div>
          <div className="tk-faq">
            {FAQ.map((item, i) => (
              <div className="tk-stub" key={item.q}>
                <div className="tk-stub-seat"><span>Row B</span><span>Seat {i + 1}</span></div>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="tk-wrap tk-end">
          <h2>Your seat<br /><span>is saved.</span></h2>
          <p>Create a free account and start with what you're watching now. Your queue builds itself from there.</p>
          <div className="tk-mini">
            <AppLink href="/register" className="tk-btn tk-btn-ink">Create free account</AppLink>
            <AppLink href="/login" className="tk-btn tk-btn-line">Sign in</AppLink>
          </div>
        </section>
      </main>

      <footer className="tk-wrap tk-credits">
        <p>
          ShowTracker is free and open source. Catalog data from TMDB, AniList, TVMaze and Jikan. This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
        <nav aria-label="Footer">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          <AppLink href="/login">Sign in</AppLink>
          <AppLink href="/register">Create account</AppLink>
        </nav>
      </footer>
    </div>
  );
}

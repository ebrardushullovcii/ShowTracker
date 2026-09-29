// Styles for the web landing page. Every rule is scoped under `.tk` so nothing leaks into the app.
export const ticketLandingCss = `
@import url("https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap");

.tk {
  --velvet: #4a1216; --velvet-deep: #1c0608; --night: #120405; --ink: #1b1411; --paper: #f3ead7;
  --paper-dim: #e0cdbd; --stamp: #b3261e; --gold: #fbbf24; --bulb: #ffd88a; --rule: #4a1a1c;
  --cond: "Big Shoulders Display", "Arial Narrow", "Roboto Condensed", sans-serif;
  --sans: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  flex: 1 1 auto; height: 100%; min-height: 0; overflow-x: hidden; overflow-y: auto; scroll-behavior: smooth;
  background: radial-gradient(120% 60rem at 50% 0%, var(--velvet), var(--velvet-deep) 60%, var(--night)) no-repeat, var(--night);
  color: var(--paper); font: 16px/1.55 var(--sans); -webkit-font-smoothing: antialiased;
}
.tk *, .tk *::before, .tk *::after { box-sizing: border-box; }
.tk img, .tk video { display: block; max-width: 100%; }
:where(.tk) a { color: inherit; text-decoration: none; }
.tk h1, .tk h2, .tk h3, .tk p, .tk ul, .tk ol, .tk dl, .tk dd, .tk figure { margin: 0; padding: 0; }
.tk li { list-style: none; }
.tk h1, .tk h2, .tk h3 { text-wrap: balance; }
.tk-wrap { width: 100%; max-width: 1180px; margin-inline: auto; padding-inline: clamp(16px, 4vw, 40px); }

/* Buttons */
.tk-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 46px; padding: 0 20px; border-radius: 12px; font: 800 14px var(--sans); letter-spacing: 0.04em; text-transform: uppercase; white-space: nowrap; cursor: pointer; transition: transform 0.15s ease, background 0.15s ease; }
.tk-btn:hover { transform: translateY(-1px); }
.tk-btn-paper { background: var(--paper); color: var(--ink); }
.tk-btn-ink { background: var(--ink); color: var(--paper); }
.tk-btn-ghost { border: 1px solid rgba(243, 234, 215, 0.35); color: var(--paper); background: rgba(27, 20, 17, 0.35); }
.tk-btn-ghost:hover { background: rgba(243, 234, 215, 0.08); }
.tk-btn-line { border: 1px solid var(--ink); color: var(--ink); background: transparent; }
.tk-btn-line:hover { background: rgba(27, 20, 17, 0.06); }

/* Nav */
.tk-nav { position: sticky; top: 0; z-index: 20; background: rgba(28, 6, 8, 0.72); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid rgba(243, 234, 215, 0.08); }
.tk-nav .tk-wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 68px; }
.tk-logo { display: inline-flex; align-items: center; gap: 10px; font: 800 18px var(--sans); letter-spacing: -0.01em; }
.tk-logo img { width: 30px; height: auto; }
.tk-nav nav { display: flex; gap: 26px; font: 700 12px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: var(--paper-dim); }
.tk-nav nav a:hover { color: var(--paper); }
.tk-nav-cta { display: flex; align-items: center; gap: 10px; }
.tk-nav-cta .tk-btn { min-height: 40px; padding: 0 16px; font-size: 12.5px; }

/* Hero ticket */
.tk-hero { padding-block: clamp(40px, 7vw, 80px) 40px; display: grid; justify-items: center; gap: 30px; }
.tk-kick { font: 800 13px var(--mono); letter-spacing: 0.3em; text-transform: uppercase; color: #e8b4a0; text-align: center; }
.tk-ticket { --cut: 72%; width: min(100%, 1000px); display: grid; grid-template-columns: minmax(0, 72fr) minmax(0, 28fr); background: var(--paper); color: var(--ink); border-radius: 16px; box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.8);
  -webkit-mask: radial-gradient(circle 16px at var(--cut) 0, transparent 97%, #000) top / 100% 51% no-repeat, radial-gradient(circle 16px at var(--cut) 100%, transparent 97%, #000) bottom / 100% 51% no-repeat;
  mask: radial-gradient(circle 16px at var(--cut) 0, transparent 97%, #000) top / 100% 51% no-repeat, radial-gradient(circle 16px at var(--cut) 100%, transparent 97%, #000) bottom / 100% 51% no-repeat; }
.tk-t-main { padding: clamp(24px, 4vw, 44px); display: grid; gap: 18px; border-right: 2px dashed #b9ab8f; min-width: 0; }
.tk-t-k { font: 800 12px var(--mono); letter-spacing: 0.24em; text-transform: uppercase; color: var(--stamp); }
.tk h1 { font: 900 clamp(54px, 8.6vw, 124px)/0.84 var(--cond); text-transform: uppercase; letter-spacing: -0.01em; }
.tk-t-main > p { font-size: 18px; max-width: 32em; color: #3b302a; }
.tk-fine { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding-top: 16px; border-top: 1px solid #cdbfa4; }
.tk-fine dt { font: 800 10.5px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: #8a7b62; }
.tk-fine dd { font: 900 20px/1.1 var(--cond); text-transform: uppercase; }
.tk-t-stub { padding: 28px 22px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 16px; text-align: center; }
.tk-admit { font: 900 clamp(34px, 4vw, 50px)/0.9 var(--cond); text-transform: uppercase; color: var(--stamp); }
.tk-no { font: 700 12px var(--mono); letter-spacing: 0.1em; color: #6b5e4a; }
.tk-t-stub .tk-btn { width: 100%; }
.tk-t-stub small { font-size: 13px; color: #6b5e4a; }
.tk-t-stub small a { color: var(--stamp); font-weight: 700; }
.tk-barcode { width: 100%; height: 46px; opacity: 0.85; background: repeating-linear-gradient(90deg, var(--ink) 0 2px, transparent 2px 4px, var(--ink) 4px 5px, transparent 5px 8px, var(--ink) 8px 11px, transparent 11px 12px); }
.tk-genres { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
.tk-genres span { padding: 7px 12px; border-radius: 99px; border: 1px solid rgba(243, 234, 215, 0.22); font: 700 12px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--paper-dim); }

/* Section headings */
.tk-sec { padding-block: clamp(60px, 9vw, 110px) 0; scroll-margin-top: 40px; }
.tk-head { display: grid; justify-items: center; gap: 12px; text-align: center; margin-bottom: 36px; }
.tk-head small { font: 800 13px var(--mono); letter-spacing: 0.3em; text-transform: uppercase; color: var(--gold); }
.tk-head h2 { font: 900 clamp(40px, 6vw, 84px)/0.9 var(--cond); text-transform: uppercase; }
.tk-head p { color: var(--paper-dim); max-width: 36em; font-size: 17px; }

/* Trailer in marquee lights */
.tk-marquee { width: min(100%, 1060px); margin-inline: auto; padding: 18px; border-radius: 18px; background: #2a0a0c; box-shadow: inset 0 0 0 2px #5c1a1e, 0 50px 100px -40px rgba(0, 0, 0, 0.9); position: relative; }
.tk-marquee::before { content: ""; position: absolute; inset: 6px; border-radius: 13px; padding: 6px; background: radial-gradient(circle, var(--bulb) 0 2.2px, transparent 2.8px) 0 0 / 16px 16px; opacity: 0.9;
  -webkit-mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0); animation: tk-bulbs 1.2s steps(2) infinite; }
@keyframes tk-bulbs { 50% { opacity: 0.55; } }
.tk-marquee video { position: relative; width: 100%; aspect-ratio: 16 / 9; border-radius: 8px; background: #000; }
.tk-chaps { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 22px; }
.tk-chaps button { display: inline-flex; gap: 8px; align-items: baseline; padding: 9px 14px; border-radius: 10px; border: 1px solid rgba(243, 234, 215, 0.2); background: rgba(27, 20, 17, 0.4); color: var(--paper-dim); font: 700 13px var(--sans); cursor: pointer; transition: background 0.2s, border-color 0.2s, color 0.2s; }
.tk-chaps button small { font: 700 11px var(--mono); color: #c9a99a; }
.tk-chaps button:hover { background: rgba(243, 234, 215, 0.08); }
.tk-chaps button[aria-current="true"] { border-color: var(--gold); color: var(--paper); background: rgba(251, 191, 36, 0.1); }
.tk-chaps button[aria-current="true"] small { color: var(--gold); }
.tk-note { margin-top: 16px; text-align: center; font-size: 14px; color: #c9a99a; }

/* Program reels */
.tk-reels { display: grid; gap: clamp(60px, 9vw, 110px); }
.tk-reel { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: clamp(28px, 6vw, 90px); }
.tk-reel:nth-child(even) { grid-template-columns: auto minmax(0, 1fr); }
.tk-reel:nth-child(even) .tk-reel-copy { order: 2; }
.tk-reel-copy { display: grid; gap: 18px; justify-items: start; }
.tk-seat { display: inline-flex; gap: 14px; padding: 8px 14px; border-radius: 8px; background: var(--paper); color: var(--stamp); font: 800 11.5px var(--mono); letter-spacing: 0.16em; text-transform: uppercase; }
.tk-seat span + span { padding-left: 14px; border-left: 1px dashed #b9ab8f; color: var(--ink); }
.tk-reel h3 { font: 900 clamp(36px, 4.6vw, 62px)/0.92 var(--cond); text-transform: uppercase; }
.tk-reel p { font-size: 18px; color: var(--paper-dim); max-width: 30em; }
.tk-reel ul { display: grid; gap: 8px; font-size: 15.5px; color: #eadfd0; }
.tk-reel ul li::before { content: "●"; color: var(--gold); font-size: 9px; vertical-align: 3px; margin-right: 10px; }
.tk-steps { display: grid; gap: 10px; }
.tk-steps li { display: flex; gap: 12px; font-size: 16px; color: #eadfd0; }
.tk-steps li::before { content: none !important; }
.tk-steps b { font: 800 13px/1.7 var(--mono); color: var(--gold); }
.tk-stage { position: relative; }
.tk-float { position: absolute; border-radius: 14px; box-shadow: 0 30px 60px -20px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.08); animation: tk-float 7s ease-in-out infinite; }
.tk-float-watched { width: 250px; left: -150px; bottom: 90px; }
.tk-float-shared { width: 150px; right: -100px; top: 110px; animation-delay: -3s; }
@keyframes tk-float { 50% { transform: translateY(-10px); } }

/* iPhone 17 Pro frame; sizes scale with the frame width via container units. */
.tk-ph { width: var(--w, 300px); max-width: 100%; container-type: inline-size; flex-shrink: 0; }
.tk-ph-f { padding: 1.3cqw; border-radius: 17.5cqw; background: linear-gradient(140deg, var(--fh), var(--fm) 28%, var(--fl) 62%, var(--fh)); box-shadow: 0 50px 90px -34px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06); }
.tk-ph-k { padding: 3.3cqw; border-radius: 16.3cqw; background: #030304; }
.tk-ph-s { position: relative; aspect-ratio: 402 / 874; border-radius: 12.8cqw; overflow: hidden; background: #09090b; }
.tk-ph-s::before { content: ""; position: absolute; z-index: 6; top: 2.5cqw; left: 50%; transform: translateX(-50%); width: 28.4cqw; height: 8.4cqw; border-radius: 9cqw; background: #000; }
.tk-ph-s > img { width: 100%; height: 100%; object-fit: cover; object-position: top; }
.tk-fin-orange { --fh: #f3a877; --fm: #c8622a; --fl: #7d3712; }
.tk-fin-blue { --fh: #8a9aba; --fm: #34445f; --fl: #1a2233; }
.tk-fin-silver { --fh: #fbfbfc; --fm: #c9cbd0; --fl: #8a8d94; }
/* A tall captured page scrolling under the app's fixed top bar and tab bar. */
.tk-tall { position: absolute; inset: 0; }
.tk-tall img { position: absolute; left: 0; width: 100%; height: auto; }
.tk-tall .tk-t-img { top: var(--top); animation: tk-scroll var(--dur, 24s) cubic-bezier(0.65, 0, 0.35, 1) infinite alternate; }
.tk-tall .tk-t-top { top: 0; z-index: 2; }
.tk-tall .tk-t-tab { bottom: 0; z-index: 2; }
@keyframes tk-scroll { 0%, 12% { transform: translateY(0); } 88%, 100% { transform: translateY(var(--max)); } }

/* Every screen */
.tk-screens { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 60px); align-items: center; }
.tk-browser { border-radius: 14px; overflow: hidden; background: #0b0b0d; border: 1px solid #2a2a2e; box-shadow: 0 50px 100px -40px rgba(0, 0, 0, 0.9); }
.tk-browser-bar { height: 34px; display: flex; align-items: center; gap: 7px; padding: 0 12px; background: #161618; border-bottom: 1px solid #232326; }
.tk-browser-bar i { width: 11px; height: 11px; border-radius: 50%; background: #ff5f57; }
.tk-browser-bar i:nth-child(2) { background: #febc2e; } .tk-browser-bar i:nth-child(3) { background: #28c840; }
.tk-browser-bar span { flex: 1; min-width: 0; margin-left: 10px; height: 22px; border-radius: 6px; background: #0c0c0e; font: 500 11.5px/22px var(--sans); color: #a1a1aa; text-align: center; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.tk-browser video { width: 100%; aspect-ratio: 5 / 3; }
.tk-platforms { display: grid; gap: 14px; }
.tk-platforms div { display: grid; gap: 4px; padding: 18px 20px; border-radius: 14px; background: rgba(27, 20, 17, 0.45); border: 1px solid rgba(243, 234, 215, 0.14); }
.tk-platforms b { font: 900 26px/1 var(--cond); text-transform: uppercase; }
.tk-platforms span { font-size: 15px; color: var(--paper-dim); }

/* Box office */
.tk-faq { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.tk-stub { background: var(--paper); color: var(--ink); border-radius: 12px; padding: 22px; display: grid; gap: 10px; align-content: start; }
.tk-stub-seat { display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px dashed #b9ab8f; font: 800 11px var(--mono); letter-spacing: 0.16em; text-transform: uppercase; color: var(--stamp); }
.tk-stub h3 { font: 900 26px/1.02 var(--cond); text-transform: uppercase; }
.tk-stub p { font-size: 15px; color: #4a3e36; }

/* Closing ticket */
.tk-end { padding-block: clamp(70px, 10vw, 120px); display: grid; justify-items: center; gap: 26px; text-align: center; }
.tk-end h2 { font: 900 clamp(48px, 8vw, 116px)/0.86 var(--cond); text-transform: uppercase; }
.tk-end h2 span { color: var(--gold); }
.tk-end p { color: var(--paper-dim); font-size: 18px; max-width: 30em; }
.tk-end .tk-mini { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 12px; padding: 16px; border-radius: 14px; background: var(--paper); }

/* Credits */
.tk-credits { border-top: 1px solid var(--rule); padding-block: 30px 44px; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 18px; font-size: 13px; color: #c9a99a; }
.tk-credits nav { display: flex; flex-wrap: wrap; gap: 18px; }
.tk-credits a:hover { color: var(--paper); }
.tk-credits p { max-width: 44em; }

@media (max-width: 900px) {
  .tk-nav nav { display: none; }
  .tk-reel, .tk-reel:nth-child(even) { grid-template-columns: minmax(0, 1fr); justify-items: center; }
  .tk-reel:nth-child(even) .tk-reel-copy { order: 0; }
  .tk-reel-copy { justify-self: stretch; }
  .tk-float-watched { width: 200px; left: -40px; bottom: 60px; }
  .tk-float-shared { width: 120px; right: -30px; }
  .tk-screens { grid-template-columns: minmax(0, 1fr); }
  .tk-faq { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 820px) {
  .tk-ticket { grid-template-columns: minmax(0, 1fr); -webkit-mask: none; mask: none; }
  .tk-t-main { border-right: 0; border-bottom: 2px dashed #b9ab8f; }
  .tk-fine { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .tk-nav-cta .tk-btn-ghost { display: none; }
  .tk-faq { grid-template-columns: minmax(0, 1fr); }
  .tk-float-watched { width: 170px; left: -24px; }
  .tk-float-shared { width: 100px; right: -20px; }
}
@media (prefers-reduced-motion: reduce) {
  .tk, .tk *, .tk *::before, .tk *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
}
`;

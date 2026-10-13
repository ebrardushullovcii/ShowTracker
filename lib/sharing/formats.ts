export const shareFormats = [
  {
    "slug": "plain-text",
    "name": "Just the titles",
    "tag": "Text",
    "format": "text",
    "layout": "plain",
    "cap": 60,
    "accent": "#ef4444",
    "desc": "The fastest way to send your collection. A clean list that works in any chat."
  },
  {
    "slug": "chat-message",
    "name": "A message to a friend",
    "tag": "Text",
    "format": "text",
    "layout": "chat",
    "cap": 60,
    "accent": "#38bdf8",
    "desc": "A friendly opener, numbered choices, and a simple way to reply."
  },
  {
    "slug": "grouped-text",
    "name": "Sorted by mood",
    "tag": "Text",
    "format": "text",
    "layout": "grouped",
    "cap": 60,
    "accent": "#a78bfa",
    "desc": "A text export grouped by genre, so a big list is easier to browse."
  },
  {
    "slug": "linked-text",
    "name": "Titles with links",
    "tag": "Text",
    "format": "text",
    "layout": "links",
    "cap": 60,
    "accent": "#34d399",
    "desc": "Titles, years, and public catalogue links your friend can open without ShowTracker."
  },
  {
    "slug": "poster-pages",
    "name": "Poster pages",
    "tag": "Images",
    "format": "image",
    "layout": "grid",
    "cap": 12,
    "accent": "#ef4444",
    "desc": "A tidy 4 × 3 poster sheet. Titles stay readable as the list grows."
  },
  {
    "slug": "poster-wall",
    "name": "The poster wall",
    "tag": "Images",
    "format": "image",
    "layout": "wall",
    "cap": 20,
    "accent": "#f97316",
    "desc": "A square collection of covers with titles underneath. More shows in one glance."
  },
  {
    "slug": "editorial-cards",
    "name": "A closer look",
    "tag": "Images",
    "format": "image",
    "layout": "editorial",
    "cap": 4,
    "accent": "#38bdf8",
    "desc": "Four roomy poster rows with year, genre, and episode length."
  },
  {
    "slug": "story-pages",
    "name": "Story-sized picks",
    "tag": "Images",
    "format": "image",
    "layout": "story",
    "cap": 3,
    "accent": "#ef4444",
    "desc": "A tall, phone-first image with three large choices and a personal note."
  },
  {
    "slug": "title-board",
    "name": "The title board",
    "tag": "Images",
    "format": "image",
    "layout": "titles",
    "cap": 24,
    "accent": "#34d399",
    "desc": "A compact, numbered image without pictures. Easy to read and easy to answer."
  },
  {
    "slug": "library-snapshot",
    "name": "A clean Library snapshot",
    "tag": "Images",
    "format": "image",
    "layout": "library",
    "cap": 8,
    "accent": "#ef4444",
    "desc": "The familiar ShowTracker look, with navigation and private tracking details removed."
  },
  {
    "slug": "cinema-ticket",
    "name": "Tonight’s program",
    "tag": "Images",
    "format": "image",
    "layout": "ticket",
    "cap": 8,
    "accent": "#c83c32",
    "desc": "A warm cinema-program design inspired by ShowTracker’s public ticket style."
  },
  {
    "slug": "contact-sheet",
    "name": "The contact sheet",
    "tag": "Images",
    "format": "image",
    "layout": "contact",
    "cap": 30,
    "accent": "#27272a",
    "desc": "A light, landscape reference sheet with many small covers and clear title labels."
  },
  {
    "slug": "three-picks",
    "name": "Three I’d start with",
    "tag": "Choose together",
    "format": "image",
    "layout": "trio",
    "cap": 3,
    "accent": "#fbbf24",
    "desc": "Star up to three shows, then share a link where your friend can choose favorites and send back a result."
  },
  {
    "slug": "this-or-that",
    "name": "This or that",
    "tag": "Choose together",
    "format": "image",
    "layout": "duel",
    "cap": 2,
    "accent": "#38bdf8",
    "desc": "Share a playable game. Your friend picks between pairs, winners advance, and one show wins. No account needed."
  }
] as const;

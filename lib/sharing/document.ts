import type { ShareCollection } from "./types";
import { shareFormats } from "./formats";
import { rendererScript } from "./renderer-script";
import { composerScript } from "./composer-script";
import { shareStyles } from "./styles";

/** Escape catalogue/user strings before embedding them in a script element. */
function scriptJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function createShareDocument(collection: ShareCollection, native = false) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Share shows</title><style>${shareStyles}</style></head><body>
<main class="composer"><section class="configuration" aria-label="Export options">
<nav class="categories" aria-label="Export category"><button data-category="Text">Text</button><button data-category="Images">Images</button><button data-category="Choose together">Choose together</button></nav>
<label for="format"><small>FORMAT</small></label><select id="format" aria-label="Export format"></select>
<p id="description" class="description"></p><div id="scope" class="scope"></div>
<details><summary>Edit selection &amp; message</summary><div class="fields">
<label class="field">Heading<input id="heading" maxlength="70"></label><label class="field">Message to your friend<textarea id="note" maxlength="130"></textarea></label><label class="field">Your name (optional)<input id="sender" maxlength="30"></label>
<div class="checks"><label><input type="checkbox" id="years" checked>Years</label><label><input type="checkbox" id="genres">Genres in text</label></div>
<label class="field">Order<select id="sort"><option value="original">Collection order</option><option value="title">Title A–Z</option><option value="genre">Primary genre</option></select></label>
<h3>Choose the shows</h3><p id="shortlist-help" hidden>Star up to three titles. Only your explicit picks will be exported.</p><small id="selected-count"></small>
<label class="field"><input type="search" id="selection-search" placeholder="Find a title" aria-label="Find a title in selection"></label>
<div class="selection-tools"><button id="select-all">Include all</button><button id="select-none">Clear selection</button></div><div id="selection" class="selection-list"></div></div></details>
<p class="privacy">Only included titles, covers, and catalogue details are shared. Your progress, watch history, and friends’ names are left out.</p>
</section><section class="stage" aria-label="Export preview"><div class="stage-header"><h3>Preview</h3><div class="pagination"><button id="prev" aria-label="Previous page">←</button><span id="page"></span><button id="next" aria-label="Next page">→</button></div></div>
<div id="duel" hidden><button id="shuffle">Shuffle a pair</button><button id="pick-a">Pick A</button><button id="pick-b">Pick B</button><button id="copy-picks">Copy my picks</button></div>
<div id="preview"></div><div id="actions"></div><div id="notice" role="status" aria-live="polite"></div></section></main>
<script>const PAYLOAD=${scriptJson(collection)};const NATIVE=${native};const CONCEPTS=${scriptJson(shareFormats)};
${rendererScript}
${composerScript}
</script></body></html>`;
}

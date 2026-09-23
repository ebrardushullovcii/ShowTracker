import assert from "node:assert/strict";
import test from "node:test";

import {
  getSectionQueryLimit,
  hasMoreSectionRows,
  isNearScrollEnd,
} from "./home-section-pagination";

test("bottom section loads when the reader is within the preload distance", () => {
  const viewportLength = 800;
  const contentLength = 5000;
  const preload = 600;
  assert.equal(isNearScrollEnd({
    scrollOffset: contentLength - viewportLength - preload,
    viewportLength,
    contentLength,
  }), true);
  assert.equal(isNearScrollEnd({
    scrollOffset: contentLength - viewportLength,
    viewportLength,
    contentLength,
  }), true);
  assert.equal(isNearScrollEnd({
    scrollOffset: contentLength - viewportLength - preload - 1,
    viewportLength,
    contentLength,
  }), false);
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength, contentLength }), false);
});

test("short pages keep loading until they fill the viewport", () => {
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength: 800, contentLength: 600 }), true);
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength: 800, contentLength: 1300 }), true);
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength: 800, contentLength: 1401 }), false);
});

test("small phone viewports still preload at least the minimum distance", () => {
  assert.equal(isNearScrollEnd({ scrollOffset: 1000, viewportLength: 400, contentLength: 1880 }), true);
  assert.equal(isNearScrollEnd({ scrollOffset: 1000, viewportLength: 400, contentLength: 1881 }), false);
});

test("hidden or unmeasured scroll views never trigger a load", () => {
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength: 0, contentLength: 0 }), false);
  assert.equal(isNearScrollEnd({ scrollOffset: 0, viewportLength: 0, contentLength: 2000 }), false);
  assert.equal(isNearScrollEnd({ scrollOffset: Number.NaN, viewportLength: 800, contentLength: 900 }), false);
});

test("each section query stays two pages ahead of its own visible rows", () => {
  assert.equal(getSectionQueryLimit(0, 8), 32);
  assert.equal(getSectionQueryLimit(8, 8), 32);
  assert.equal(getSectionQueryLimit(24, 8), 40);
  assert.equal(getSectionQueryLimit(40, 8), 56);
});

test("a section has more rows while loaded rows are hidden or the feed filled its limit", () => {
  assert.equal(hasMoreSectionRows({ visibleCount: 8, sectionLength: 20, loadedFeedLength: 20, queryLimit: 32 }), true);
  assert.equal(hasMoreSectionRows({ visibleCount: 32, sectionLength: 32, loadedFeedLength: 32, queryLimit: 32 }), true);
  assert.equal(hasMoreSectionRows({ visibleCount: 20, sectionLength: 20, loadedFeedLength: 20, queryLimit: 32 }), false);
  assert.equal(hasMoreSectionRows({ visibleCount: 40, sectionLength: 32, loadedFeedLength: 32, queryLimit: 56 }), false);
});

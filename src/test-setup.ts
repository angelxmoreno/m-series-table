// Vitest setup file. Two jobs:
//   1. Polyfill <dialog> for jsdom (FilterDialog / ColumnsPopover rely on it)
//   2. Reset window.location between tests so URL state doesn't leak
//
// Note: this file lives at src/test-setup.js (not src/test/setup.js) so that
// it sits next to the other co-located tests at the src/ root. The few tests
// that didn't have a clean source pair — src/test/csv.test.js (covers
// export-csv.js at the repo root) and src/test/fmt.test.js (currently covers
// a re-implementation of `fmt` inside AppleSiliconTable.jsx) — remain in
// src/test/. The TypeScript port in P0 will extract `fmt` to its own module
// and move fmt.test.js to src/fmt.test.js alongside it.

import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom doesn't implement <dialog>. Polyfill showModal/close so the filter
// and columns dialogs work in tests. Esc-to-close is handled explicitly in
// the components (see FilterDialog / ColumnsPopover keydown listeners).

if (typeof window !== "undefined" && typeof window.HTMLDialogElement !== "undefined") {
  const dialogProto = window.HTMLDialogElement.prototype;
  if (typeof dialogProto.showModal !== "function") {
    dialogProto.showModal = function () {
      this.setAttribute("open", "");
      this.open = true;
    };
  }
  if (typeof dialogProto.close !== "function") {
    dialogProto.close = function () {
      this.removeAttribute("open");
      this.open = false;
      this.dispatchEvent(new Event("close"));
    };
  }
}

// Reset the URL between tests. Components read window.location.search as the
// source of truth on first render, so leftover query strings from a previous
// test would leak into the next. We rewrite the URL to "/" so each test starts
// with the default state.
afterEach(() => {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
});

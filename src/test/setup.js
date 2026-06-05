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

import "@testing-library/jest-dom/vitest";

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

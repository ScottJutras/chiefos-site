"use client";

/**
 * Renders the "Ask Chief" header button.
 * Captures the current page URL and passes it through the open-chief
 * event so the dock can inject page context into every request.
 */
export default function ChiefDockButton() {
  function open() {
    window.dispatchEvent(
      new CustomEvent("open-chief", {
        detail: { query: "", page: window.location.pathname },
      })
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-sm font-semibold text-black hover:bg-white/90 transition"
    >
      Ask Chief
    </button>
  );
}

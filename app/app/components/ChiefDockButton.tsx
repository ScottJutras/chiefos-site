"use client";

/**
 * Renders the "Ask Chief" header button.
 * Opens the dock by dispatching a custom event so the panel
 * (rendered outside the header) can listen and show itself.
 */
export default function ChiefDockButton() {
  function open() {
    window.dispatchEvent(new CustomEvent("open-chief", { detail: { query: "" } }));
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

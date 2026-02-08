// app/components/marketing/WhatsAppIcon.tsx
import * as React from "react";

export default function WhatsAppIcon({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={["block", className].join(" ")}
      fill="currentColor"
      shapeRendering="geometricPrecision"
      textRendering="geometricPrecision"
    >
      {/* ✅ Replace this path with your official WhatsApp glyph path */}
      <path d="M12.04 2C6.58 2 2.15 6.29 2.15 11.58c0 1.86.54 3.67 1.57 5.22L2 22l5.44-1.7a10.2 10.2 0 0 0 4.6 1.1c5.46 0 9.89-4.29 9.89-9.58C21.93 6.29 17.5 2 12.04 2Zm0 17.7a8.6 8.6 0 0 1-4.3-1.14l-.3-.17-3.23 1 1.06-3.04-.2-.3a8.3 8.3 0 0 1-1.38-4.47c0-4.35 3.7-7.89 8.35-7.89s8.35 3.54 8.35 7.89-3.7 7.89-8.35 7.89Zm4.85-6.08c-.27-.13-1.6-.78-1.85-.87-.25-.09-.43-.13-.6.13-.18.26-.7.87-.86 1.05-.16.17-.32.2-.6.07-.27-.13-1.14-.41-2.18-1.3-.8-.68-1.35-1.52-1.5-1.78-.16-.26-.02-.4.12-.52.12-.12.27-.3.4-.45.13-.15.18-.26.27-.43.09-.17.04-.32-.02-.45-.07-.13-.6-1.43-.83-1.96-.22-.52-.45-.45-.6-.45h-.52c-.18 0-.45.07-.68.32-.22.26-.9.87-.9 2.13 0 1.26.93 2.48 1.06 2.65.13.17 1.83 2.8 4.44 3.92.62.26 1.1.42 1.48.54.62.2 1.2.17 1.65.1.5-.07 1.6-.64 1.83-1.26.22-.62.22-1.15.16-1.26-.07-.1-.25-.17-.52-.3Z" />
    </svg>
  );
}

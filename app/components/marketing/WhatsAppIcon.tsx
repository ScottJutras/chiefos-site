// app/components/marketing/WhatsAppIcon.tsx
export default function WhatsAppIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  // Simple WhatsApp mark (monochrome) to match premium dark theme.
  // No brand-color fill, no implying endorsement.
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M16 3.2c-7.07 0-12.8 5.73-12.8 12.8 0 2.26.6 4.47 1.73 6.43L3 29l6.73-1.77A12.74 12.74 0 0 0 16 28.8c7.07 0 12.8-5.73 12.8-12.8S23.07 3.2 16 3.2Z"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M13.2 12.6c.25-.55.5-.56.72-.57h.62c.2 0 .46.08.7.53.25.45.9 1.55.98 1.66.08.11.14.24.03.43-.11.2-.17.33-.35.52-.17.2-.37.43-.53.58-.17.16-.35.34-.15.68.2.34.89 1.45 1.9 2.35 1.3 1.16 2.4 1.52 2.74 1.7.34.18.54.16.74-.07.2-.23.86-.99 1.09-1.33.23-.34.46-.28.77-.17.31.11 1.96.93 2.3 1.1.34.17.56.25.64.39.08.14.08.82-.2 1.62-.28.8-1.66 1.55-2.28 1.66-.56.1-1.26.14-2.03-.1-.47-.15-1.08-.35-1.86-.7-3.28-1.41-5.42-4.87-5.58-5.1-.16-.22-1.33-1.77-1.33-3.37 0-1.6.84-2.38 1.13-2.7Z"
        fill="currentColor"
        fillOpacity="0.82"
      />
    </svg>
  );
}

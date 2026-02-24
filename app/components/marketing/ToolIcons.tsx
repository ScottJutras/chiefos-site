// app/components/marketing/ToolIcons.tsx

type Props = {
  className?: string;
};

export function ExpensesIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9h10M7 13h6" />
    </svg>
  );
}

export function TimeIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6l4 2" />
    </svg>
  );
}

export function RevenueIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M4 20h16M6 16l4-4 3 3 5-7" />
    </svg>
  );
}

export function TasksIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7H3V5h11" />
    </svg>
  );
}

export function ReminderIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M6 8a6 6 0 1112 0c0 7 3 7 3 7H3s3 0 3-7" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function QuotesIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M7 17h3l2-4V7H7v6h3" />
      <path d="M17 17h3l2-4V7h-5v6h3" />
    </svg>
  );
}

export function DocsIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <path d="M6 2h9l5 5v15H6z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

export function JobsIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a4 4 0 018 0v2" />
    </svg>
  );
}

export function ChiefIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {/* Shield */}
      <path d="M12 3l7 4v6c0 5-3.5 8.3-7 9.8C8.5 21.3 5 18 5 13V7l7-4z" />
      {/* Check */}
      <path d="M9.2 12.4l1.9 1.9 3.8-4.2" />
      {/* Subtle nodes */}
      <circle cx="7.5" cy="9.2" r="0.6" />
      <circle cx="16.5" cy="9.2" r="0.6" />
      <circle cx="12" cy="17.2" r="0.6" />
    </svg>
  );
}

export function MicroAppsIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      {/* 2x2 grid */}
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
      {/* sparkle */}
      <path d="M18.5 9.5l.6-1.6.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    </svg>
  );
}

export function MobileAppIcon({ className }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className}>
      <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
      <path d="M10 5h4" />
      <circle cx="12" cy="18.5" r="0.9" />
    </svg>
  );
}
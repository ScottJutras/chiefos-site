// C:\Users\scott\Documents\Sherpa AI\Chief\chiefos-site\app\components\marketing\Section.tsx
import type { ReactNode } from "react";

export default function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

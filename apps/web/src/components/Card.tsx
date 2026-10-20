import { useId, type ReactNode } from "react";

interface CardProps {
  title: string;
  description?: string;
  /** Contenido a la derecha del título (contadores, indicador de actualización…). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, description, aside, children, className = "" }: CardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={`flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div>
          <h2 id={headingId} className="text-base font-semibold text-slate-900">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-slate-600">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="flex-1 p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Indicador discreto de que una query se está refrescando en segundo plano. */
export function RefreshIndicator({ active }: { active: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600" aria-live="polite">
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${active ? "animate-pulse bg-sky-500" : "bg-emerald-500"}`}
      />
      {active ? "Actualizando…" : "Al día"}
    </span>
  );
}

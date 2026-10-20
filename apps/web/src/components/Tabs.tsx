import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface TabDefinition {
  id: string;
  label: string;
  content: ReactNode;
}

/** Pestañas accesibles (patrón WAI-ARIA): flechas, Inicio y Fin para moverse entre pestañas. */
export function Tabs({ tabs, label }: { tabs: TabDefinition[]; label: string }) {
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const baseId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  function focusTab(index: number) {
    const tab = tabs[(index + tabs.length) % tabs.length];
    if (!tab) return;
    setActiveId(tab.id);
    buttons.current[tabs.indexOf(tab)]?.focus();
  }

  function onKeyDown(event: KeyboardEvent, index: number) {
    const moves: Record<string, number> = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: tabs.length - 1 };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    focusTab(target);
  }

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab, index) => {
          const selected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActiveId(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-600 ${
                selected
                  ? "border-sky-700 text-sky-800"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== activeId}
          className="pt-4"
        >
          {tab.id === activeId && tab.content}
        </div>
      ))}
    </div>
  );
}

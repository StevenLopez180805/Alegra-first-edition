import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryStateProps<T> {
  query: UseQueryResult<T>;
  isEmpty?: (data: T) => boolean;
  emptyMessage: string;
  /** Filas del skeleton mientras carga por primera vez. */
  skeletonRows?: number;
  children: (data: T) => ReactNode;
}

/** Resuelve los estados de carga, error (con reintento) y vacío de una sección. */
export function QueryState<T>({ query, isEmpty, emptyMessage, skeletonRows = 3, children }: QueryStateProps<T>) {
  if (query.isPending) return <Skeleton rows={skeletonRows} />;

  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">No se pudo cargar la información.</p>
        <p className="mt-1">{query.error.message}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="mt-3 rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (isEmpty?.(query.data)) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">{emptyMessage}</p>;
  }

  return <>{children(query.data)}</>;
}

export function Skeleton({ rows }: { rows: number }) {
  return (
    <div role="status" aria-label="Cargando" className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

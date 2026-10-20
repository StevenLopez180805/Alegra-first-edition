import { Tabs } from "./components/Tabs";
import { POLL_INTERVAL_MS } from "./config";
import { InventorySection } from "./sections/InventorySection";
import { OrderForm } from "./sections/OrderForm";
import { OrdersSection } from "./sections/OrdersSection";
import { PreparationsSection } from "./sections/PreparationsSection";
import { PurchasesSection } from "./sections/PurchasesSection";
import { RecipesSection } from "./sections/RecipesSection";

export function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-baseline justify-between gap-2 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Jornada de Almuerzo Gratis</h1>
            <p className="text-sm text-slate-600">Panel del gerente: pedidos, cocina, bodega y plaza de mercado.</p>
          </div>
          <p className="text-xs text-slate-600">Actualización automática cada {POLL_INTERVAL_MS / 1000} s</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <OrderForm />
          </div>
          <div className="lg:col-span-2">
            <PreparationsSection />
          </div>
        </div>

        <section aria-label="Historiales y catálogo" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <Tabs
            label="Historiales y catálogo"
            tabs={[
              { id: "orders", label: "Historial de pedidos", content: <OrdersSection /> },
              { id: "inventory", label: "Inventario de bodega", content: <InventorySection /> },
              { id: "purchases", label: "Historial de compras", content: <PurchasesSection /> },
              { id: "recipes", label: "Recetas", content: <RecipesSection /> },
            ]}
          />
        </section>
      </main>
    </div>
  );
}

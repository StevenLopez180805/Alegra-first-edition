import { useId, useState, type FormEvent } from "react";
import { useCreateOrder } from "../api/queries";
import { Card } from "../components/Card";
import { maxOrderItems } from "../config";

export function validateQuantity(raw: string, max: number): string | null {
  if (raw.trim() === "") return "Ingresa la cantidad de platos.";
  const value = Number(raw);
  if (!Number.isInteger(value)) return "La cantidad debe ser un número entero.";
  if (value < 1 || value > max) return `La cantidad debe estar entre 1 y ${max}.`;
  return null;
}

export function OrderForm() {
  const max = maxOrderItems();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [quantity, setQuantity] = useState("10");
  const [validationError, setValidationError] = useState<string | null>(null);
  const createOrder = useCreateOrder();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateQuantity(quantity, max);
    setValidationError(error);
    if (error) return;
    createOrder.mutate(Number(quantity));
  }

  const error = validationError ?? (createOrder.isError ? createOrder.error.message : null);

  return (
    <Card title="Pedir platos" description="Cada plato recibe una receta al azar y la cocina lo prepara en segundo plano.">
      <form onSubmit={onSubmit} noValidate className="space-y-3">
        <div>
          <label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
            Cantidad de platos
          </label>
          <input
            id={inputId}
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            step={1}
            value={quantity}
            onChange={(event) => {
              setQuantity(event.target.value);
              setValidationError(null);
            }}
            aria-invalid={error !== null}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/30 aria-invalid:border-red-600"
          />
          <p id={hintId} className="mt-1 text-xs text-slate-600">
            Entre 1 y {max} platos por pedido.
          </p>
        </div>

        <button
          type="submit"
          disabled={createOrder.isPending}
          className="w-full rounded-md bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {createOrder.isPending ? "Enviando pedido…" : "Pedir platos"}
        </button>

        <div aria-live="polite">
          {error && (
            <p id={errorId} role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900">
              {error}
            </p>
          )}
          {!error && createOrder.isSuccess && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              Pedido de {createOrder.data.quantity} {createOrder.data.quantity === 1 ? "plato" : "platos"} recibido.
              <span className="mt-0.5 block break-all font-mono text-xs">ID: {createOrder.data.orderId}</span>
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}

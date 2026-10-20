import type { IngredientName, ItemStatus, OrderStatus, PurchaseStatus } from "../api/types";

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "medium" });

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date);
}

/** Primeros caracteres de un UUID, suficientes para identificarlo en pantalla. */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

export const INGREDIENT_LABELS: Record<IngredientName, string> = {
  tomato: "Tomate",
  lemon: "Limón",
  potato: "Papa",
  rice: "Arroz",
  ketchup: "Salsa de tomate",
  lettuce: "Lechuga",
  onion: "Cebolla",
  cheese: "Queso",
  meat: "Carne",
  chicken: "Pollo",
};

export function ingredientLabel(name: string): string {
  return INGREDIENT_LABELS[name as IngredientName] ?? name;
}

export type Tone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

export const ITEM_STATUS_META: Record<ItemStatus, StatusMeta> = {
  PENDING: { label: "En cola", tone: "neutral" },
  PREPARING: { label: "Preparando", tone: "info" },
  WAITING_INGREDIENTS: { label: "Esperando ingredientes", tone: "warning" },
  DELIVERED: { label: "Entregado", tone: "success" },
  FAILED: { label: "Fallido", tone: "danger" },
};

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: { label: "Pendiente", tone: "neutral" },
  IN_PROGRESS: { label: "En progreso", tone: "info" },
  DELIVERED: { label: "Entregado", tone: "success" },
  PARTIALLY_DELIVERED: { label: "Entrega parcial", tone: "warning" },
  FAILED: { label: "Fallido", tone: "danger" },
};

export const PURCHASE_STATUS_META: Record<PurchaseStatus, StatusMeta> = {
  // Intento registrado sin resultado: en curso o, si persiste, interrumpido con resultado incierto.
  REQUESTED: { label: "Sin confirmar", tone: "neutral" },
  SOLD: { label: "Vendido", tone: "success" },
  UNAVAILABLE: { label: "Sin disponibilidad", tone: "warning" },
  ERROR: { label: "Error", tone: "danger" },
};

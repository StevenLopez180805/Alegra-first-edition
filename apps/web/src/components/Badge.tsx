import type { ItemStatus, OrderStatus, PurchaseStatus } from "../api/types";
import { ITEM_STATUS_META, ORDER_STATUS_META, PURCHASE_STATUS_META, type StatusMeta, type Tone } from "../lib/format";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-800 ring-slate-300",
  info: "bg-sky-100 text-sky-900 ring-sky-300",
  warning: "bg-amber-100 text-amber-900 ring-amber-300",
  success: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  danger: "bg-red-100 text-red-900 ring-red-300",
};

export function Badge({ label, tone }: StatusMeta) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE_CLASSES[tone]}`}
    >
      {label}
    </span>
  );
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  return <Badge {...ITEM_STATUS_META[status]} />;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge {...ORDER_STATUS_META[status]} />;
}

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return <Badge {...PURCHASE_STATUS_META[status]} />;
}

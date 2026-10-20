import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { POLL_INTERVAL_MS } from "../config";
import { apiFetch } from "./client";
import type {
  CreateOrderResponse,
  InventoryResponse,
  OrderDetailResponse,
  OrdersResponse,
  PreparationsResponse,
  PurchasesResponse,
  RecipesResponse,
} from "./types";

export const queryKeys = {
  recipes: ["recipes"] as const,
  inventory: ["inventory"] as const,
  preparations: ["preparations"] as const,
  orders: ["orders"] as const,
  order: (orderId: string) => ["orders", orderId] as const,
  purchases: ["purchases"] as const,
};

// TanStack Query pausa el refetchInterval cuando la pestaña no está visible (refetchIntervalInBackground: false).

export function useRecipes() {
  return useQuery({
    queryKey: queryKeys.recipes,
    queryFn: () => apiFetch<RecipesResponse>("/recipes"),
    select: (data) => data.recipes,
    staleTime: Infinity,
  });
}

export function useInventory() {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: () => apiFetch<InventoryResponse>("/inventory"),
    select: (data) => data.ingredients,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function usePreparations() {
  return useQuery({
    queryKey: queryKeys.preparations,
    queryFn: () => apiFetch<PreparationsResponse>("/preparations?limit=200"),
    select: (data) => data.items,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: queryKeys.orders,
    queryFn: () => apiFetch<OrdersResponse>("/orders?limit=50"),
    select: (data) => data.orders,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: queryKeys.order(orderId ?? ""),
    queryFn: () => apiFetch<OrderDetailResponse>(`/orders/${encodeURIComponent(orderId ?? "")}`),
    enabled: orderId !== null,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function usePurchases() {
  return useQuery({
    queryKey: queryKeys.purchases,
    queryFn: () => apiFetch<PurchasesResponse>("/purchases?limit=100"),
    select: (data) => data.purchases,
    refetchInterval: POLL_INTERVAL_MS,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quantity: number) =>
      apiFetch<CreateOrderResponse>("/orders", { method: "POST", body: JSON.stringify({ quantity }) }),
    onSuccess: () =>
      Promise.all(
        [queryKeys.orders, queryKeys.preparations, queryKeys.inventory, queryKeys.purchases].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
}

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { OrderItem, Recipe } from "../api/types";
import { mockApi, renderWithClient } from "../test/utils";
import { InventorySection } from "./InventorySection";
import { PreparationsSection } from "./PreparationsSection";
import { PurchasesSection } from "./PurchasesSection";

const recipes: Recipe[] = [{ recipeId: "potato-gratin", name: "Papas gratinadas", ingredients: [{ name: "potato", quantity: 3 }] }];

const item = (overrides: Partial<OrderItem>): OrderItem => ({
  itemId: "item-0001-xxxx",
  orderId: "order-0001-xxxx",
  status: "PENDING",
  attempts: 0,
  createdAt: "2026-10-19T12:00:00.000Z",
  updatedAt: "2026-10-19T12:00:00.000Z",
  ...overrides,
});

describe("PreparationsSection", () => {
  it("muestra receta, estado y motivo de espera", async () => {
    mockApi({
      "GET /recipes": { body: { recipes } },
      "GET /preparations": {
        body: {
          items: [
            item({ itemId: "a", recipeId: "potato-gratin", status: "WAITING_INGREDIENTS", attempts: 2, lastError: "Ingredientes insuficientes; se reintentará" }),
            item({ itemId: "b" }),
          ],
        },
      },
    });
    renderWithClient(<PreparationsSection />);

    expect(await screen.findByText("Papas gratinadas")).toBeInTheDocument();
    expect(screen.getAllByText("Esperando ingredientes").length).toBeGreaterThan(0);
    expect(screen.getByText("Ingredientes insuficientes; se reintentará")).toBeInTheDocument();
    expect(screen.getByText("Asignando receta…")).toBeInTheDocument();
  });

  it("muestra un estado vacío", async () => {
    mockApi({ "GET /recipes": { body: { recipes } }, "GET /preparations": { body: { items: [] } } });
    renderWithClient(<PreparationsSection />);
    expect(await screen.findByText(/No hay platos en cocina/)).toBeInTheDocument();
  });

  it("permite reintentar tras un error", async () => {
    const fetchMock = mockApi({ "GET /recipes": { body: { recipes } }, "GET /preparations": { status: 500, body: { message: "Error interno" } } });
    renderWithClient(<PreparationsSection />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Error interno");

    const before = fetchMock.mock.calls.length;
    await userEvent.setup().click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
  });
});

describe("InventorySection", () => {
  it("resalta ingredientes agotados y con stock bajo", async () => {
    mockApi({
      "GET /inventory": {
        body: {
          ingredients: [
            { name: "cheese", stock: 0, updatedAt: "2026-10-19T12:00:00.000Z" },
            { name: "rice", stock: 1, updatedAt: "2026-10-19T12:00:00.000Z" },
            { name: "tomato", stock: 5, updatedAt: "2026-10-19T12:00:00.000Z" },
          ],
        },
      },
    });
    renderWithClient(<InventorySection />);

    const cheese = (await screen.findByText("Queso")).closest("li");
    expect(cheese).not.toBeNull();
    expect(within(cheese as HTMLElement).getByText("Agotado")).toBeInTheDocument();
    expect(within(screen.getByText("Arroz").closest("li") as HTMLElement).getByText("Stock bajo")).toBeInTheDocument();
    expect(within(screen.getByText("Tomate").closest("li") as HTMLElement).queryByText(/Agotado|Stock bajo/)).toBeNull();
  });
});

describe("PurchasesSection", () => {
  it("muestra compras sin disponibilidad con 0 unidades", async () => {
    mockApi({
      "GET /purchases": {
        body: {
          purchases: [
            { purchaseId: "p1", itemId: "item-1", ingredient: "lemon", quantitySold: 0, status: "UNAVAILABLE", createdAt: "2026-10-19T12:00:00.000Z" },
          ],
        },
      },
    });
    renderWithClient(<PurchasesSection />);

    const row = (await screen.findByText("Limón")).closest("tr") as HTMLElement;
    expect(within(row).getByText("0")).toBeInTheDocument();
    expect(within(row).getByText("Sin disponibilidad")).toBeInTheDocument();
  });
});

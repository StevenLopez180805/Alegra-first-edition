import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi, renderWithClient } from "../test/utils";
import { OrderForm, validateQuantity } from "./OrderForm";

describe("validateQuantity", () => {
  it("acepta enteros en rango y rechaza el resto", () => {
    expect(validateQuantity("10", 100)).toBeNull();
    expect(validateQuantity("", 100)).not.toBeNull();
    expect(validateQuantity("0", 100)).not.toBeNull();
    expect(validateQuantity("101", 100)).not.toBeNull();
    expect(validateQuantity("2.5", 100)).not.toBeNull();
  });
});

describe("OrderForm", () => {
  async function submit(quantity: string) {
    const user = userEvent.setup();
    const input = screen.getByLabelText("Cantidad de platos");
    await user.clear(input);
    if (quantity) await user.type(input, quantity);
    await user.click(screen.getByRole("button", { name: "Pedir platos" }));
  }

  it("valida en cliente sin llamar al API", async () => {
    const fetchMock = mockApi({});
    renderWithClient(<OrderForm />);
    await submit("0");
    expect(screen.getByRole("alert")).toHaveTextContent("entre 1 y 100");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía el pedido y muestra el orderId", async () => {
    const fetchMock = mockApi({
      "POST /orders": { status: 202, body: { orderId: "abc-123", quantity: 10, status: "PENDING" } },
    });
    renderWithClient(<OrderForm />);
    await submit("10");

    expect(await screen.findByText(/Pedido de 10 platos recibido/)).toBeInTheDocument();
    expect(screen.getByText("ID: abc-123")).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({ method: "POST", body: JSON.stringify({ quantity: 10 }) });
  });

  it("muestra el error del backend tal cual", async () => {
    mockApi({ "POST /orders": { status: 500, body: { message: "Error interno" } } });
    renderWithClient(<OrderForm />);
    await submit("3");
    expect(await screen.findByRole("alert")).toHaveTextContent("Error interno");
  });
});

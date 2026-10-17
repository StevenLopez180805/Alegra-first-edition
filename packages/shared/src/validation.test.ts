import { describe, expect, it } from "vitest";
import { HttpError } from "./http";
import { parseQuantity } from "./validation";

describe("parseQuantity", () => {
  it("acepta enteros dentro del rango", () => {
    expect(parseQuantity({ quantity: 1 }, 10)).toBe(1);
    expect(parseQuantity({ quantity: 10 }, 10)).toBe(10);
  });

  it.each([0, -1, 11, 1.5, "3", null, undefined])("rechaza quantity=%s", (quantity) => {
    expect(() => parseQuantity({ quantity }, 10)).toThrow(HttpError);
  });

  it("rechaza cuerpos vacíos", () => {
    expect(() => parseQuantity(null, 10)).toThrow(HttpError);
  });
});

import { describe, expect, it } from "vitest";
import { allowedSourcesFor, canTransition, deriveOrderStatus } from "./status";

describe("transiciones de ítem", () => {
  it("DELIVERED y FAILED son estados finales", () => {
    expect(canTransition("DELIVERED", "PREPARING")).toBe(false);
    expect(canTransition("FAILED", "PREPARING")).toBe(false);
  });

  it("solo se entrega desde PREPARING", () => {
    expect(allowedSourcesFor("DELIVERED")).toEqual(["PREPARING"]);
  });
});

describe("deriveOrderStatus", () => {
  it("no marca DELIVERED si falta algún ítem", () => {
    expect(deriveOrderStatus(["DELIVERED", "WAITING_INGREDIENTS"])).toBe("IN_PROGRESS");
    expect(deriveOrderStatus(["DELIVERED", "FAILED"])).toBe("PARTIALLY_DELIVERED");
    expect(deriveOrderStatus(["DELIVERED", "DELIVERED"])).toBe("DELIVERED");
    expect(deriveOrderStatus(["PENDING", "PENDING"])).toBe("PENDING");
    expect(deriveOrderStatus(["FAILED"])).toBe("FAILED");
  });
});

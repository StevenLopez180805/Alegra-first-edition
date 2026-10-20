import { describe, expect, it } from "vitest";
import { RETRY_MAX_SECONDS, retryDelaySeconds } from "./backoff";

describe("retryDelaySeconds", () => {
  it("crece de forma exponencial con el número de entregas", () => {
    const max = (count: number) => retryDelaySeconds(count, () => 1);
    expect([1, 2, 3, 4, 5].map(max)).toEqual([15, 30, 60, 120, 240]);
  });

  it("nunca supera el máximo", () => {
    expect(retryDelaySeconds(20, () => 1)).toBe(RETRY_MAX_SECONDS);
  });

  it("aplica jitter entre la mitad y el total del intervalo", () => {
    expect(retryDelaySeconds(3, () => 0)).toBe(30);
    expect(retryDelaySeconds(3, () => 0.5)).toBe(45);
    expect(retryDelaySeconds(3, () => 1)).toBe(60);
  });

  it("tolera valores fuera de rango", () => {
    expect(retryDelaySeconds(0, () => 0)).toBeGreaterThanOrEqual(1);
    expect(retryDelaySeconds(Number.NaN, () => 0)).toBeGreaterThanOrEqual(1);
  });
});

import { describe, expect, it, vi } from "vitest";
import { mockApi } from "../test/utils";
import { ApiError, apiFetch } from "./client";

describe("apiFetch", () => {
  it("concatena VITE_API_URL sin duplicar la barra", async () => {
    vi.stubEnv("VITE_API_URL", "https://api.test/");
    const fetchMock = mockApi({ "GET /health": { body: { status: "ok" } } });
    await expect(apiFetch("/health")).resolves.toEqual({ status: "ok" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.test/health");
  });

  it("propaga el message del backend como ApiError", async () => {
    mockApi({ "POST /orders": { status: 400, body: { message: "quantity debe estar entre 1 y 100" } } });
    const error = await apiFetch("/orders", { method: "POST" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "quantity debe estar entre 1 y 100" });
  });

  it("informa un error de red legible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    await expect(apiFetch("/inventory")).rejects.toMatchObject({ status: 0, message: expect.stringContaining("conectar") });
  });

  it("falla con un mensaje claro si falta VITE_API_URL", async () => {
    vi.stubEnv("VITE_API_URL", "");
    await expect(apiFetch("/inventory")).rejects.toMatchObject({ message: expect.stringContaining("VITE_API_URL") });
  });
});

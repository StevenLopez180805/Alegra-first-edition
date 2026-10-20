/** Error del API con el `message` que envía el backend (`{ "message": string }`). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function baseUrl(): string {
  const url = import.meta.env.VITE_API_URL?.trim();
  if (!url) throw new ApiError(0, "Falta configurar VITE_API_URL (URL del API desplegado).");
  return url.replace(/\/+$/, "");
}

function messageFrom(body: unknown, status: number): string {
  const message = (body as { message?: unknown } | null)?.message;
  return typeof message === "string" && message.length > 0 ? message : `Error ${status} del servidor`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(0, "No se pudo conectar con el API. Revisa tu conexión e inténtalo de nuevo.");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, messageFrom(body, response.status));
  return body as T;
}

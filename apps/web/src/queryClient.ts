import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api/client";

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Los errores 4xx no se arreglan reintentando; los de red y 5xx se reintentan una vez.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
      },
    },
  });
}

type Level = "debug" | "info" | "warn" | "error";
type Context = Record<string, unknown>;

function write(level: Level, message: string, context: Context) {
  const line = JSON.stringify({ level, message, timestamp: new Date().toISOString(), ...context });
  if (level === "error") console.error(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, extra?: Context): void;
  info(message: string, extra?: Context): void;
  warn(message: string, extra?: Context): void;
  error(message: string, extra?: Context): void;
  child(extra: Context): Logger;
}

/** Logger JSON estructurado; incluir orderId/itemId en el contexto cuando existan. */
export function createLogger(service: string, base: Context = {}): Logger {
  const ctx = { service, ...base };
  return {
    debug: (message, extra = {}) => write("debug", message, { ...ctx, ...extra }),
    info: (message, extra = {}) => write("info", message, { ...ctx, ...extra }),
    warn: (message, extra = {}) => write("warn", message, { ...ctx, ...extra }),
    error: (message, extra = {}) => write("error", message, { ...ctx, ...extra }),
    child: (extra) => createLogger(service, { ...base, ...extra }),
  };
}

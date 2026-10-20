// Empaqueta cada handler en dist/lambdas/<lambda>/index.mjs para que SAM lo despliegue tal cual.
import { rm } from "node:fs/promises";
import { build } from "esbuild";

/** Nombre de la carpeta de salida → entrada del handler. */
const LAMBDAS = {
  orders: "services/orders/src/handler.ts",
  "orders-reconcile": "services/orders/src/reconcile-handler.ts",
  recipes: "services/recipes/src/handler.ts",
  inventory: "services/inventory/src/handler.ts",
  preparation: "services/preparation/src/handler.ts",
  procurement: "services/procurement/src/handler.ts",
};

await rm("dist/lambdas", { recursive: true, force: true });

await Promise.all(
  Object.entries(LAMBDAS).map(([name, entry]) =>
    build({
      entryPoints: [entry],
      outfile: `dist/lambdas/${name}/index.mjs`,
      bundle: true,
      platform: "node",
      target: "node24",
      format: "esm",
      sourcemap: true,
      minify: false,
      // El AWS SDK v3 viene incluido en el runtime de Lambda.
      external: ["@aws-sdk/*"],
      // Permite usar require() de dependencias CJS dentro del bundle ESM.
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      logLevel: "warning",
    }),
  ),
);

console.log(`Lambdas empaquetadas: ${Object.keys(LAMBDAS).join(", ")}`);

// Empaqueta cada handler en dist/lambdas/<servicio>/index.mjs para que SAM lo despliegue tal cual.
import { rm } from "node:fs/promises";
import { build } from "esbuild";

const SERVICES = ["orders", "recipes", "inventory", "preparation", "procurement"];

await rm("dist/lambdas", { recursive: true, force: true });

await Promise.all(
  SERVICES.map((service) =>
    build({
      entryPoints: [`services/${service}/src/handler.ts`],
      outfile: `dist/lambdas/${service}/index.mjs`,
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

console.log(`Lambdas empaquetadas: ${SERVICES.join(", ")}`);

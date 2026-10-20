# Jornada de Almuerzo Gratis

Reto técnico de Alegra. Un gerente pide X platos desde un dashboard web; la cocina asigna recetas aleatorias,
descuenta ingredientes de la bodega, compra en la plaza de mercado lo que falte y entrega cada plato solo cuando
tiene todos sus ingredientes.

- **Backend:** microservicios serverless en AWS (API Gateway HTTP API, 5 Lambdas en Node.js + TypeScript,
  DynamoDB, SQS), desplegados con AWS SAM (`infra/template.yaml`). Sin frameworks backend.
- **Frontend:** React + Vite + TypeScript en `apps/web`.
- Planificación: [PLANNING.md](PLANNING.md).

## Requisitos

- Node.js 24 y pnpm 12 (`corepack enable` o `npm i -g pnpm@12.14.0`)
- Para desplegar el backend: AWS CLI configurado y AWS SAM CLI

```bash
pnpm install
```

## Backend

```bash
pnpm typecheck     # TypeScript de todo el monorepo
pnpm test          # tests unitarios de dominio
pnpm deploy        # build de las Lambdas + sam deploy (configuración en infra/samconfig.toml)

# Carga inicial (10 ingredientes con 5 unidades y 6 recetas); idempotente
TABLE_NAME=<output TableName> AWS_REGION=us-east-1 pnpm seed
```

Endpoints (base: output `ApiUrl`): `POST /orders`, `GET /orders`, `GET /orders/{orderId}`, `GET /preparations`,
`GET /inventory`, `GET /purchases`, `GET /recipes`, `GET /health`.

## Frontend

Dashboard de una sola página para el gerente. Arriba, siempre visibles: **Pedir platos** y **Platos en cocina**.
Abajo, en pestañas: historial de pedidos (con detalle de cada pedido), inventario de bodega, historial de compras
y recetas. Se actualiza solo cada 4 s; el polling se pausa cuando la pestaña del navegador no está visible.

Stack: React 19, Vite, TypeScript estricto, TanStack Query (todas las llamadas al API), Tailwind CSS 4, `fetch`
nativo. Los tipos del API se importan con `import type` desde `@jag/shared/types` (sin código de backend en el
bundle).

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `VITE_API_URL` | Sí | URL base del API (output `ApiUrl` de `sam deploy`), sin barra final |
| `VITE_MAX_ORDER_ITEMS` | No | Máximo de platos por pedido para la validación en cliente; debe coincidir con `MaxOrderItems` del backend (por defecto 100) |

Las variables `VITE_*` se incrustan en el JavaScript al compilar: **no** pongas secretos en ellas.

### Desarrollo local

```bash
cp apps/web/.env.example apps/web/.env.local   # y completa VITE_API_URL
pnpm dev:web                                    # http://localhost:5173
```

El API desplegado acepta peticiones desde cualquier origen mientras `AllowedOrigin` sea `*`. Si lo restringes,
el desarrollo local necesitará ese origen permitido.

### Build y pruebas

```bash
pnpm build:web     # tsc + vite build → apps/web/dist
pnpm test:web      # Vitest + Testing Library (jsdom)
```

### Despliegue (AWS Amplify Hosting, HTTPS)

El repositorio incluye [amplify.yml](amplify.yml), preparado para el monorepo.

1. En la consola de AWS: **Amplify → Create new app → GitHub**, autoriza el acceso y elige este repositorio y la
   rama principal.
2. Marca **"My app is a monorepo"** e indica la ruta `apps/web`. Amplify detecta `amplify.yml`.
3. En **Advanced settings → Environment variables** agrega:
   - `AMPLIFY_MONOREPO_APP_ROOT` = `apps/web`
   - `VITE_API_URL` = `https://<id>.execute-api.us-east-1.amazonaws.com`
4. Guarda y despliega. Amplify entrega una URL HTTPS del tipo `https://main.<id>.amplifyapp.com`, y cada push a la
   rama vuelve a desplegar.
5. Restringe CORS del backend a esa URL y redespliega:

   ```bash
   pnpm build
   sam deploy --template-file infra/template.yaml --parameter-overrides AllowedOrigin=https://main.<id>.amplifyapp.com
   ```

   `--parameter-overrides` reemplaza todos los overrides guardados en `infra/samconfig.toml`. Los demás parámetros
   vuelven a su valor por defecto, que hoy coincide con el configurado (`MaxOrderItems=100`,
   `MaxPreparationAttempts=5`). La alternativa es editar `AllowedOrigin` en `infra/samconfig.toml` y ejecutar
   `pnpm deploy`.

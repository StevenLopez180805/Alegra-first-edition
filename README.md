# Jornada de Almuerzo Gratis

Reto técnico de **Alegra (Backend Developer, Node.js)**.

Un restaurante regala almuerzos durante una jornada. El gerente pide **X platos** desde un dashboard web y el
sistema hace el resto por su cuenta:

1. Asigna a cada plato una receta **aleatoria** entre 6.
2. Pide los ingredientes a la bodega.
3. Si faltan ingredientes, los **compra automáticamente** en la plaza de mercado (API externa de Alegra).
4. **Entrega el plato solo cuando tiene todos sus ingredientes**, y en ese momento los descuenta del inventario.

El backend es una arquitectura de **microservicios serverless en AWS Lambda**, escrita en Node.js + TypeScript
**sin frameworks backend**. Está pensada para recibir pedidos concurrentes sin corromper el inventario.

| | |
|---|---|
| **Dashboard** | _Pendiente: Aun no lo despliego, TODO: ACTUALIZAR URL AL DESPLEGAR_ |
| **API** | `https://48d8la9d49.execute-api.us-east-1.amazonaws.com` |

---

## Contenido

- [Cómo funciona](#cómo-funciona)
- [Arquitectura](#arquitectura)
- [Integridad de datos y concurrencia](#integridad-de-datos-y-concurrencia)
- [API](#api)
- [Recetas](#recetas)
- [Stack](#stack)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Ejecutar y desplegar](#ejecutar-y-desplegar)
- [Pruebas](#pruebas)
- [Decisiones y limitaciones conocidas](#decisiones-y-limitaciones-conocidas)
- [Documentación](#documentación)

---

## Cómo funciona

1. El gerente pide X platos en el dashboard → `POST /orders { "quantity": X }`.
2. **Orders** guarda el pedido y sus X platos (`PENDING`) en DynamoDB, encola **un mensaje SQS por plato** y
   responde `202 Accepted` de inmediato. La creación es asíncrona: la API no espera a la cocina.
3. **Preparation** (el worker de SQS) toma cada plato y:
   - le asigna una receta aleatoria, que queda fija aunque el mensaje se reintente;
   - intenta **consumir todos los ingredientes y entregar el plato en una sola transacción**;
   - si falta stock, calcula qué ingredientes faltan y los **compra al mercado** (hasta 3 llamadas por ingrediente).
     El mercado puede vender menos de lo pedido o responder `0`, que significa que no hay disponibilidad;
   - si después de comprar sigue faltando stock, el plato queda en `WAITING_INGREDIENTS` y se reintenta con
     **backoff exponencial y jitter** (~15 s → 300 s). Tras 5 intentos pasa a `FAILED` y se guarda el motivo.
4. El dashboard consulta la API cada 4 s y muestra las órdenes en preparación, el inventario, las compras, el
   historial de pedidos y las recetas.

### Estados

```
Plato:   PENDING → PREPARING → DELIVERED
                       │  ▲
                       ▼  │
              WAITING_INGREDIENTS ──(5 intentos)──► FAILED
```

`DELIVERED` y `FAILED` son estados finales. El estado del **pedido** no se guarda por separado: se calcula a partir
de sus platos (`PENDING`, `IN_PROGRESS`, `DELIVERED`, `PARTIALLY_DELIVERED`, `FAILED`). Un pedido con algún plato
sin entregar nunca aparece como `DELIVERED`.

---

## Arquitectura

```
                 ┌──────────────────────────┐
                 │  Dashboard React (Vite)  │  Amplify Hosting
                 └────────────┬─────────────┘
                              │ HTTPS (polling 4 s)
                 ┌────────────▼─────────────┐
                 │  API Gateway (HTTP API)  │  throttling 20 rps / burst 50
                 └──┬───────┬───────┬───────┬┘
                    │       │       │       │
               Orders  Recipes  Inventory  Procurement      ← Lambdas (1 por servicio)
                    │                                │
          SQS (1 msg │ por plato)                     │
                    ▼                                │
             Preparation (worker) ──────────────────────► API del mercado
                    │   usa @jag/recipes, @jag/inventory, @jag/procurement
                    │
          SQS ──(7 recepciones)──► DLQ

   Todas las Lambdas ──► DynamoDB (single-table, on-demand)
   EventBridge Scheduler (cada 5 min) ──► ReconcileOrders (reencola pedidos huérfanos)
```

### Microservicios

| Servicio | Responsabilidad | Endpoints |
|---|---|---|
| **Orders** | Valida `quantity`, crea el pedido y sus platos, los encola y expone su estado | `POST /orders`, `GET /orders`, `GET /orders/{orderId}`, `GET /preparations`, `GET /health` |
| **Recipes** | Catálogo de solo lectura de las 6 recetas y selección aleatoria | `GET /recipes` |
| **Inventory** | Stock, cálculo de faltantes, consumo atómico y reposición idempotente | `GET /inventory` |
| **Procurement** | Cliente del mercado (timeout de 5 s, validación de la respuesta), historial de compras y reposición | `GET /purchases` |
| **Preparation** | Worker de SQS que coordina receta → consumo → compras → entrega, espera o fallo | evento SQS |

Cada servicio tiene su propia Lambda, sus permisos IAM mínimos y la misma estructura interna:

```
services/<servicio>/src/
├── handler.ts      # entrada Lambda
├── domain/         # lógica pura, con dependencias inyectadas y tests
├── repository.ts   # acceso a DynamoDB
└── index.ts        # contrato público para otros servicios
```

El enrutado HTTP lo hace un router propio de unas pocas líneas (`packages/shared/src/http.ts`), sin Express,
Fastify ni NestJS.

### Modelo de datos (DynamoDB single-table)

| Registro | PK | SK | GSI1 |
|---|---|---|---|
| Ingredient | `INGREDIENT` | `<name>` | — |
| Recipe | `RECIPE` | `<recipeId>` | — |
| Order | `ORDER#<id>` | `META` | `ORDERS` / `<createdAt>#<id>` |
| OrderItem | `ORDER#<id>` | `ITEM#<itemId>` | `ITEMSTATE#<status>` (solo estados activos) |
| PurchaseAttempt | `PURCHASE#<id>` | `META` | `PURCHASES` / `<createdAt>#<id>` |
| StockMovement | `MOVEMENT#<id>` | `META` | `MOVEMENTS` / `<createdAt>#<id>` |
| Marcadores de idempotencia | `CONSUMPTION#<itemId>`, `RESTOCK#<purchaseId>` | `META` | — |
| Outbox | `OUTBOX` | `<createdAt>#<orderId>` | — |

Todas las vistas usan `Query` por PK o por GSI1. Ninguna usa `Scan`.

---

## Integridad de datos y concurrencia

Esta es la parte central del reto. Estas son las garantías que da el sistema y cómo las cumple:

| Garantía | Mecanismo |
|---|---|
| Ningún plato se entrega sin **todos** sus ingredientes | Consumir el stock, marcar el plato `DELIVERED` y sumar `deliveredCount` al pedido van en **un único `TransactWriteItems`**. Si falla una condición, no se aplica nada. |
| El stock nunca queda negativo | Cada descuento es una actualización condicional `stock >= :q`. |
| Cada plato consume inventario **a lo sumo una vez** | Marcador `CONSUMPTION#<itemId>` creado con `attribute_not_exists` dentro de la misma transacción. |
| Un mensaje SQS duplicado no causa una segunda entrega | El worker es idempotente: si el plato ya está `DELIVERED` o `FAILED`, termina sin efectos. |
| Una compra repone stock **una sola vez** | Marcador `RESTOCK#<purchaseId>`. Cerrar la compra `SOLD` y reponer el stock son una sola transacción. |
| Un reintento nunca cambia la receta | La receta se asigna con `if_not_exists`. |
| No se pierden pedidos | El pedido se guarda **antes** de encolarse, junto con un registro `OUTBOX`. Un barrido programado cada 5 min reencola los platos `PENDING` cuyo outbox tenga más de 2 minutos. |
| No se inventan compras | Cada compra se registra como `REQUESTED` **antes** de llamar al mercado. Si hay error o timeout, se suma 0. Un intento que queda en `REQUESTED` es visible en el dashboard como "Sin confirmar". |

**Límites de costo y abuso:** throttling en API Gateway, concurrencia máxima del worker en 2, máximo 100 platos
por pedido (`MAX_ORDER_ITEMS`) y DLQ para los mensajes que agotan sus reintentos.

---

## API

La API es pública a propósito, para que se pueda evaluar sin iniciar sesión.

```bash
API=https://48d8la9d49.execute-api.us-east-1.amazonaws.com

# Pedir 5 platos
curl -X POST "$API/orders" -H "Content-Type: application/json" -d '{"quantity": 5}'
# → 202 { "orderId": "...", "quantity": 5, "status": "PENDING" }

curl "$API/orders/<orderId>"   # detalle del pedido con sus platos
curl "$API/preparations"       # platos en curso
curl "$API/inventory"          # stock actual
curl "$API/purchases"          # historial de compras al mercado
curl "$API/orders"             # historial de pedidos
curl "$API/recipes"            # recetas y sus ingredientes
curl "$API/health"
```

| Método | Ruta | Respuesta |
|---|---|---|
| `POST` | `/orders` | `202` con `{ orderId, quantity, status }`. `400` si `quantity` no es un entero entre 1 y 100. |
| `GET` | `/orders` | `{ orders: [...] }`, los más recientes primero (`?limit=`) |
| `GET` | `/orders/{orderId}` | Pedido con sus platos, o `404` |
| `GET` | `/preparations` | `{ items: [...] }` con los platos en estados activos (`?limit=`) |
| `GET` | `/inventory` | Stock por ingrediente |
| `GET` | `/purchases` | Intentos de compra con su resultado (`SOLD`, `UNAVAILABLE`, `ERROR`, `REQUESTED`) |
| `GET` | `/recipes` | Las 6 recetas |
| `GET` | `/health` | Estado del servicio Orders |

---

## Recetas

Solo se usan los 10 ingredientes permitidos. El inventario inicial es de **5 unidades de cada uno**.

| Receta | Ingredientes |
|---|---|
| Ensalada de pollo | chicken ×1, lettuce ×2, tomato ×1, lemon ×1 |
| Hamburguesa con queso | meat ×1, cheese ×1, lettuce ×1, tomato ×1, onion ×1, ketchup ×1 |
| Arroz con pollo | rice ×2, chicken ×1, onion ×1, tomato ×1 |
| Papas gratinadas | potato ×3, cheese ×2, onion ×1 |
| Carne con arroz | meat ×1, rice ×1, potato ×1, onion ×1 |
| Ensalada fresca | lettuce ×2, tomato ×2, onion ×1, lemon ×1, cheese ×1 |

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js 24 + TypeScript (estricto), handlers Lambda nativos |
| Infraestructura | AWS SAM / CloudFormation: Lambda, API Gateway HTTP API, SQS + DLQ, DynamoDB on-demand, EventBridge Scheduler |
| Bundling | esbuild (ESM, un bundle por Lambda) |
| Frontend | React 19 + Vite + TanStack Query + Tailwind CSS 4 |
| Hosting del frontend | AWS Amplify Hosting (`amplify.yml`) |
| Monorepo | pnpm workspaces |
| Pruebas | Vitest |

---

## Estructura del repositorio

```
├── apps/web/                 # Dashboard React
├── services/
│   ├── orders/               # API de pedidos + reconciliación programada
│   ├── recipes/
│   ├── inventory/
│   ├── procurement/
│   └── preparation/          # Worker SQS
├── packages/
│   ├── shared/               # Tipos, constantes, estados, validación, router HTTP, logger JSON
│   └── persistence/          # Cliente DynamoDB y diseño de claves
├── infra/
│   ├── template.yaml         # Plantilla SAM
│   └── samconfig.toml
├── scripts/
│   ├── build-lambdas.mjs     # Bundle de las Lambdas con esbuild
│   └── seed.ts               # Carga inicial idempotente (ingredientes y recetas)
├── PLANNING.md               # Planificación, riesgos y casos de prueba
└── amplify.yml
```

---

## Ejecutar y desplegar

### Requisitos

- Node.js 24 y pnpm 12
- AWS CLI con credenciales configuradas y AWS SAM CLI (solo para desplegar)

### Desarrollo

```bash
pnpm install
pnpm typecheck
pnpm test

# Dashboard contra la API desplegada
echo "VITE_API_URL=https://48d8la9d49.execute-api.us-east-1.amazonaws.com" > apps/web/.env.local
pnpm dev:web
```

### Despliegue del backend

```bash
pnpm build                                              # typecheck + bundle en dist/lambdas/
sam validate --template-file infra/template.yaml --lint
pnpm deploy                                             # sam deploy con infra/samconfig.toml
TABLE_NAME=<tabla> AWS_REGION=us-east-1 pnpm seed       # 10 ingredientes × 5 y 6 recetas
```

La plantilla toma los bundles de `dist/lambdas/`, así que hay que compilar antes de desplegar.

Parámetros de la plantilla:

| Parámetro | Valor por defecto |
|---|---|
| `MaxOrderItems` | 100 |
| `MaxPreparationAttempts` | 5 |
| `AllowedOrigin` | Origen permitido por CORS |

Para ver los logs del worker:

```bash
sam logs --stack-name jornada-almuerzo-gratis --name PreparationFunction --tail
```

### Despliegue del frontend

Amplify Hosting se conecta a este repositorio y usa `amplify.yml`. Estas son las variables de entorno que hay que
configurar en la consola de Amplify:

```
AMPLIFY_MONOREPO_APP_ROOT = apps/web
VITE_API_URL              = <ApiUrl del stack>
```

---

## Pruebas

```bash
pnpm test        # tests unitarios del backend (Vitest)
pnpm test:web    # tests del dashboard
```

Los tests unitarios cubren la lógica de dominio sin depender de AWS, gracias a las dependencias inyectadas:

- validación de entrada y transiciones de estado válidas;
- catálogo de recetas: 6 recetas, solo ingredientes permitidos;
- cálculo de faltantes;
- algoritmo del worker: entrega, espera, fallo, idempotencia y receta estable entre reintentos;
- interpretación de la respuesta del mercado (`0`, valores inválidos, timeout) y flujo de compras;
- backoff exponencial con jitter;
- reconciliación de pedidos no encolados.

Las pruebas de concurrencia (10–50 pedidos simultáneos) y de idempotencia contra AWS real están planificadas en
`PLANNING.md` (QA-02/03). **Todavía no se han ejecutado.**

## Documentación

- [PLANNING.md](PLANNING.md): planificación, decisiones de stack, riesgos y casos de prueba T01–T14.

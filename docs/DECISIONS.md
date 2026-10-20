# Decisiones (ADR resumido)

Complementa la tabla de decisiones de [PLANNING.md](../PLANNING.md) §2. Las entradas más recientes van arriba.

## 2026-10-19 — Reconciliación de pedidos no encolados (PRE-04)

- **Problema:** `POST /orders` guarda el pedido y luego lo encola en SQS. Si SQS rechaza mensajes, o la Lambda
  muere entre ambos pasos, los platos quedan en `PENDING` sin mensaje y nunca se preparan (invariante 6).
- **Outbox:** junto con el pedido se escribe `PK=OUTBOX, SK=<createdAt>#<orderId>`, en el primer lote del
  BatchWrite (si existe el pedido, existe su outbox). Cuando todos los mensajes se encolan, el handler lo borra.
  Si queda alguno sin encolar, el outbox se conserva.
- **Barrido programado:** `ReconcileOrdersFunction` (EventBridge Scheduler, cada 5 min) consulta los outbox de
  más de 2 minutos (`Query` por PK y rango de SK, sin `Scan`), reencola los platos que sigan `PENDING` y borra el
  outbox. Si algún mensaje vuelve a fallar, el outbox se conserva para el siguiente barrido. Revisa como máximo 25
  pedidos por ejecución.
- **Duplicados aceptados:** si la Lambda muere después de encolar pero antes de borrar el outbox, el barrido
  reencola platos que ya estaban en la cola. Es seguro porque el worker es idempotente (invariante 4). El
  peor caso es una preparación extra que termina en `ALREADY_DONE`, aunque puede sumar un `attempts`.
- **Límite conocido:** un BatchWrite que falla a mitad del pedido puede dejar platos sin guardar; el barrido solo
  reencola los que existen. Garantizar el pedido completo requeriría `TransactWriteItems`, limitado a 100
  operaciones, que no alcanza para `MAX_ORDER_ITEMS=100` más el pedido y el outbox.

## 2026-10-19 — Trazabilidad de compras y backoff de reintentos (BUY-02)

- **Intento registrado antes de comprar:** cada compra se guarda como `REQUESTED` *antes* de llamar al mercado y
  luego se cierra con su resultado (`SOLD`, `UNAVAILABLE`, `ERROR`) y `completedAt`. Si la Lambda muere en medio,
  el intento queda en `REQUESTED` ("Sin confirmar" en el dashboard): el mercado pudo haber vendido sin que lo
  sepamos, y ese riesgo residual queda visible en vez de perderse. No se inventa la cantidad.
- **Cierre y reposición atómicos:** cerrar una compra `SOLD` y reponer el stock van en un único
  `TransactWriteItems` (`completePurchase` en procurement, con `buildRestockTransactItems` de inventory). Así no
  puede existir una compra `SOLD` sin su stock ni stock repuesto sin compra cerrada. El cierre exige
  `status = REQUESTED`, y el marcador `RESTOCK#<purchaseId>` sigue impidiendo reponer dos veces.
- **Backoff exponencial con jitter:** cuando un plato queda en `WAITING_INGREDIENTS`, o su procesamiento lanza un
  error, el worker llama a `ChangeMessageVisibility` con ~15 s, 30 s, 60 s, 120 s, 240 s (máximo 300 s) según
  `ApproximateReceiveCount`, en lugar de esperar los 180 s fijos de la cola. La mitad del intervalo es aleatoria,
  para que los platos de un mismo pedido no reintenten a la vez. Si `ChangeMessageVisibility` falla, el mensaje
  vuelve igual con el visibility timeout de la cola. Requiere `QUEUE_URL` y el permiso
  `sqs:ChangeMessageVisibility` en el worker.

## 2026-10-19 — Frontend (WEB-01…04)

- **Stack:** React 19 + Vite + TypeScript estricto, TanStack Query para todo el acceso al API, Tailwind CSS 4 y
  `fetch` nativo. Sin librerías de estado global ni de componentes: los componentes que se necesitaban (badge,
  pestañas accesibles, modal) eran pocos y pequeños, así que se escribieron a mano en vez de agregar shadcn/ui.
- **Contrato de tipos compartido:** `@jag/shared` expone el subpath `@jag/shared/types`
  (`packages/shared/src/contracts.ts`), que reexporta solo tipos de `types.ts`, `status.ts` y `constants.ts`. El
  índice completo arrastra código que depende de Node (`Buffer`, `process`) y de `aws-lambda`, y no debe entrar en
  el frontend. El frontend solo usa `import type`.
- **Tiempo real por polling** cada 4 s (preparaciones, pedidos, inventario, compras y el detalle abierto), con la
  pausa por defecto de TanStack Query cuando la pestaña no está visible. Las recetas no se sondean
  (`staleTime: Infinity`). WebSockets quedan fuera de alcance.
- **Reintentos de queries:** no se reintentan los errores 4xx; los de red y 5xx se reintentan una vez.
- **Compras:** el backend solo registra `quantitySold`; no guarda la cantidad solicitada en cada compra, así que el
  historial muestra unidades vendidas y resultado. Mostrar la cantidad solicitada requeriría agregarla a
  `PurchaseAttempt`.
- **Hosting:** AWS Amplify Hosting conectado a GitHub (`amplify.yml` en la raíz, app root `apps/web`), porque
  entrega HTTPS sin agregar S3 + CloudFront a la plantilla.

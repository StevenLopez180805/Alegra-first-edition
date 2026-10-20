# Decisiones (ADR resumido)

Complementa la tabla de decisiones de [PLANNING.md](../PLANNING.md) §2. Las entradas más recientes van arriba.

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

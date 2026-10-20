## Que usare para cada apartado y por que

| Decisión | Opción | Motivo / compromiso |
|---|---|---|
| Backend | Node.js + TypeScript; manejadores Lambda nativos | Cumple restricción sin frameworks prohibidos; seguridad de tipos. |
| Infraestructura | AWS SAM + CloudFormation | Despliegue reproducible como código. |
| Cómputo | AWS Lambda por servicio | Menor administración de servidores y experiencia Serverless. |
| API pública | Amazon API Gateway HTTP API | Enrutamiento y CORS centralizados. |
| Proceso asíncrono | Amazon SQS Standard → Lambda Preparation Worker | Desacoplar peticiones HTTP del trabajo de cocina y amortiguar picos. |
| Persistencia | Amazon DynamoDB, capacidad on-demand | Evitar gestión de servidores y conexiones SQL. |
| Integridad | `ConditionExpression` + `TransactWriteItems` | Consumo condicional y estados idempotentes, sin inventario negativo. |
| Frontend | React + Vite + TypeScript | Dashboard de una página, rápido de desarrollar. |
| Hospedaje frontend | Este aun lo estoy evaluando, pero de momento mi mejor opcion es AWS Amplify Hosting | Elegir y registrar URL definitiva durante el despliegue. S3 por sí solo no proporciona HTTPS en el endpoint de sitio web; para un frontend HTTPS usar Amplify o S3 + CloudFront según disponibilidad y presupuesto. |
| Pruebas | Vitest; mocks de mercado; pruebas integradas contra entorno de AWS | Desarrollo ágil y escenarios deterministas. |
| Observabilidad | CloudWatch Logs y métricas mínimas; logs con `orderId`/`itemId` | Depuración y operación reproducibles. |
| Funcionalidades con IA | Postergado | Solo la implementare si hay tiempo suficiente despues de probar el funcionamiento del flujo principal. |

**Límite de arquitectura:** cinco microservicios lógicos (Orders, Recipes, Inventory, Preparation, Procurement), cada uno con handler Lambda y código de dominio aislado en monorepo. Para el plazo se propone **una tabla DynamoDB compartida con claves y permisos separados por dominio** como compromiso de infraestructura; esto **no** representa aislamiento total de datos por microservicio. Si se exige aislamiento físico estricto, pasar a tablas separadas antes de codificar (mayor complejidad). El orquestador de preparación se comunica con adaptadores de dominio explícitos; no se deben hacer dependencias circulares ni escritura directa no autorizada entre módulos.

### Componentes y responsabilidades

1. **Orders Service:** valida `quantity`, crea pedido e ítems, ofrece consultas de estado/historial, encola trabajos. Una llamada puede crear varios ítems; para limitar duración y escrituras, definir `MAX_ORDER_ITEMS` y validar su valor.
2. **Recipes Service:** expone las seis recetas y sus ingredientes. Los datos son de solo lectura durante la ejecución; la selección aleatoria se registra por ítem para que los reintentos no cambien la receta.
3. **Inventory Service:** consulta existencias, registra reposiciones y efectúa consumo atómico asociado a un ítem, bajo condiciones de suficiencia; evita saldos negativos.
4. **Preparation Service:** recibe mensajes SQS por plato, selecciona/recupera receta, solicita abastecimiento cuando haga falta, cambia estados y finaliza la preparación. Define políticas de reintento, idempotencia y recuperación.
5. **Procurement Service:** encapsula integración con mercado, valida `quantitySold`, registra intentos y resultados, y repone existencias confirmadas. Maneja `0`, fallos de red, timeout y respuestas inválidas.

### Estructura propuesta del repositorio

Al ser un monorepo la estructura de carpetas que voy a seguir va a ser la siguiente:

```
/
├── PLANNING.md
├── README.md
├── AGENTS.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DECISIONS.md
│   └── TESTING.md
├── apps/
│   └── web/                 # Aqui va a ir mi front
├── services/
│   ├── orders/
│   ├── recipes/
│   ├── inventory/
│   ├── preparation/
│   └── procurement/
├── packages/
│   ├── shared/               # Utilidades para el proyecto
│   └── persistence/          # Aqui va el acceso a DynamoDB y las operaciones atómicas
├── infra/
│   └── template.yaml         # Aqui configuro AWS SAM para desplegar
├── tests/
│   ├── integration/
│   └── load/
└── package.json
```

### Entidades que manejare

| Entidad | Datos mínimos |
|---|---|
| Ingredient | `name`, `stock`, `updatedAt` |
| Recipe | `recipeId`, `name`, `ingredients[{name, quantity}]` |
| Order | `orderId`, `quantity`, `status`, `createdAt`, `updatedAt` |
| OrderItem | `itemId`, `orderId`, `recipeId`, `status`, `attempts`, `createdAt` |
| PurchaseAttempt | `purchaseId`, `itemId`, `ingredient`, `quantitySold`, `status`, `createdAt`, `error?` |
| StockMovement | `movementId`, `itemId?`, `ingredient`, `delta`, `reason`, `createdAt` |


### Endpoints que manejare

| Verbo | Ruta | Respuesta / propósito |
|---|---|---|
| POST | `/orders` | `{ quantity }` → `202 Accepted`, `orderId` y estado inicial. |
| GET | `/orders` | Historial de pedidos (paginado o acotado). |
| GET | `/orders/{orderId}` | Pedido, ítems y sus estados. |
| GET | `/preparations` | Ítems en cola/preparación/espera, con estados. |
| GET | `/inventory` | Stock actual de los diez ingredientes. |
| GET | `/recipes` | Las seis recetas y sus ingredientes. |
| GET | `/purchases` | Historial de intentos/ventas confirmadas. |

Estados mínimos por ítem: `PENDING`, `PREPARING`, `WAITING_INGREDIENTS`, `DELIVERED`, `FAILED`. Las transiciones deben estar validadas y ser monotónicas cuando corresponda. El estado agregado del pedido se deriva de los estados de sus ítems; un pedido parcialmente servido no debe aparecer como completamente entregado.

## 5. Consistencia, concurrencia y compras

### Invariantes (no negociables)

1. Nunca entregar un plato si no se han consumido todas las unidades de su receta.
2. Nunca dejar unidades negativas; usar condición `stock >= required` en actualización atómica por ingrediente.
3. Cada ítem se consume **a lo sumo una vez**, mediante marcador `itemId` y escritura transaccional conjunta con el estado de entrega y movimientos de stock.
4. Un mensaje SQS duplicado no genera una segunda entrega ni un segundo descuento.
5. Los eventos de compra confirmados solo incrementan inventario una vez (idempotencia por `purchaseId`).
6. No perder pedidos por reinicios; si falla el envío a SQS luego de persistir el pedido, contemplar recuperación controlada (reconciliación de pendientes o patrón outbox) y documentar el mecanismo implementado.

### Reparticion de tiempos

Lo mas importante es saber de cuanto tiempo dispongo para invertir en el proyecto, asi que primero voy a hacer un estimado

**Capacidad estimada según disponibilidad:** viernes 2 h; sábado 5,5 h; domingo 10 h de trabajo efectivo (con descansos); lunes 3,5 h; martes 2 h; miércoles 2 h; jueves 2 h. **Total 27 h.** Aqui tengo que revisar cada noche el tiempo real y la mayoria del proyecto deberia quedar el domingo.


Ahora, voy a sacar las tareas "unitarias" y las voy a dividir a lo largo de los días para saber como deberia ir avanzando el proyecto para que este funcionando totalmente el dia de la entrega, para esto me apoye en IAs para que me ayudaran a distribuir el tiempo a la vez de decirme tareas que pase por alto.

### Viernes 16 — Arquitectura y primera Lambda (2 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| INF-01 | Definir arquitectura, entidades, flujo y estados | 0,5 h | — | Diagrama y decisiones documentadas |
| DOC-01 | Crear repositorio privado, `PLANNING.md`, estructura inicial | 0,5 h | INF-01 | Primer commit |
| INF-02 | Configurar AWS CLI, SAM, roles mínimos, créditos y presupuesto | 0,5 h | Cuenta AWS | Acceso validado, presupuesto/alerta creada |
| INF-03 | Desplegar Lambda «health» mediante SAM | 0,5 h | INF-02 | Endpoint de prueba invocable |

**Hito D1:** `PLANNING.md` versionado y primera función accesible. **Corte:** si la cuenta no permite desplegar, resolver acceso antes de avanzar con servicios.

### Sábado 17 — Persistencia y servicios base (5,5 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| CORE-01 | Workspace TypeScript, scripts, tipos compartidos y validación | 0,75 h | INF-01 | Build y lint básicos |
| DB-01 | Tabla DynamoDB, claves/índices y seeds idempotentes | 1,0 h | INF-02, CORE-01 | Diez ingredientes con stock 5; seis recetas |
| INV-01 | Servicio de consulta y operaciones atómicas de inventario | 1,25 h | DB-01 | Consultas y condición de stock |
| REC-01 | Servicio de recetas y selección aleatoria persistible | 0,75 h | DB-01 | `GET /recipes`, seis recetas |
| ORD-01 | `POST /orders`, ítems, consultas y validaciones | 1,0 h | DB-01 | Pedido de X platos registrado |
| QA-01 | Tests básicos y commit de hito | 0,75 h | INV-01, REC-01, ORD-01 | Tests ejecutables localmente |

**Hito D2:** pedidos, recetas e inventario consultables; aún no se considera terminado el flujo. **Corte:** el domingo empieza con persistencia funcional.

### Domingo 18 — Integración completa (10 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| PRE-01 | SQS, DLQ y worker de preparación | 1,25 h | ORD-01, INF-03 | Pedido produce trabajo asíncrono |
| PRE-02 | Asignar/persistir receta por ítem | 0,75 h | PRE-01, REC-01 | Reintento mantiene receta |
| INV-02 | Consumo transaccional de ingredientes y estado | 1,5 h | INV-01, PRE-02 | No hay stock negativo ni doble consumo |
| BUY-01 | Adaptador mercado, validaciones e historial | 1,25 h | DB-01 | Compra real integrada, estados registrados |
| BUY-02 | `quantitySold=0`, timeouts y reintentos acotados | 1,0 h | BUY-01 | Estado recuperable sin falsa entrega |
| PRE-03 | Integrar compra → stock → consumo → entrega | 1,25 h | INV-02, BUY-02 | Flujo extremo a extremo funcionando |
| QA-02 | Casos de concurrencia e idempotencia | 1,0 h | PRE-03 | Pruebas de ítems duplicados y stock |
| WEB-01 | React: pantalla inicial, formulario y consultas | 1,0 h | ORD-01, REC-01 | Interfaz funcional básica |
| DEP-01 | Despliegue integrado de una versión inicial | 1,0 h | PRE-03, WEB-01 | URL de prueba con flujo completo |

**Hito D3 (CRÍTICO):** solicitar diez platos desde la aplicación, abastecer faltantes y observar estados hasta entrega o espera/fallo correctamente explicados. No iniciar bonus IA antes de este hito.

### Lunes 19 — Endurecimiento y conexión UI (3,5 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| WEB-02 | Integrar dashboard con pedidos, recetas e inventario | 1,0 h | WEB-01, DEP-01 | Vistas consumen API real |
| WEB-03 | Historias de compras y estados de preparación | 0,75 h | BUY-01, PRE-03 | Historiales visibles |
| PRE-04 | Asegurar recuperación, DLQ y prevención duplicados | 0,75 h | QA-02 | Fallos y reintentos controlados |
| QA-03 | Simular pedidos concurrentes 10–50 y corregir | 1,0 h | PRE-04 | Evidencia en logs/tests |

**Hito D4:** dashboard de operaciones conectado y flujo robusto en las pruebas realizadas.

### Martes 20 — UX mínima y publicación pública (2 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| WEB-04 | Polling 3–5 s, errores y estado de carga | 1,0 h | WEB-03 | La UI refleja evolución de pedidos |
| DEP-02 | Frontend HTTPS, CORS, accesibilidad pública y smoke test | 1,0 h | WEB-04 | URL final accesible fuera de cuenta AWS |

**Hito D5:** la app puede probarse públicamente desde un navegador limpio.

### Miércoles 21 — Pruebas y documentación (2 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| QA-04 | Regresión, fallos externos y reinicios | 0,75 h | DEP-02 | Resultado registrado en `docs/TESTING.md` |
| DOC-02 | README, contratos API, arquitectura y decisiones | 0,75 h | QA-04 | Repositorio comprensible/reproducible |
| QA-05 | Prueba con usuario no técnico | 0,5 h | DEP-02 | Ajustes críticos de usabilidad |

**Hito D6:** documentación y verificación final de requisitos obligatorios.

### Jueves 22 — Entrega y contingencia (2 h)

| ID | Tarea | Tiempo | Depende de | Entregable verificable |
|---|---|---:|---|---|
| QA-06 | Smoke tests en URL pública | 0,5 h | DEP-02 | Solicitud y consulta correctas |
| OPS-01 | Revisar costos, logs, permisos, secretos y recursos | 0,5 h | INF-02 | Control de riesgo de costos y seguridad |
| DOC-03 | Verificar URLs y colaborador `scouting@alegra.com` | 0,333 h | DOC-02 | Permisos y links correctos |
| SUB-01 | Enviar formulario oficial y guardar confirmación | 0,333 h | QA-06, DOC-03 | Evidencia de envío |
| BUF-01 | Reserva para incidentes de última hora | 0,334 h | — | Margen de contingencia |

**Hito D7:** entrega confirmada mediante el formulario del correo inicial, idealmente antes del cierre del día. Horario exacto del formulario: **pendiente de confirmar**.

## 7. Backlog priorizado y criterios de terminación

**P0 — imprescindible**

- [ ] Infraestructura AWS SAM y despliegue de APIs.
- [ ] Seis recetas válidas y diez ingredientes con cinco unidades al inicio.
- [ ] Pedido de `X` platos con validación, estado persistente y consulta.
- [ ] Cola asíncrona y procesamiento de pedidos sin intervención humana.
- [ ] Consulta y consumo seguro de ingredientes.
- [ ] Mercado integrado; compras e historial persistentes; `quantitySold=0` manejado.
- [ ] No entregar sin consumo válido; impedir descuento duplicado.
- [ ] Frontend React con todas las vistas solicitadas.
- [ ] URL pública y documentación de instalación/despliegue.
- [ ] Repositorio privado y colaborador requerido.

**P1 — robustez y mantenibilidad**

- [ ] Reintentos controlados, recuperación de pendientes y DLQ.
- [ ] Pruebas de concurrencia, idempotencia y errores externos.
- [ ] Paginación/acotación de consultas, logs y controles de costos.
- [ ] Mejoras de usabilidad y diseño responsivo.

Tambien voy a definir de una vez pruebas para hacer tan pronto el codigo este terminado en su totalidad, esto con el fin de ver que no se me haya escapado ningun caso.

## 8. Plan de pruebas y aceptación

| Caso | Acción | Criterio de aceptación | Prioridad |
|---|---|---|---|
| T01 | Crear 1 plato | Pedido e ítem persistidos; procesamiento empieza sin bloquear HTTP | P0 |
| T02 | Crear 10 platos | Exactamente diez ítems; asignaciones de las seis recetas permitidas | P0 |
| T03 | Consultar stock nuevo | Diez ingredientes con 5 unidades cada uno | P0 |
| T04 | Consumir plato con stock | Descuento exacto de ingredientes y estado `DELIVERED` | P0 |
| T05 | Faltan ingredientes | Solicita compra al mercado y usa solo `quantitySold` confirmado | P0 |
| T06 | Mercado devuelve 0 | Ítem no entregado; `WAITING_INGREDIENTS` y política de reintento | P0 |
| T07 | Dos ítems compiten por stock | Ningún ingrediente negativo; resultado consistente | P0 |
| T08 | Reprocesar mismo mensaje | No hay doble descuento ni entrega | P0 |
| T09 | Reiniciar/redeploy worker | Persisten estados, compras e inventario | P0 |
| T10 | API devuelve error / timeout | No se inventan ventas; fallo observable y reintento limitado | P1 |
| T11 | Crear 50–100 ítems | Se encolan y procesan sin perder/duplicar ítems; medir duración y errores | P1 |
| T12 | Abrir URL sin sesión AWS | Se pueden solicitar pedidos y ver todas las listas | P0 |
| T13 | Dos POST concurrentes | Se registran ambos pedidos; solicitud repetida bajo clave idempotente no duplica | P1 |
| T14 | Verificar costos y permisos | Presupuesto activo; ninguna credencial en repositorio o frontend | P0 |

Por ultimo, esto es lo que debe estar listo para el día de entrega.

## 12. Entregables y checklist de envío

- [ ] URL pública de la aplicación React con flujo funcional.
- [ ] URL del repositorio privado en GitHub.
- [ ] `scouting@alegra.com` invitado como colaborador (verificar invitación/acceso).
- [ ] `PLANNING.md` y `README.md` completos.
- [ ] `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/TESTING.md` según avance.
- [ ] Pruebas mínimas P0 ejecutadas y limitaciones explícitas.
- [ ] Confirmar fecha/hora exacta límite en correo de convocatoria.
- [ ] Enviar **exclusivamente por el formulario del correo inicial** y conservar confirmación.
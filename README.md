# Lukas 💸

Finanzas del día a día, sin enredos. App web instalable (PWA) pensada para el celular.
Los datos viven solo en el dispositivo: no hay cuentas, servidores ni sincronización.

## Qué hace

- **Hoy**: saldo libre hasta el próximo pago, comparación con el mes anterior, proyección al día de pago, pendientes del mes con recordatorios, resumen de presupuestos, tarjetas, metas y últimos movimientos.
- **Registrar**: modo *Rápido* (monto + categoría, sin internet) o *Con IA* (lenguaje natural con Gemini).
- **Pagos**: cuotas, deudas y pagos fijos. Se marcan como pagados y se pueden deshacer. Cada uno tiene su recordatorio.
- **Tarjetas**: cupo, factura y días para el pago. Cuentas con saldo real.
- **Historial**, **Metas**, **Presupuestos** y **Ajustes** a un toque desde Hoy.

## Cómo se comporta cada cosa

### Presupuestos por categoría

- Un límite mensual por categoría de gasto. Se crean, editan y quitan en *Presupuestos* (desde Hoy o Ajustes).
- No se guarda ningún acumulado: el gasto de cada categoría se calcula cada vez con los movimientos de tipo **gasto** del mes en curso. Por eso los ingresos nunca cuentan, y editar el monto, eliminar un movimiento o cambiarlo de categoría o de mes se refleja al instante.
- Aviso «cerca del límite» desde el 80 % y «límite superado» al pasarlo.

### Resumen de Hoy

- **Comparación**: ingresos y gastos de este mes hasta hoy frente al mes anterior hasta el mismo día. Si el mes anterior no tiene movimientos, se dice así y no se muestra ningún porcentaje.
- **Proyección al día de pago**: `saldo libre de hoy − (gasto diario promedio × días que faltan)`. El promedio usa los gastos de los últimos 14 días, sin los generados al marcar pagos fijos (esos ya se descuentan como pendientes). Solo se muestra si hay ingreso registrado en el mes, al menos 7 días de historial de gastos y 3 gastos en la ventana; si no, aparece un mensaje que explica qué falta.

### Pagos: marcar y deshacer

- **Pago fijo**: «Pagar» crea el gasto del mes y lo descuenta de la cuenta o tarjeta elegida. «Deshacer» borra ese gasto, devuelve lo descontado y lo deja pendiente otra vez. Los pagos marcados antes de la 2.2 no descontaban, así que al deshacerlos no se devuelve nada.
- **Cuota**: «Pagar» suma una cuota, guarda el pago y avanza la fecha un mes. «Deshacer el último pago» devuelve cuotas, fecha e historial exactamente a como estaban.
- **Deuda**: «Marcar saldada» y «Dejar pendiente».
- Los pagos marcados con versiones anteriores a la 2.1 no tienen bitácora y no ofrecen «Deshacer».

### Recordatorios

- Para cuotas, deudas con fecha límite y pagos fijos. Anticipación general en Ajustes y propia por registro (campana). Se pueden silenciar y posponer (mañana, 3 días, 1 semana).
- **Dentro de la app** (siempre disponible): la pantalla Hoy resalta lo que está por vencer.
- **Notificaciones del sistema** (opcionales): el permiso se pide solo cuando la persona activa el interruptor en Ajustes.
- **Limitación**: Lukas no tiene servidor, así que no puede notificar con la app cerrada. La notificación se muestra al abrir la app o al volver a ella, una vez al día por grupo de pendientes. Si el navegador no permite notificaciones o el permiso está bloqueado, quedan los avisos dentro de la app.

### Editar, eliminar y deshacer

- Todo registro se puede editar. Antes de eliminar se muestra qué registro es; después queda un aviso con «Deshacer» que lo restaura idéntico (con su historial de pagos y recordatorio, si los tenía).
- Totales, presupuestos e historial se recalculan solos tras cualquier cambio.
- **Saldos de cuentas y tarjetas**: un movimiento mueve el saldo de la cuenta o tarjeta que se llama igual que su método de pago, sin importar mayúsculas, tildes ni espacios («SOBRE ALIMENTACIÓN» = «sobre alimentacion»). Un gasto baja el saldo de la cuenta y sube la deuda de la tarjeta; un ingreso, al revés.
  - El método se elige con botones (cuentas, tarjetas y Efectivo) o en «Otro». Debajo se ve qué saldo se mueve; si el nombre no corresponde a ninguna cuenta ni tarjeta, se avisa que no se moverá ningún saldo.
  - Se ajustan al *crear* un movimiento (Registrar rápido, Con IA) y al *pagar* un pago fijo. Lukas anota cuánto movió cada movimiento (tabla `balance_moves`), así «Deshacer» devuelve exactamente eso.
  - **Editar**: si cambia el monto, el tipo o el método de pago, Lukas muestra el ajuste neto («Devolver $60.000 a Sobre», «Descontar $60.000 de Nequi») y pregunta: «Ajustar saldos y guardar» o «Solo guardar el cambio». En movimientos registrados antes de la 2.2 avisa que no sabe si ya se había descontado.
  - **Eliminar** no recalcula saldos (pueden haberse ajustado a mano); el diálogo de eliminación lo avisa.

### Moneda y montos

- Los importes se guardan como números simples, sin moneda. La preferencia de moneda (COP por defecto, más USD, EUR, MXN, PEN, CLP, ARS) cambia símbolo, separadores y si se aceptan centavos; **no convierte ni altera** lo guardado.
- Al escribir se aceptan miles con punto o coma en grupos de tres (`12.000`, `1,234,567`). En monedas sin centavos se rechaza `12,5` o `12.5` (antes se leían como 125). Se rechazan negativos, letras y cero.
- El CSV del historial exporta el monto plano (punto decimal, sin miles) y una columna «Moneda».

### Modo «Con IA» y privacidad

- Usa Google Gemini con la API Key de la persona. La clave se guarda solo en el dispositivo, viaja únicamente a Google en una cabecera, no se muestra en pantalla ni en errores y no se incluye en los respaldos.
- **Siempre se envía**: el texto escrito, la fecha, la lista de categorías y la moneda.
- **Solo al hacer una pregunta sobre las finanzas** (y si está activo «Usar mis datos para responder preguntas»): un resumen con totales del mes, saldos de cuentas, deudas, cuotas, pagos fijos, metas y tarjetas (sin números de tarjeta). Para registrar gastos no se envía ningún dato financiero.
- **Nunca se envía** el historial completo de movimientos.

## Datos, migraciones y respaldos

- Base SQLite (sql.js) guardada en IndexedDB.
- **Migraciones** (`src/lib/db/schema.ts`): versión de esquema en `PRAGMA user_version`. Las tablas originales no se alteran; lo nuevo va en tablas nuevas (`payment_log`, `reminders` en v2; `balance_moves` en v3). Antes de migrar una base con datos se guarda una copia en IndexedDB (`copia-antes-de-migrar-v<n>.db`).
- **Respaldo**: Ajustes → Exportar. Incluye movimientos, pagos, tarjetas, cuentas, metas, presupuestos, recordatorios, bitácora de pagos, ajustes de saldo por movimiento y preferencias (moneda, días de pago, recordatorios). No incluye la API Key.
- **Importar**: se valida el archivo completo antes de tocar nada, se muestra qué trae y qué reemplaza, y solo se importa tras confirmar. Si algo falla, los datos actuales quedan intactos. Se aceptan los respaldos del Lukas anterior; los respaldos nuevos siguen siendo legibles por el Lukas anterior (que ignora las secciones que no conoce).

### Migrar desde el Lukas anterior

En el Lukas viejo: Ajustes → Respaldo de datos → **Exportar**. En el nuevo, elige **Importar respaldo de Lukas** al abrirlo por primera vez (o Ajustes → Importar).

## Instalar en el celular

1. Abre la dirección de la app en Chrome.
2. Menú ⋮ → **Agregar a pantalla de inicio** (o *Instalar app*).

## Desarrollo

```bash
npm install
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

- `npm test` corre las pruebas (Vitest, en Node): montos y moneda, fechas, presupuestos, comparación y proyección, recordatorios, validación de respaldos, privacidad de la IA y la capa de datos completa sobre SQLite (migración, pagar y deshacer, eliminar y restaurar, importar y exportar).
- `npm run build` verifica tipos y genera `dist/`.
- El workflow de GitHub Actions corre pruebas y build y publica en GitHub Pages con cada push a `main`.

### Estructura

- `src/lib/` lógica pura (`money`, `dates`, `budgets`, `insights`, `reminders`, `backupFormat`, `prefs`) y `src/lib/db/` (esquema, servicio SQL, arranque en navegador).
- `src/hooks/` lectura de datos; todas las pantallas se refrescan solas cuando la base cambia.
- `src/components/ui/` piezas compartidas y accesibles: `Field` (etiquetas asociadas), `Modal` (foco y Escape), `Feedback` (confirmaciones y avisos con «Deshacer»), `Switch`.

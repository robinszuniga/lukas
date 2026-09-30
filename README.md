# Lukas 💸

Finanzas del día a día, sin enredos. App web instalable (PWA) pensada para el celular.

## Qué hace

- **Hoy**: cuánto te queda libre hasta tu próximo pago, pendientes del mes con botón *Pagar*, tarjetas por vencer, metas y últimos movimientos.
- **Registrar**: modo *Rápido* (monto + categoría, sin internet) o *Con IA* (escribe en lenguaje natural con Gemini).
- **Pagos**: cuotas, deudas y pagos fijos.
- **Tarjetas**: cupo, factura y días para el pago. Cuentas con saldo real.
- Historial, metas y ajustes a un toque desde Hoy.

Los datos viven solo en el celular (SQLite en el navegador). Exporta un respaldo desde Ajustes de vez en cuando.

## Instalar en el celular

1. Abre la dirección de la app en Chrome.
2. Menú ⋮ → **Agregar a pantalla de inicio** (o *Instalar app*).
3. Ábrela desde el ícono como cualquier app.

## Migrar desde el Lukas anterior

En el Lukas viejo: Ajustes → Respaldo de datos → **Exportar**. Guarda el archivo y en el nuevo elige **Importar respaldo de Lukas** al abrirlo por primera vez (o Ajustes → Importar).

Vuelve a poner los días de pago y la API Key de Gemini, que no viajan en el respaldo.

## Desarrollo

```bash
npm install
npm run dev
```

`npm run build` genera `dist/`. El workflow de GitHub Actions publica en GitHub Pages con cada push a `main`.

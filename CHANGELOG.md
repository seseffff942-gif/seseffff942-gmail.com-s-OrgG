# Registro de cambios

Todo lo que se modificó respecto al sistema original, con su motivo.
El commit `d7d1e3e` es el **estado original intacto**; se puede volver a él en
cualquier momento con `git checkout d7d1e3e`.

Para desplegar estos cambios a producción, sigue [DESPLIEGUE.md](DESPLIEGUE.md).

---

## Seguridad

### `dotenv` nunca se cargaba — *(riesgo crítico)*

`server.ts` leía `process.env.SUPABASE_URL` pero **nunca importaba `dotenv`**.
Las variables del archivo `.env` jamás llegaban al servidor, así que la
aplicación siempre terminaba usando las credenciales escritas en el código.

En la práctica esto significaba que **trabajar en local golpeaba la base de datos
de producción**, sin ningún aviso. Y como al arrancar se ejecuta `seedDatabase()`,
que hace `DELETE` de productos, arrancar el proyecto en local podía **borrar
datos reales**.

**Cambio:** se agregó `import "dotenv/config"` como primera importación.

### Credenciales de producción eliminadas del código

La URL y la llave de Supabase de producción estaban escritas como valor de
respaldo en `server.ts`, y también en `.env.example` (que sí se versiona).

**Cambio:** se eliminaron. Ahora las credenciales solo vienen de variables de
entorno.

> ⚠️ **Pendiente:** esa llave debe considerarse comprometida y **rotarse en
> Supabase**.

### El servidor ahora falla al arrancar si faltan variables

Antes, si faltaba una variable, el sistema seguía funcionando con los valores de
respaldo — conectándose a producción en silencio. El `JWT_SECRET` tenía además un
valor por defecto público (`"default_stable_secret_for_agricovet_dev"`), con el
que cualquiera podía firmar tokens y hacerse pasar por administrador.

**Cambio:** se agregó `requireEnv()`. Si falta `JWT_SECRET`, `SUPABASE_URL` o
`SUPABASE_ANON_KEY`, el proceso termina con un mensaje claro.

*Es preferible que truene ruidosamente a que escriba en la base equivocada.*

**Impacto en el despliegue:** hay que configurar esas variables en Vercel
**antes** de subir el código. Ver [DESPLIEGUE.md](DESPLIEGUE.md).

### 13 scripts con credenciales de producción, archivados

En la raíz del proyecto había scripts sueltos (`test3.js`, `check_db.js`,
`delete-offers.js`, `neg_stock.js`, …) con la URL y la llave de producción
escritas dentro. Varios son **destructivos**: ejecutar `delete-offers.js` por
accidente borraba datos reales.

**Cambio:** se movieron a `scripts-archivo/` y se les quitaron las credenciales.

---

## Correcciones

### El catálogo de productos no se cargaba — *(bug)*

El producto **"foranex 25.7"** usaba el mismo `id` (`p136`) que **"Incubadora Pro
50 Huevos"**. Como los productos se insertan en un solo lote, PostgreSQL
rechazaba **el bloque completo**: la tabla quedaba con **0 de 136 productos**.

**Cambio:** "foranex 25.7" se reasignó a `p139`. Verificado: cargan los 136.

> 🔎 **Revisar en producción:** es posible que "foranex 25.7" nunca se haya
> cargado en la base real. Conviene confirmarlo.

### Bucle infinito de peticiones de imágenes — *(bug crítico, también en producción)*

En **Ventas** e **Inventario**, los productos sin imagen provocaban una descarga
infinita: se midieron **1,738 peticiones y 1,008 MB transferidos** en una sola
sesión.

**Causa raíz — dos fallas combinadas:**

1. **Los archivos de respaldo estaban corruptos.** `public/box.png` y
   `public/bottle.png` no eran PNG sino JPEG, y estaban dañados: contenían
   ~200,000 bytes `EF BF BD` (el carácter Unicode de reemplazo `�`), la firma
   inconfundible de un **binario copiado como texto UTF-8**. Eso destruyó la
   imagen e infló su peso a 816 KB y 868 KB. El navegador no podía decodificarlas,
   así que **el propio respaldo disparaba `onError`**.

2. **El `onError` peleaba contra React.** El código hacía
   `e.currentTarget.src = respaldo`, una mutación directa del DOM. Pero `src`
   era una prop controlada. Como Ventas refresca cada 10 s e Inventario cada
   15 s, **cada re-render devolvía `src` a la URL rota**, reiniciando el ciclo.
   El `onerror = null` no ayudaba: React reinstala el handler en cada render.

Resultado: ~136 productos x ~850 KB por cada ciclo de refresco.

**Solución:** nuevo componente `src/components/ProductImage.tsx`.

- El fallo se guarda en **estado de React**, no mutando el DOM.
- Las URLs que fallaron se recuerdan **a nivel de módulo**, así ni los
  re-renders ni los remontajes vuelven a pedirlas.
- Los marcadores de "sin imagen" son ahora **SVG embebidos (data URI)**: no
  hacen petición de red, **no pueden dar 404 y por tanto no pueden entrar en
  bucle**. Pesan ~600 bytes en lugar de 850 KB.

**Otros archivos corruptos encontrados y corregidos:**

| Archivo | Problema | Acción |
|---|---|---|
| `public/agricovet.png` | Corrupto (77 bytes). **Ícono de la PWA y de las notificaciones push** — estaban rotos. | Regenerado, PNG válido 512x512 |
| `public/logo.png.png` | Corrupto | Regenerado, PNG válido 512x512 |
| `public/box.png`, `public/bottle.png` | Corruptos, 1.68 MB | Eliminados (ya no se usan) |
| `dummy.jpg` | Vacío, sin referencias | Eliminado |
| `vite.config.ts` | Precacheaba archivos ya inexistentes (podía romper el service worker) | Corregido |

**Respaldos externos eliminados:** 5 usos de `via.placeholder.com` (en Login,
Navigation y HomePage) se sustituyeron por un logo SVG local. Eran una
dependencia de terceros y podían provocar el mismo bucle si el servicio no
respondía.

> 💡 **Efecto en costos:** este bug era un generador silencioso de gasto en
> Vercel y Supabase. Eliminarlo reduce el ancho de banda de forma sustancial,
> además de acelerar la aplicación.


---

## Factura Electrónica (FEL)

### Regla de IVA confirmada con el cliente

**Los precios del sistema ya incluyen el 12% de IVA.** Un producto de Q50.00 se
le sigue cobrando al cliente en Q50.00; FEL solo exige declararlo descompuesto:

| Concepto | Monto |
|---|---|
| Gran total (lo que paga el cliente) | Q50.000000 |
| Monto gravable (base sin IVA) | Q44.642857 |
| Monto del IVA | Q 5.357143 |

**Consecuencia:** ningún precio cambia. La facturación actual y la facturación
FEL producen el mismo total. Esto elimina el mayor riesgo comercial del proyecto.

### Tablas FEL (`migrations/002_fel.sql`)

Tres tablas nuevas, **sin tocar ninguna existente**:

- **`fel_config`** — datos fiscales del emisor y credenciales de INFILE.
  Reemplaza el patrón de guardar configuración en archivos JSON, que en Vercel
  no persiste.
- **`fel_documentos`** — un registro por DTE: estado, número de autorización
  (UUID), serie, montos y los XML enviado y certificado (obligatorios para
  auditorías de SAT).
- **`fel_bitacora`** — registro de cada llamada a INFILE, para diagnosticar
  rechazos sin reproducir el problema.

Incluye un índice único que **impide certificar dos veces la misma factura**
(protege contra dobles clics y reintentos).

### Cálculos fiscales (`fel/calculos.ts`)

Implementa el desglose del IVA respetando esta invariante:

```
montoGravable + montoIva === granTotal    (exacto, sin centavos perdidos)
```

Se logra calculando la base y derivando el IVA **por resta**, nunca por separado
—ese error produce descuadres de un centavo que SAT rechaza.

Probado con `npm run test:fel`: montos con centavos (Q0.01, Q33.33, Q99.99),
facturas de 50 líneas y descuentos. Todas las pruebas pasan.

---

## Infraestructura

- **Control de versiones:** el proyecto no tenía Git. Se inicializó **solo en
  local, sin repositorio remoto** — nada se despliega hasta que se conecte
  explícitamente.
- **Ambiente de desarrollo aislado:** base de datos Supabase separada
  (`vkrpvvqvtyyqqstyuchc`), con las 8 tablas, índices y bucket de imágenes.
- **`setup_dev_db.sql`:** script para recrear la base de desarrollo desde cero.
  *No debe ejecutarse en producción.*

---

## Pendientes

| Tarea | Bloqueado por |
|---|---|
| Generación del XML del DTE | Los XML de ejemplo del sistema anterior |
| Integración con la API de INFILE | Credenciales de pruebas |
| Definir si las ventas al crédito usan FACT o **FCAM** | Decisión del cliente |
| Políticas RLS en producción | — |
| Rotar la llave de Supabase comprometida | — |
| Optimización de costos (pausar polling) | — |

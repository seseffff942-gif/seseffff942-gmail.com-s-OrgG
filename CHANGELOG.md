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


### La firma digital fallaba al guardar — *(bug)*

Al pulsar guardar en el pad de firma, la consola lanzaba
`(0, import_trim_canvas.default) is not a function` y la firma se perdía.

**Causa:** `react-signature-canvas` usa internamente el paquete `trim-canvas`,
que **solo se publica en formato CommonJS** (no trae build para módulos ES).
Vite no puede resolver su export por defecto, así que `getTrimmedCanvas()`
revienta en tiempo de ejecución.

**Solución:** se dejó de usar `getTrimmedCanvas()`. Ahora el recorte se hace
con una función propia de ~25 líneas en `SignaturePad.tsx`, que localiza el
área realmente dibujada por el canal alfa y recorta con un pequeño margen. Si
el recorte fallara por cualquier motivo, se guarda la firma completa: es
preferible a perder lo que el usuario acaba de trazar.

Verificado en el navegador: recorta al área correcta (400x200 → 110x80 para un
trazo conocido), un lienzo vacío devuelve el original sin romper, un trazo
pegado al borde no produce dimensiones negativas, y el PNG resultante es válido.

### Los clientes no se guardaban — *(bug)*

Al crear un cliente aparecía una cascada de errores en el servidor:

```
Primary Supabase client insert failed: no existe la columna 'sellerId'
Casing fallback failed: no existe la columna 'company_name'
Client pruned insert failed: no existe la columna 'created_at'
Bare client backup insert failed: clave duplicada
```

**Causa:** la tabla `clients` no tenía la columna `sellerId` que el servidor
intenta escribir. El código tiene una cascada defensiva de reintentos
(`safeInsertClient`) que va podando columnas, así que el fallo terminaba en un
guardado incompleto — **y consumía hasta 4 viajes a la base por cada cliente.**

**Solución:** migración `003_clients_columnas.sql`, que agrega `sellerId`,
`companyName` y `createdAt` si faltan. Con eso el primer insert funciona y los
reintentos dejan de ejecutarse.

> 🔎 **Revisar en producción:** si la base real también carece de esas columnas,
> está pagando esos 3 viajes extra en cada alta de cliente y probablemente
> guardando clientes sin vendedor asignado. La migración es aditiva y segura.


### El NIT no aparecía en el panel FEL — *(bug)*

El panel avisaba "La factura no tiene NIT del receptor" incluso en facturas
creadas con NIT.

**Causa:** el sistema **no guarda el NIT en la columna `nit`** de la tabla
`invoices`. Al crear la factura, `server.ts` lo escribe al inicio del campo
`notes`, antes de las etiquetas `|||`:

```
"1234567-8|||OBS:entregar manana|||TYPE:veterinaria|||CREDIT:30"
```

Al leer facturas por la API, `server.ts` lo extrae de ahí con unas heurísticas
(descarta el texto si mide más de 25 caracteres o parece una nota de entrega).
Pero el servicio FEL lee la fila **cruda** de la base, sin pasar por ese mapeo,
así que veía la columna `nit` vacía.

**Solución:** `extraerNit()` en `fel/servicio.ts` replica esas mismas reglas.
El panel ahora muestra el NIT del receptor, y solo advierte cuando realmente
no hay ninguno. "CF" (consumidor final) se reconoce como valor válido y no
genera advertencia.

Probado: NIT con y sin guion, CF explícito, factura sin NIT, observación larga
mal ubicada (no debe confundirse con un NIT) y prioridad de la columna `nit`
cuando sí trae valor.

> ⚠️ **Deuda técnica anotada:** esta lógica de parseo queda duplicada entre
> `server.ts` y `fel/servicio.ts`. Conviene unificarla al modularizar el
> servidor; mientras tanto, cualquier cambio en el formato de `notes` hay que
> aplicarlo en ambos lugares.
>
> De fondo, guardar datos estructurados (NIT, tipo, días de crédito, firma)
> concatenados dentro de un campo de texto es frágil: si un cliente escribe
> `|||` en una observación, rompe el parseo. Convendría migrarlos a columnas
> propias más adelante.


### El NIT nunca se guardaba en su columna — *(bug)*

La tabla `invoices` **sí tiene** la columna `nit`, pero ninguna de las tres
rutas de inserción la incluía:

| Intento | Columnas que enviaba | ¿`nit`? |
|---|---|---|
| Primario | `clientName`, `customerPhone`, `deliveryAddress`… | No |
| Respaldo 1 | cambia a `client`, `phone`, `address` | No |
| Respaldo 2 | mínimo | No |

Por eso `phone` y `address` sí se guardaban y el NIT no: no era un problema de
esquema, era una omisión. El NIT solo sobrevivía incrustado dentro de `notes`.

**Solución:** se agregó `nit` al objeto que se inserta. Se mantiene además el
prefijo dentro de `notes` por compatibilidad con las facturas históricas y con
las plantillas de impresión que lo leen de ahí. El respaldo mínimo descarta la
columna igual que las demás, por si alguna base no la tuviera.

Verificado creando una venta por el endpoint real: el NIT queda en su columna,
la lectura por la API lo devuelve correctamente y las observaciones no se
pierden.


### Optimización de polling — palanca #1 de costos aplicada

Las pantallas dejaban de consumir servidor solo cuando se cerraban; ahora se
pausan cuando **nadie está mirando** y se refrescan al instante al volver:

| Pantalla | Antes | Ahora |
|---|---|---|
| Ventas | cada 10 s, siempre | cada 30 s, solo pestaña visible + refresco al volver |
| Inventario | cada 15 s, siempre | cada 30 s, solo pestaña visible + refresco al volver |
| Notificaciones | cada 45 s, siempre | cada 45 s, solo pestaña visible + refresco al volver |
| Ventas diarias | cada 120 s, siempre | cada 120 s, solo pestaña visible |

**Efecto:** una pestaña abierta en Ventas pasaba de ~360 peticiones/hora a ~120
cuando está visible y **0 cuando está en segundo plano**. La experiencia no
cambia: al volver a la pestaña los datos se actualizan de inmediato.

### La anulación FEL no anulaba la factura — *(inconsistencia)*

Al anular un DTE ante SAT, la factura del sistema seguía como
pendiente/pagada, con su stock descontado y ofreciendo volver a anularla.

**Solución:** cuando SAT acepta la anulación, la factura pasa a `cancelled`
**reutilizando la misma lógica de anulación normal** — incluida la
restauración de stock (se extrajo a `restaurarStockDeFactura()` para no
duplicarla). Facturación se refresca al cerrar el panel FEL.

Verificado de punta a punta: venta de 4 unidades (stock 95→91) → certificada →
anulada ante SAT → factura `cancelled` y stock de vuelta en 95.

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


### Integración real con INFILE implementada

Con base en la implementación de referencia del cliente (sistema NestJS ya en
producción con INFILE), se completó la integración:

- **`fel/xml.ts`** — genera el `GTDocumento` completo. Mejoras sobre la
  referencia: **todos los valores se escapan** (un cliente llamado "Agro & Vet"
  rompía el XML de la referencia) y los montos salen de `fel/calculos.ts`
  (cuadre garantizado). La fecha de emisión se calcula explícitamente en hora
  de Guatemala (UTC-6): el servidor corre en UTC y usar su hora local emitiría
  documentos 6 horas en el futuro.
- **Factura cambiaria (FCAM) con complemento de abonos** — es el tipo por
  defecto (confirmado con el cliente). Un abono por el total, con vencimiento
  = fecha de la factura + días de crédito (etiqueta `|||CREDIT:` de `notes`).
- **`fel/infile.ts`** — llamada real al certificador: cabeceras `UsuarioFirma`,
  `LlaveFirma`, `UsuarioApi`, `LlaveApi`, `identificador`; respuesta JSON con
  `resultado`, `uuid`, `serie`, `numero`, `descripcion_errores`. Timeout de 30 s.
- **Todo lo enviado y todo lo respondido queda guardado** (pedido explícito):
  `xml_enviado` (incluso si la certificación queda pendiente), `xml_certificado`,
  `respuesta_certificador` (JSON crudo) en `fel_documentos`, y la respuesta de
  cada intento en `fel_bitacora`.
- La URL del certificador y las credenciales viven en `fel_config`
  (migración `004_fel_infile.sql`) — nunca en el código.

Verificado: XML bien formado (xmllint), escape correcto, complemento FCAM con
vencimiento a +60 días, y persistencia del XML aun sin credenciales.


### ✅ Primera certificación real exitosa (ambiente de pruebas, 22/07/2026)

Con las credenciales de pruebas de INFILE cargadas en `fel_config`, se
certificaron dos documentos reales contra el certificador:

| Prueba | Resultado |
|---|---|
| FCAM contado, receptor CF (Q100) | UUID `B0E4DD7C-…`, serie `**PRUEBAS**` |
| FCAM a crédito 30 días (Q1,100) | UUID `E5C976F7-…`, vencimiento del abono correcto |
| Reintento sobre factura certificada | Bloqueado: «ya estaba certificada» |
| Persistencia | `xml_enviado`, `xml_certificado` (XML firmado, ~19 KB), respuesta JSON completa y bitácora con duración |

Datos operativos confirmados por la ficha de INFILE: establecimiento de
Agricovet = **2**, frases Tipo 1 / Escenario 1, usuario API = usuario firma.


### Ciclo fiscal completo: anulación, consulta de NIT y pantalla de configuración

- **Anulación de DTE** (`anularFactura` + `POST /api/invoices/:id/fel/anular`):
  exige motivo, solo administradores y solo documentos certificados. Si el
  certificador rechaza la anulación, el documento **sigue certificado** (falla
  el trámite, no el documento). Probada en vivo en el sandbox: DTE
  `B0E4DD7C-…` anulado, y el reintento devuelve «ya estaba anulado».
- **Consulta de NIT** (`GET /api/fel/consulta-nit/:nit`): usa el servicio de
  consulta de receptores de INFILE para validar el NIT y obtener el nombre
  registrado en SAT antes de facturar. Probada en vivo (resuelve nombres
  reales; los NIT inexistentes devuelven «NIT no válido»). Disponible desde el
  panel FEL con el botón «Verificar en SAT».
- **Pantalla de Configuración FEL** (`FelConfigModal`, botón en Facturación,
  solo admins): datos fiscales del emisor, tipo de documento por defecto,
  ambiente (con advertencia fuerte al elegir producción) y credenciales de
  INFILE. Las llaves son de solo escritura: nunca se vuelven a mostrar, y
  dejar el campo vacío conserva la actual.
- **Lote de certificación variado en el sandbox — 6/6 exitosas:** centavos
  difíciles (Q99.99), monto mínimo (Q1.05), 10 líneas (Q680.87), crédito a 60
  días con NIT real (Q2,400), 48 unidades (Q372.96) y mixta a crédito
  (Q127.75). Ningún descuadre de redondeo.

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

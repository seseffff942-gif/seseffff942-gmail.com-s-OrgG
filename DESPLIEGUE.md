# Guía de despliegue a producción

> Documento operativo. Léelo completo **antes** de enviar cualquier cambio al
> repositorio real o a la base de datos de producción.
> Última actualización: 15/07/2026

---

## Resumen: qué hay que hacer y en qué orden

El trabajo hecho en desarrollo se compone de **tres tipos de cambio**, y cada uno
se aplica distinto. **El orden importa.**

| Orden | Tipo de cambio | Dónde se aplica | ¿Riesgo? |
|:---:|---|---|---|
| **1º** | Variables de entorno | Panel de Vercel | ⚠️ **Obligatorio antes de desplegar** |
| **2º** | Base de datos (migración) | Supabase de producción | ✅ Seguro (solo agrega) |
| **3º** | Código | Repositorio → Vercel | ✅ Reversible |

---

## ⚠️ Lo único que puede tumbar producción

El servidor **ya no arranca** si le faltan sus variables de entorno. Antes caía
silenciosamente a unas credenciales escritas en el código; eso se eliminó por
seguridad.

**Consecuencia directa:** si despliegas el código nuevo **sin haber configurado
primero las variables en Vercel, producción se cae.**

No es un defecto: es la protección que evita que el sistema se conecte a una base
de datos equivocada. Pero **obliga a hacer el Paso 1 antes que el Paso 3.**

---

## Paso 1 — Variables de entorno en Vercel

Ve a **Vercel → tu proyecto → Settings → Environment Variables** y confirma que
existan estas tres, en el ambiente *Production*:

| Variable | Valor | Nota |
|---|---|---|
| `JWT_SECRET` | *(generar, ver abajo)* | 🔴 Nueva. Antes no existía. |
| `SUPABASE_URL` | La URL del proyecto de **producción** | Ya debería existir |
| `SUPABASE_ANON_KEY` | La llave del proyecto de **producción** | Ya debería existir |

Para generar un `JWT_SECRET` fuerte:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 🔔 Aviso importante sobre `JWT_SECRET`

Al definir un secreto nuevo, **todas las sesiones activas se invalidan**: todos
los usuarios (vendedores y administradores) tendrán que **volver a iniciar
sesión**. No se pierde ningún dato, solo la sesión.

**Recomendación:** hacerlo fuera de horario de ventas y avisar al equipo antes.

### 🔴 Pendiente de seguridad: rotar la llave de Supabase

La llave de producción anterior estuvo escrita en el código y en archivos del
repositorio, por lo que debe considerarse **comprometida**. Hay que **rotarla en
Supabase** y actualizar el valor en Vercel. Esto es parte del trabajo de
seguridad y conviene hacerlo en el mismo despliegue.

---

## Paso 2 — Migración de la base de datos

En **Supabase de producción → SQL Editor → New query**, pega y ejecuta:

```
migrations/002_fel.sql
```

**Por qué es seguro:**

- Solo ejecuta `CREATE TABLE IF NOT EXISTS` — **no modifica ni borra** ninguna
  tabla existente (`invoices`, `products`, `users`… quedan intactas).
- Es **idempotente**: si lo corres dos veces, no pasa nada.
- Las tablas nuevas (`fel_config`, `fel_documentos`, `fel_bitacora`) empiezan
  vacías y no las usa el sistema actual.

**❌ NO ejecutes `setup_dev_db.sql` en producción.** Ese archivo es solo para
crear una base de desarrollo desde cero. En producción esas tablas ya existen.

**Verificación** (debe devolver 3 filas):

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'fel_%';
```

---

## Paso 3 — Enviar el código

El proyecto local tiene historial de Git con un commit por cada cambio, así que
puedes revisar todo antes de enviarlo.

### Opción A — Conectar el repositorio real (recomendado)

```bash
# Ver qué cambió respecto al estado original
git log --oneline
git diff d7d1e3e HEAD --stat

# Conectar y enviar a una RAMA, nunca directo a main
git remote add origin <URL-de-tu-repositorio>
git fetch origin
git checkout -b fel-y-seguridad
git push origin fel-y-seguridad
```

Luego abre un **Pull Request** en GitHub. Vercel genera un *Preview Deployment*
automático de esa rama: **puedes probar todo sin tocar producción**, y solo
haces merge cuando estés conforme.

> ⚠️ **Nunca hagas `push` directo a `main`**: eso despliega a producción de
> inmediato, sin oportunidad de revisar.

### Opción B — Copiar archivos manualmente

Si prefieres no tocar Git, estos son **todos** los archivos que cambiaron:

**Modificados:**
- `server.ts` — carga de `dotenv`, variables obligatorias, fix de ID duplicado
- `.env.example` — se le quitaron las credenciales reales
- `package.json` — script `test:fel`

**Nuevos:**
- `fel/calculos.ts` — cálculos de IVA
- `fel/calculos.test.ts` — pruebas
- `migrations/002_fel.sql` — tablas FEL
- `setup_dev_db.sql` — *(solo desarrollo, no subir a producción)*
- `DESPLIEGUE.md`, `CHANGELOG.md`

**Eliminados de la raíz** (movidos a `scripts-archivo/`): 13 scripts de prueba
que tenían las credenciales de producción escritas dentro. **No los subas.**

**Nunca subas el archivo `.env`** — contiene secretos y ya está en `.gitignore`.

---

## Paso 4 — Verificación después de desplegar

Marca cada punto:

- [ ] La aplicación carga en el dominio de producción
- [ ] Un usuario puede **iniciar sesión** (recuerda: todos fueron desconectados)
- [ ] El **inventario** muestra los productos
- [ ] Se puede **crear una factura** y aparece en el listado
- [ ] Los **totales coinciden** con los de antes del despliegue
- [ ] En los logs de Vercel aparece `[DB] Conectado a Supabase: ...` con la URL
      **de producción**
- [ ] No hay errores `[FATAL] Falta la variable de entorno`

---

## Cómo revertir si algo sale mal

**Si el problema es del código:** en **Vercel → Deployments**, busca el
despliegue anterior y usa **"Promote to Production"**. Vuelve al estado previo
en segundos.

**Si el problema es de la base de datos:** la migración 002 solo agrega tablas
nuevas, así que no puede romper lo existente. Si aun así quieres deshacerla:

```sql
DROP TABLE IF EXISTS public.fel_bitacora;
DROP TABLE IF EXISTS public.fel_documentos;
DROP TABLE IF EXISTS public.fel_config;
```

**Si quieres volver al código original por completo:**

```bash
git checkout d7d1e3e    # baseline: el sistema tal como estaba
```

---

## Regla de oro para FEL

> **Nunca pongas `fel_config.ambiente = 'produccion'` hasta haber certificado
> con éxito varios documentos en el ambiente de pruebas de INFILE.**

Un DTE certificado en producción es un **documento fiscal real ante SAT**. No se
borra: se tiene que anular con un trámite formal. Toda prueba se hace en el
ambiente de pruebas.

---

## Estado actual del proyecto

| Componente | Estado |
|---|---|
| Ambiente de desarrollo aislado | ✅ Funcionando |
| Credenciales de producción fuera del código | ✅ Hecho |
| Arranque blindado (falla si faltan variables) | ✅ Hecho |
| Tablas FEL diseñadas | ✅ Migración 002 lista |
| Cálculo de IVA (precio incluye IVA) | ✅ Implementado y probado |
| Generación del XML del DTE | ⏳ Pendiente |
| Integración con la API de INFILE | ⏳ Esperando credenciales |
| Políticas RLS en producción | ⏳ Pendiente |

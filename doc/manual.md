# Manual de integración — Supabase Auth

## Instalación de dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Variables de entorno

**Dónde obtenerlas — opción más rápida:**

En el dashboard ve a **Home → Connect → Framework → Astro**.
En el paso 2 ("Add files") Supabase muestra directamente los valores de `SUPABASE_URL` y `SUPABASE_KEY` pre-rellenados con los datos de tu proyecto.

Esos mismos valores son los que usamos, solo con distinto nombre de variable:

| Variable del Connect guide | Variable en este proyecto |
|---|---|
| `SUPABASE_URL` | `PUBLIC_SUPABASE_URL` |
| `SUPABASE_KEY` | `PUBLIC_SUPABASE_ANON_KEY` |

El prefijo `PUBLIC_` es necesario para que Astro exponga la variable en el browser (requerido por `createBrowserClient` en el botón de Google OAuth).

**Alternativa:** Project Settings → Data API → sección "Project API keys" → botón **"reveal"** junto a la key `anon`.

> No uses la key `service_role` — tiene acceso total ignorando todas las políticas RLS. Solo se usa en backends de confianza, nunca con prefijo `PUBLIC_`.

Agregar en `.env`:

```env
PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

> Las variables con prefijo `PUBLIC_` son accesibles en el cliente (browser).
> Nunca pongas el `service_role` key con prefijo `PUBLIC_`.

---

## Configuración en Supabase Dashboard

### 1 — Crear proyecto

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Elige organización, nombre, contraseña de base de datos y región
3. No necesitas crear tablas manualmente — Supabase crea el esquema `auth.*` automáticamente

**Enable automatic RLS**

Durante la creación del proyecto aparece la opción:
> *"Create an event trigger that automatically enables Row Level Security on all new tables in the public schema."*

**Seleccionar: ON ✓**

Dado que el proyecto manejará roles (ej. admin, agente, cliente), RLS es obligatorio. Sin él, cualquier usuario autenticado podría leer y escribir datos de otros usuarios directamente desde el cliente.

Con RLS activo, cada tabla nueva en el esquema `public` queda bloqueada por defecto — sin una policy explícita, nadie puede acceder a los datos aunque tenga el `anon key`. Las policies se definen por rol y por operación (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).

Ejemplo de lo que se configurará por tabla cuando se definan los roles:

```sql
-- Solo el propio usuario puede leer su perfil
CREATE POLICY "usuario lee su perfil"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Solo admins pueden ver todos los perfiles
CREATE POLICY "admin lee todos los perfiles"
ON profiles FOR SELECT
USING (auth.jwt() ->> 'role' = 'admin');
```

> Las policies se gestionan en **Authentication → Configuration → Policies** o directamente en **Table Editor → [tabla] → RLS**.

### 2 — Proveedor Email

**Authentication → Configuration → Sign In / Providers → Email**

| Opción | Valor recomendado | Notas |
|---|---|---|
| Enable email provider | ON | Habilita registro e inicio de sesión por correo |
| Secure email change | ON | Requiere confirmar el cambio tanto en el correo viejo como en el nuevo |
| Secure password change | ON | El usuario debe tener sesión reciente (< 24 h) para cambiar contraseña |
| Prevent use of leaked passwords | —  | Solo disponible en plan Pro |
| Minimum password length | `8` | El mínimo es 6, pero 8 o más es lo recomendado |
| Password requirements | `Lowercase, uppercase letters, digits and symbols` | Recomendado por Supabase |
| Email OTP expiration | `3600` | Segundos antes de que expire el enlace de confirmación/reset (1 hora) |
| Email OTP length | `8` | Longitud del código OTP en correos |

> El endpoint `/api/auth/register` devuelve `needsConfirmation: true` cuando Supabase requiere que el usuario confirme su correo antes de poder iniciar sesión. Esto ocurre por el flujo estándar de Supabase — no hay una opción llamada "Confirm email" en el panel; el envío de confirmación es automático al hacer `signUp`.

### 3 — Proveedor Google (OAuth)

**Paso A — Google Cloud Console**

1. Ir a [console.cloud.google.com](https://console.cloud.google.com)
2. Crear o seleccionar un proyecto
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
4. Tipo de aplicación: **Web application**
5. En **Authorized redirect URIs** agregar exactamente:
   ```
   https://xxxxxxxxxxxx.supabase.co/auth/v1/callback
   ```
   (reemplazar `xxxxxxxxxxxx` con el ID de tu proyecto Supabase)
6. Guardar → copiar **Client ID** y **Client Secret**

**Paso B — Supabase Dashboard**

**Authentication → Configuration → Sign In / Providers → Google**

1. Habilitar **Enable Sign in with Google** ✓
2. Copiar el valor del campo **Callback URL (for OAuth)** — este es el URI que debes registrar en Google Cloud Console en el paso A (Authorized redirect URIs)
3. Pegar el **Client ID** del paso A en el campo **Client IDs**
4. Pegar el **Client Secret** del paso A en el campo **Client Secret (for OAuth)**
5. Dejar **Skip nonce checks** en OFF (más seguro)
6. Dejar **Allow users without an email** en OFF (el proyecto requiere correo)
7. Guardar

> **Orden importante:** primero copia el Callback URL de Supabase, luego regístralo en Google Cloud Console, y finalmente pega las credenciales de Google en Supabase. El Callback URL tiene la forma `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`.

### 4 — URL Configuration

**Authentication → Configuration → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://tu-dominio.com` |
| Redirect URLs | `https://tu-dominio.com/auth/callback` |
| | `http://localhost:4321/auth/callback` |

> Supabase rechaza cualquier `redirectTo` que no esté en la whitelist de Redirect URLs.
> Agregar tanto el dominio de producción como el de desarrollo local.

### 5 — Plantillas de correo (opcional)

**Authentication → Notifications → Email**

Puedes personalizar los correos de **Confirm signup** y **Reset password**.
Asegúrate de que el enlace del template use `{{ .ConfirmationURL }}` — Supabase lo rellena automáticamente con el `redirectTo` enviado desde el código.

### 6 — Rate Limits (referencia)

**Authentication → Configuration → Rate Limits**

Supabase aplica límites por defecto. Los más relevantes para este proyecto:

| Tipo | Límite por defecto |
|---|---|
| Emails enviados (signup, reset) | 4 por hora |
| Intentos de login | 360 por hora |

> Si en desarrollo necesitas más intentos, puedes subirlos temporalmente desde este panel.

---

## Flujo completo

```
/login
  Email + contraseña  →  POST /api/auth/login          →  cookie de sesión  →  redirect /
  Google              →  supabase.signInWithOAuth       →  Google            →  /auth/callback  →  redirect /

/register
  Formulario          →  POST /api/auth/register        →  email de confirmación enviado
  Google              →  mismo flujo que login
  Clic en email       →  /auth/callback?code=xxx        →  sesión activa     →  redirect /

/forgot-password
  Formulario          →  POST /api/auth/forgot-password →  email con enlace de recuperación
  Clic en email       →  /auth/callback?code=xxx&next=/reset-password        →  redirect /reset-password

/reset-password
  SSR verifica sesión →  muestra formulario o estado "enlace inválido"
  Formulario          →  POST /api/auth/reset-password  →  updateUser        →  signOut  →  redirect /login
```

---

## Endpoints implementados

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/login` | Inicio de sesión con email y contraseña |
| `POST` | `/api/auth/register` | Registro de nueva cuenta |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `POST` | `/api/auth/forgot-password` | Enviar email de recuperación |
| `POST` | `/api/auth/reset-password` | Actualizar contraseña (requiere sesión activa) |
| `GET` | `/auth/callback` | Callback de OAuth y confirmación de email |

---

## Middleware — Protección de rutas

El archivo `src/middleware.ts` se ejecuta en cada request antes de que Astro resuelva la página.

### Comportamiento

| Situación | Resultado |
|---|---|
| Usuario sin sesión intenta acceder a `/` o cualquier ruta del sitio | Redirige a `/login?redirect=/ruta-original` |
| Usuario sin sesión intenta acceder a `/login`, `/register`, `/forgot-password` | Permitido (rutas públicas) |
| Usuario con sesión intenta acceder a `/login`, `/register`, `/forgot-password` | Redirige a `/` |
| Usuario con sesión accede a cualquier otra ruta | Permitido |
| Requests a `/api/*` | El middleware no interfiere — cada endpoint maneja su propia auth |

### Rutas públicas (sin sesión requerida)

```
/login
/register
/forgot-password
/reset-password      ← tiene su propia validación de sesión interna
/auth/callback       ← necesario para que Supabase complete el OAuth
```

### Agregar rutas protegidas adicionales

No se necesita hacer nada — cualquier ruta nueva que se cree en `src/pages/` quedará automáticamente protegida por defecto. Solo agregar a `PUBLIC_ROUTES` en `src/middleware.ts` si la ruta debe ser pública.

### Redirección post-login

Cuando el middleware redirige a un usuario no autenticado a `/login`, incluye el parámetro `?redirect=/ruta-original`. Al hacer login exitoso, el script de `login.astro` lee ese parámetro y lleva al usuario de vuelta a donde intentaba ir.

---

## Archivos relevantes del proyecto

| Archivo | Propósito |
|---|---|
| `src/lib/supabase.ts` | Crea el cliente Supabase para SSR (lee/escribe cookies) |
| `src/lib/auth-errors.ts` | Mapea errores de Supabase a mensajes en español |
| `src/pages/api/auth/*.ts` | Endpoints de autenticación |
| `src/pages/auth/callback.astro` | Intercambia el `?code=` por sesión (PKCE) |
| `src/middleware.ts` | Protección global de rutas por sesión |
| `src/pages/login.astro` | Interfaz de inicio de sesión |
| `src/pages/register.astro` | Interfaz de registro |
| `src/pages/forgot-password.astro` | Interfaz de recuperación de contraseña |
| `src/pages/reset-password.astro` | Interfaz de nueva contraseña |

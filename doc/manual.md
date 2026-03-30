# Manual de integración — Supabase Auth

## Instalación de dependencias

```bash
npm install @supabase/supabase-js @supabase/ssr
```

---

## Variables de entorno

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

### 2 — Auth → Providers → Email

**Authentication → Providers → Email**

| Opción | Valor recomendado |
|---|---|
| Enable Email provider | ON |
| Confirm email | ON |
| Secure email change | ON |
| Double confirm email changes | ON |

> Con **Confirm email: ON**, al registrarse el usuario recibirá un correo de confirmación antes de poder iniciar sesión. El endpoint `/api/auth/register` ya maneja este caso devolviendo `needsConfirmation: true`.

### 3 — Auth → Providers → Google

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

1. **Authentication → Providers → Google**
2. Habilitar Google ✓
3. Pegar **Client ID** y **Client Secret** del paso anterior
4. Guardar

### 4 — Auth → URL Configuration

**Authentication → URL Configuration**

| Campo | Valor |
|---|---|
| Site URL | `https://tu-dominio.com` |
| Redirect URLs | `https://tu-dominio.com/auth/callback` |
| | `http://localhost:4321/auth/callback` |

> Supabase rechaza cualquier `redirectTo` que no esté en la whitelist de Redirect URLs.
> Agregar tanto el dominio de producción como el de desarrollo local.

### 5 — Auth → Email Templates (opcional)

**Authentication → Email Templates**

Puedes personalizar los correos de **Confirm signup** y **Reset password**.
Asegúrate de que el enlace del template use `{{ .ConfirmationURL }}` — Supabase lo rellena automáticamente con el `redirectTo` enviado desde el código.

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

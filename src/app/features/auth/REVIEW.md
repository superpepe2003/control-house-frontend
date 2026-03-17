# Code Review — Módulo Auth

> Fecha: 2026-03-17
> Revisado por: Claude Sonnet 4.6
> Branch: main

---

## ALTO

### [ALTO-1] `TOKEN_KEY` triplicado — fuente de verdad fragmentada

**Archivos:** `auth.service.ts`, `core/guards/auth.guard.ts`, `core/interceptors/auth.interceptor.ts`
**Problema:** La constante `TOKEN_KEY = 'auth_token'` se define de forma independiente en tres archivos. Si la clave cambia en uno, los otros dos siguen buscando el valor viejo en `localStorage` y el sistema de auth se rompe silenciosamente. No hay error de compilación ni de runtime que lo avise.

```typescript
// auth.service.ts
const TOKEN_KEY = 'auth_token';

// auth.guard.ts
const TOKEN_KEY = 'auth_token';  // duplicado

// auth.interceptor.ts
const TOKEN_KEY = 'auth_token';  // duplicado
```

**Solución:** Exportar la constante desde `auth.service.ts` e importarla en el guard y el interceptor, o mejor aún, que el guard y el interceptor usen `AuthService` directamente (ver ALTO-2 y ALTO-3).

---

### [ALTO-2] `authGuard` lee `localStorage` directamente en lugar de usar `AuthService`

**Archivo:** `core/guards/auth.guard.ts`
**Problema:** El guard hace `localStorage.getItem(TOKEN_KEY)` por su cuenta en lugar de delegar en `AuthService`. Esto crea una inconsistencia: si el estado en memoria (`_token` signal) difiere de `localStorage` (por ejemplo, una lógica futura que invalide el token solo en memoria), el guard y el servicio verán estados distintos. El guard tampoco tiene acceso a `isAuthenticated` como computed signal reactiva.

```typescript
// Actual — acceso directo a localStorage:
export const authGuard: CanActivateFn = () => {
  if (localStorage.getItem(TOKEN_KEY)) {
    return true;
  }
  return inject(Router).createUrlTree(['/auth/login']);
};
```

**Solución:**
```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../features/auth/services/auth.service';

export const authGuard: CanActivateFn = () => {
  if (inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/auth/login']);
};
```

---

### [ALTO-3] `authInterceptor` lee `localStorage` directamente en lugar de usar `AuthService`

**Archivo:** `core/interceptors/auth.interceptor.ts`
**Problema:** El interceptor llama `localStorage.getItem(TOKEN_KEY)` directamente. Mismo problema de acoplamiento que el guard: si la fuente del token cambia (sessionStorage, cookie, memoria), hay que actualizar el interceptor por separado. Además, duplica la constante `TOKEN_KEY`.

```typescript
// Actual — acoplado a localStorage:
const token = localStorage.getItem(TOKEN_KEY);
```

**Solución:**
```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { AuthService } from '../../features/auth/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).getToken();
  if (token) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return next(req);
};
```

---

### [ALTO-4] Sin manejo de token expirado (respuesta 401)

**Archivo:** `core/interceptors/auth.interceptor.ts`
**Problema:** Cuando el backend devuelve `401 Unauthorized` (token expirado o inválido), el interceptor no hace nada. El usuario queda en un estado roto: la UI sigue mostrando datos del dashboard/transacciones pero todas las requests fallan. No se limpia el token ni se redirige al login.

**Solución:** Interceptar errores 401 y llamar a `AuthService.logout()`:
```typescript
import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err) => {
      if (err.status === 401) {
        authService.logout();
      }
      return throwError(() => err);
    }),
  );
};
```

---

### [ALTO-5] Sin guard de "ya autenticado" en rutas de auth

**Archivo:** `app.routes.ts` y `auth.routes.ts`
**Problema:** Un usuario con sesión activa puede navegar manualmente a `/auth/login` o `/auth/register` y ver los formularios de auth. No existe ningún guard que detecte la sesión existente y redirija al dashboard.

**Solución:** Crear un `noAuthGuard` (inverso del `authGuard`) y aplicarlo a las rutas de auth:

```typescript
// core/guards/no-auth.guard.ts
export const noAuthGuard: CanActivateFn = () => {
  if (!inject(AuthService).isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/dashboard']);
};

// auth.routes.ts
export const authRoutes: Routes = [
  {
    path: 'login',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [noAuthGuard],
    loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
```

---

## MEDIO

### [MEDIO-1] Subscriptions sin `takeUntilDestroyed` en login y register

**Archivos:** `pages/login/login.component.ts` y `pages/register/register.component.ts`
**Problema:** `onSubmit()` en ambos componentes llama a `authService.login()` / `authService.register()` con `.subscribe()` sin `takeUntilDestroyed`. Ninguno inyecta `DestroyRef`. Si el usuario navega con el botón de atrás del browser mientras la request está en vuelo, el callback puede ejecutarse sobre un componente destruido.

**Solución:**
```typescript
private readonly destroyRef = inject(DestroyRef);

// En onSubmit():
this.authService.login(this.form.getRawValue())
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe({ ... });
```

---

### [MEDIO-2] `AuthResponse` interface incompleta — no coincide con el contrato del backend

**Archivo:** `models/auth.models.ts`
**Problema:** El contrato documentado del backend es `{ statusCode, message, data }`. Pero `AuthResponse` solo define `{ data: { token } }`. Falta `statusCode` y `message`. Aunque funciona en runtime (TypeScript ignora los campos extras), el tipo es incompleto e inconsistente con la interfaz `ApiResponse<T>` usada en los otros módulos.

```typescript
// Actual — parcial:
export interface AuthResponse {
  data: { token: string };
}
```

**Solución — alinear con el contrato del backend:**
```typescript
export interface AuthResponse {
  statusCode: number;
  message: string;
  data: { token: string };
}
```

---

### [MEDIO-3] Error de HTTP tipado ad-hoc en lugar de `HttpErrorResponse`

**Archivos:** `pages/login/login.component.ts` y `pages/register/register.component.ts`
**Problema:** El parámetro de error en el `subscribe` usa un tipo local inventado en lugar del tipo estándar de Angular:

```typescript
// Tipo ad-hoc — no aprovecha HttpErrorResponse:
error: (err: { error?: { message?: string } }) => { ... }
```

`HttpErrorResponse` es el tipo real que Angular emite en errores HTTP. Tiene propiedades como `status`, `statusText`, `url`, `error`, etc., que podrían ser útiles para manejo de errores más específico (ej: mostrar un mensaje diferente para 503 vs 401).

**Solución:**
```typescript
import { HttpErrorResponse } from '@angular/common/http';

error: (err: HttpErrorResponse) => {
  this.errorMessage.set(err.error?.message ?? 'Credenciales incorrectas. Intentá de nuevo.');
  this.loading.set(false);
}
```

---

### [MEDIO-4] SCSS completamente duplicado entre login y register

**Archivos:** `pages/login/login.component.scss` y `pages/register/register.component.scss`
**Problema:** Ambos archivos son prácticamente idénticos (`.auth-container`, `.auth-card`, `.full-width`, `.submit-btn`, `.error-message`, `.actions-center`, `.redirect-text`). Un cambio de diseño requiere actualizar dos archivos. Si se agrega un tercer componente de auth, el problema se triplica.

**Solución:** Extraer los estilos comunes a un archivo compartido:
```scss
// src/app/features/auth/styles/auth-shared.scss
.auth-container { ... }
.auth-card { ... }
.full-width { ... }
// etc.
```

Y en cada componente solo importar:
```scss
// login.component.scss
@use '../../styles/auth-shared' as *;
// Estilos específicos del login (si los hubiera)
```

---

### [MEDIO-5] `loading` no se resetea en el path de éxito si la navegación falla

**Archivos:** `pages/login/login.component.ts` y `pages/register/register.component.ts`
**Problema:** En el `next` del subscribe, `loading` se queda en `true` después de llamar a `router.navigate(['/dashboard'])`. Si la navegación falla por algún motivo (guard rechaza, error de router inesperado), el botón de submit queda deshabilitado indefinidamente y el usuario no puede reintentar sin recargar la página.

```typescript
next: () => {
  this.router.navigate(['/dashboard']); // loading sigue en true si esto falla
},
```

**Solución:** Usar el resultado de la promesa de `navigate`:
```typescript
next: () => {
  this.router.navigate(['/dashboard']).catch(() => {
    this.loading.set(false);
  });
},
```

---

## BAJO

### [BAJO-1] Sin `maxLength` en el campo `name` del formulario de registro

**Archivo:** `pages/register/register.component.ts`
**Problema:** El campo `name` tiene `Validators.minLength(2)` pero no `Validators.maxLength(N)`. El backend probablemente impone un límite. Sin validación frontend, el usuario podría ingresar un nombre extremadamente largo y recibir un error genérico del servidor.

**Solución:**
```typescript
name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
```

Y en el template:
```html
@if (form.controls.name.hasError('maxlength') && form.controls.name.touched) {
  <mat-error>El nombre no puede superar los 100 caracteres</mat-error>
}
```

---

### [BAJO-2] `mat-button color="primary"` deprecated en links de redirección

**Archivos:** `pages/login/login.component.html` y `pages/register/register.component.html`
**Problema:** El atributo `color="primary"` en botones y links de Angular Material está deprecado en versiones recientes (M3). El color debería ser manejado por el tema CSS.

```html
<!-- Deprecated: -->
<a routerLink="/auth/register" mat-button color="primary">Registrate</a>
```

**Solución:** Quitar el atributo `color` y aplicar el color del tema via CSS si es necesario:
```html
<a routerLink="/auth/register" mat-button>Registrate</a>
```

---

### [BAJO-3] Sin `maxLength` en el campo `password` del formulario

**Archivos:** `pages/login/login.component.ts` y `pages/register/register.component.ts`
**Problema:** Hay `Validators.minLength(6)` pero no `Validators.maxLength`. Aunque es raro, un password muy largo puede causar problemas en el backend (hashing bcrypt con strings > 72 bytes, por ejemplo, trunca silenciosamente).

**Solución:**
```typescript
password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(128)]],
```

---

### [BAJO-4] `autocomplete="new-password"` en ambos campos de contraseña del registro

**Archivo:** `pages/register/register.component.html`
**Problema:** El campo `confirmPassword` también tiene `autocomplete="new-password"`, lo que hace que el browser intente autocompletar la confirmación con el mismo valor generado para el campo anterior. Esto puede llevar a que ambos campos sean llenados con contraseñas generadas automáticamente sin que el usuario las vea.

**Solución:** Para el campo de confirmación, usar `autocomplete="new-password"` está bien técnicamente pero algunos browsers lo manejan de forma diferente. La opción más robusta:
```html
<input ... autocomplete="off" />
```
en el campo de confirmación, para forzar al usuario a escribirla manualmente.

---

## Resumen de issues

| Severidad | Cantidad | Issues principales |
|-----------|----------|--------------------|
| ALTO      | 5        | TOKEN_KEY triplicado, guard e interceptor sin AuthService, sin manejo de 401, sin guard para usuarios autenticados |
| MEDIO     | 5        | Subscriptions sin takeUntilDestroyed, AuthResponse incompleta, HttpErrorResponse, SCSS duplicado, loading no resetea en éxito |
| BAJO      | 4        | maxLength en name/password, color deprecated, autocomplete en confirmPassword |

**Prioridad de resolución recomendada:** ALTO-2 y ALTO-3 (guard e interceptor usan AuthService, resuelve ALTO-1 de paso) → ALTO-4 (manejo de 401 en interceptor) → ALTO-5 (noAuthGuard) → MEDIO-1 (takeUntilDestroyed) → MEDIO-4 (SCSS compartido).

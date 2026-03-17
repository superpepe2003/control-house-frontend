# Code Review — Módulo Profile

**Fecha:** 2026-03-17
**Archivos revisados:**
- `models/profile.models.ts`
- `services/profile.service.ts`
- `pages/profile/profile.component.ts`
- `pages/profile/profile.component.html`

---

## ALTO

### [ALTO-1] Sin estado de error al fallar la carga del perfil
**Archivo:** `profile.component.ts` líneas 107–110 / `profile.component.html` línea 19

Cuando `getProfile()` falla, el código hace:
```ts
error: () => {
  this.snackBar.open('Error al cargar el perfil', 'Cerrar', { duration: 3000 });
  this.loadingProfile.set(false);
},
```

`loadingProfile.set(false)` hace que el template muestre el bloque `@else` — que renderiza las dos tarjetas de formularios con `profile()` siendo `null`. Resultado visible:
- `{{ profile()?.name }}` → vacío
- `{{ profile()?.email }}` → vacío
- `{{ profile()?.createdAt | date:... }}` → vacío
- `infoForm` con campos vacíos (nunca se llamó `patchValue`)

El usuario ve la pantalla de perfil vacía sin ningún mensaje persistente (el snackbar desaparece en 3 segundos) y sin botón para reintentar. No hay señal de que hubo un error.

**Fix:** Agregar un signal `errorProfile = signal<string | null>(null)`, mostrar un estado de error explícito en el template con botón "Reintentar", e incluir el caso `profile() === null` como guard en el bloque `@else`.

---

## MEDIO

### [MEDIO-1] `ChangeDetectorRef` + `markForCheck()` innecesario con signals
**Archivo:** `profile.component.ts` líneas 72 y 104–106

```ts
private readonly cdr = inject(ChangeDetectorRef);

// En ngOnInit():
this.cdr.markForCheck(); // "garantiza que los valores del form se reflejen"
```

El comentario es incorrecto. Con Angular ReactiveFormsModule, `patchValue()` internamente notifica a las directivas `FormControlName` a través de `ControlValueAccessor`, que llaman `markForCheck()` por su cuenta. Agregar una llamada manual es redundante.

Además, inyectar `ChangeDetectorRef` en un componente que usa signals y OnPush es una señal de alerta: sugiere que algo en el flujo de detección de cambios no está claro. Si realmente fuera necesario, debería estar documentado con precisión.

**Fix:** Eliminar la inyección de `ChangeDetectorRef` y la llamada a `markForCheck()`.

---

### [MEDIO-2] Componente con demasiadas responsabilidades
**Archivo:** `profile.component.ts`

`ProfileComponent` (182 líneas) mezcla en un solo componente:
1. Carga y visualización del resumen del perfil (avatar, nombre, email, fecha)
2. Formulario de edición de información personal (`infoForm`)
3. Formulario de cambio de contraseña (`passwordForm`) con su propia lógica de UX (desbloqueo de campos)
4. Validador cross-field `passwordMatchValidator`
5. Navegación y logout

Cada formulario tiene su propio estado de carga (`savingInfo`, `savingPassword`), su propia lógica de submit y su propio manejo de errores. Son unidades independientes que deberían ser componentes separados.

**Fix sugerido:**
- Extraer `ProfileInfoFormComponent` (gestiona `infoForm`, `savingInfo`, `saveInfo()`)
- Extraer `ProfilePasswordFormComponent` (gestiona `passwordForm`, `savingPassword`, `savePassword()`, `unlockNewPassword()`, `showNewPasswordFields`)
- `ProfileComponent` queda como página coordinadora que carga el perfil y pasa datos a los hijos

---

### [MEDIO-3] Non-null assertions en `savePassword()` por formulario sin tipado fuerte
**Archivo:** `profile.component.ts` línea 158

```ts
this.profileService.updateProfile({
  password: newPassword!,
  currentPassword: currentPassword!,
})
```

Los `!` suprimen el error de TypeScript porque `FormBuilder` sin configuración `nonNullable` infiere `string | null` para los valores del formulario. Aunque el guard `if (this.passwordForm.invalid) return;` en la línea 152 garantiza que los valores no son null en tiempo de ejecución, TypeScript no lo sabe.

Lo mismo aplica a `saveInfo()` donde se hace `if (name) request.name = name;` de forma defensiva por el mismo motivo (líneas 121–122).

**Fix:** Usar `this.fb.nonNullable.group(...)` o `new FormGroup` con `FormControl<string>({ nonNullable: true, ... })` para que `getRawValue()` retorne `{ name: string, ... }` sin null, eliminando los `!` y las guards innecesarias.

---

### [MEDIO-4] `saveInfo()` no detecta si hubo cambios antes de enviar
**Archivo:** `profile.component.ts` líneas 114–139

El botón "Guardar Cambios" está habilitado siempre que el formulario sea válido, independientemente de si el usuario modificó algo. Si el usuario carga la pantalla y sin tocar nada hace click en "Guardar Cambios", se envía un PATCH al backend con los mismos valores.

**Fix:** Deshabilitar el botón cuando `infoForm.pristine` es `true` (el formulario no fue modificado desde su última inicialización/reset). En el template: `[disabled]="infoForm.invalid || infoForm.pristine || savingInfo()"`.

---

## BAJO

### [BAJO-1] `CommonModule` importado junto con `DatePipe` individual — redundante
**Archivo:** `profile.component.ts` líneas 47–49

```ts
imports: [
  CommonModule,  // ← incluye DatePipe, AsyncPipe, NgIf, NgFor, etc.
  DatePipe,      // ← ya viene dentro de CommonModule
  ...
]
```

En Angular standalone (v17+) se recomienda importar solo lo que se usa individualmente. `CommonModule` es un barrel que incluye muchas cosas no necesarias. Dado que el template usa el control flow nativo (`@if`, `@for`) y solo necesita `DatePipe`, basta con importar solo `DatePipe`.

**Fix:** Eliminar `CommonModule` del array `imports`.

---

### [BAJO-2] Estilos inline en el template
**Archivo:** `profile.component.html` líneas 83 y 190

```html
<span style="display:flex;align-items:center;gap:8px">
  <mat-icon>save</mat-icon>Guardar Cambios
</span>
```

Aparece dos veces (botón de guardar info y botón de cambiar contraseña). Los estilos estáticos inline deben ir al SCSS del componente.

**Fix:** Crear una clase `.btn-content` en `profile.component.scss` con esos estilos y aplicarla en el template.

---

### [BAJO-3] `loading-wrapper` sin `aria-live`
**Archivo:** `profile.component.html` línea 16

```html
<div class="loading-wrapper" aria-label="Cargando perfil">
```

Tiene `aria-label` pero le falta `aria-live="polite"` para que los lectores de pantalla anuncien el cambio de estado cuando el spinner aparece o desaparece. Los otros módulos (ej: categories) sí incluyen `aria-live="polite"`.

**Fix:** Agregar `aria-live="polite"` al div del spinner.

---

### [BAJO-4] `unlockNewPassword()` con validación manual que podría ser declarativa
**Archivo:** `profile.component.ts` líneas 142–149 / `profile.component.html` línea 119

```ts
unlockNewPassword(): void {
  const currentPwd = this.passwordForm.get('currentPassword');
  if (!currentPwd?.value) {
    currentPwd?.markAsTouched();
    return;
  }
  this.showNewPasswordFields.set(true);
}
```

Esta lógica imperativa replica lo que el formulario ya sabe: si `currentPassword` está vacío, el botón "Continuar" no debería estar habilitado. En lugar de manejar esto en el método, el botón puede deshabilitarse declarativamente en el template:

```html
<button
  mat-stroked-button
  type="button"
  (click)="showNewPasswordFields.set(true)"
  [disabled]="!passwordForm.get('currentPassword')?.value"
  aria-label="Continuar para ingresar nueva contraseña"
>
```

Esto simplifica el componente eliminando el método `unlockNewPassword()` por completo.

---

## Resumen

| ID | Severidad | Descripción | Archivo |
|----|-----------|-------------|---------|
| ALTO-1 | 🔴 ALTO | Sin estado de error al fallar `getProfile()` — formularios vacíos sin posibilidad de reintentar | `profile.component.ts/html` |
| MEDIO-1 | 🟡 MEDIO | `ChangeDetectorRef` + `markForCheck()` innecesario con signals y reactive forms | `profile.component.ts` |
| MEDIO-2 | 🟡 MEDIO | Componente muy grande con múltiples responsabilidades (perfil + 2 formularios) | `profile.component.ts` |
| MEDIO-3 | 🟡 MEDIO | Non-null assertions (`!`) por formularios sin tipado nonNullable | `profile.component.ts` |
| MEDIO-4 | 🟡 MEDIO | `saveInfo()` envía request aunque no haya cambios (`infoForm.pristine`) | `profile.component.ts` |
| BAJO-1 | 🟢 BAJO | `CommonModule` importado junto con `DatePipe` — redundante | `profile.component.ts` |
| BAJO-2 | 🟢 BAJO | Estilos inline en template — deben ir al SCSS | `profile.component.html` |
| BAJO-3 | 🟢 BAJO | `loading-wrapper` sin `aria-live="polite"` | `profile.component.html` |
| BAJO-4 | 🟢 BAJO | `unlockNewPassword()` imperativo — simplificar con binding declarativo en el template | `profile.component.ts/html` |

# Code Review — Módulo Accounts

> Fecha: 2026-03-17
> Revisado por: Claude Sonnet 4.6
> Branch: feat/fix-transactions-review

---

## ALTO

### [ALTO-1] Subscriptions sin gestión de ciclo de vida en `accounts.component.ts`

**Archivo:** `pages/accounts/accounts.component.ts`
**Problema:** Cuatro subscriptions no tienen `takeUntilDestroyed`. Si el usuario navega fuera de la página mientras hay una request en vuelo o un dialog abierto, los callbacks se ejecutan sobre un componente destruido:

- `loadAccounts()` — línea de `getAll().subscribe(...)`: si se navega durante la carga, el callback actualiza `accounts` y `loading` en un componente ya destruido.
- `openCreateDialog()` — `afterClosed().subscribe(...)`: si el componente se destruye con el dialog abierto (navegación programática), el callback actualiza el estado.
- `openEditDialog()` — mismo caso.
- `confirmDelete()` — mismo caso.

El componente tampoco inyecta `DestroyRef`, que es prerrequisito para `takeUntilDestroyed`.

**Solución:**
```typescript
private readonly destroyRef = inject(DestroyRef);

// En loadAccounts():
this.accountsService.getAll().pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe({ ... });

// En afterClosed():
dialogRef.afterClosed()
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((result) => { ... });
```

---

### [ALTO-2] Subscriptions sin `takeUntilDestroyed` en `account-form-dialog.component.ts`

**Archivo:** `components/account-form-dialog/account-form-dialog.component.ts` — método `submit()`
**Problema:** Las llamadas a `create()` y `update()` en `submit()` no tienen protección de ciclo de vida. Si el dialog se cierra de forma programática (por ejemplo, vía navegación o `MatDialog.closeAll()`) mientras la request está en vuelo, los callbacks intentan actualizar el signal `errorMessage` y llamar a `dialogRef.close()` sobre una instancia destruida. El componente no inyecta `DestroyRef`.

**Solución:**
```typescript
private readonly destroyRef = inject(DestroyRef);

// En submit():
this.accountsService.create(payload).pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe({
  next: (account) => this.dialogRef.close(account),
  error: (err) => { ... },
});
```

---

### [ALTO-3] `delete()` en el servicio inconsistente con el contrato del backend

**Archivo:** `services/accounts.service.ts` — línea 28
**Problema:** El contrato del backend establece que todos los endpoints retornan `{ statusCode, message, data }`. Sin embargo, `delete()` usa `http.delete<void>` sin mapear el response. Esto es inconsistente con los otros métodos y puede romperse si el backend cambia el formato o incluye datos en el body del DELETE.

```typescript
// Inconsistente:
delete(id: number): Observable<void> {
  return this.http.delete<void>(`${this.baseUrl}/${id}`);
}
```

**Solución:**
```typescript
delete(id: number): Observable<void> {
  return this.http
    .delete<ApiResponse<null>>(`${this.baseUrl}/${id}`)
    .pipe(map(() => void 0));
}
```

---

## MEDIO

### [MEDIO-1] `totalBalance()` es un método regular en lugar de `computed()`

**Archivo:** `pages/accounts/accounts.component.ts`
**Problema:** `totalBalance()` es un método ordinario que recorre el array `accounts()` en cada llamada. Con `ChangeDetectionStrategy.OnPush`, esto funciona correctamente solo si se llama desde el template (Angular lo re-evalúa al cambiar los inputs/signals). Sin embargo, es una señal derivada del estado: debería ser `computed()` para ser explícitamente reactiva, memorizada entre renders y consistente con los patrones del proyecto.

```typescript
// Actual — método regular:
totalBalance(): number {
  return this.accounts().reduce((sum, a) => sum + a.balance, 0);
}
```

**Solución:**
```typescript
readonly totalBalance = computed(() =>
  this.accounts().reduce((sum, a) => sum + a.balance, 0),
);
```

---

### [MEDIO-2] `totalBalance()` suma balances de cuentas con monedas heterogéneas

**Archivo:** `pages/accounts/accounts.component.ts`
**Problema:** `totalBalance()` suma los balances de todas las cuentas sin distinguir monedas. Una cuenta con 100 USD y otra con 100.000 ARS darían 100.100, un número sin sentido monetario. Aunque el template actual no muestra el total, la función existe y puede usarse incorrectamente en el futuro.

**Solución:** Agrupar por moneda antes de sumar, o directamente eliminar `totalBalance()` si no se usa en el template, y reintroducirla agrupando por `currency` cuando sea necesario:
```typescript
readonly totalByCurrency = computed(() => {
  const result: Record<string, number> = {};
  for (const a of this.accounts()) {
    result[a.currency] = (result[a.currency] ?? 0) + a.balance;
  }
  return result;
});
```

---

### [MEDIO-3] Tipo `VIRTUAL` sin estilos CSS de avatar ni de chip

**Archivos:** `pages/accounts/accounts.component.scss` y `components/account-form-dialog/account-form-dialog.component.ts`
**Problema:** El SCSS define `.avatar-cash`, `.avatar-bank` y `.avatar-credit` con colores, pero **no define `.avatar-virtual`**. Las cuentas de tipo `VIRTUAL` tendrán el avatar sin color de fondo (transparente). De igual forma, no hay `chip-virtual` en los estilos de los chips.

```scss
/* Definidos: */
&.avatar-cash   { background-color: #4caf50; }
&.avatar-bank   { background-color: #2196f3; }
&.avatar-credit { background-color: #9c27b0; }
/* Falta: */
&.avatar-virtual { /* sin color → fondo transparente, ícono invisible */ }
```

**Solución:** Agregar estilos para `VIRTUAL` en el SCSS:
```scss
&.avatar-virtual { background-color: #ff9800; }

mat-chip {
  &.chip-virtual {
    --mdc-chip-label-text-color: #e65100;
    --mdc-chip-elevated-container-color: #fff3e0;
  }
}
```

---

### [MEDIO-4] `TYPE_LABELS` y `TYPE_ICONS` tipados como `Record<string, string>`

**Archivo:** `pages/accounts/accounts.component.ts`
**Problema:** `TYPE_LABELS` y `TYPE_ICONS` se declaran como `Record<string, string>`, pero las claves son siempre `AccountType`. El tipado genérico `string` deja pasar accesos con claves inválidas sin error de compilación.

```typescript
// Actual — clave no verificada:
const TYPE_LABELS: Record<string, string> = { ... };
const TYPE_ICONS: Record<string, string>  = { ... };
```

**Solución:**
```typescript
import { AccountType } from '../../models/account.models';

const TYPE_LABELS: Record<AccountType, string> = {
  CASH:    'Efectivo',
  BANK:    'Banco',
  CREDIT:  'Crédito',
  VIRTUAL: 'Virtual',
};

const TYPE_ICONS: Record<AccountType, string> = {
  CASH:    'account_balance_wallet',
  BANK:    'account_balance',
  CREDIT:  'credit_card',
  VIRTUAL: 'smartphone',
};
```

---

### [MEDIO-5] Empty state sin `role="status"` ni `aria-live`

**Archivo:** `pages/accounts/accounts.component.html`
**Problema:** El div del empty state no tiene atributos de accesibilidad. Los lectores de pantalla no anuncian el cambio de estado cuando la lista queda vacía después de una acción (por ejemplo, al eliminar la última cuenta).

```html
<!-- Actual: -->
<div class="empty-state">
```

**Solución:**
```html
<div class="empty-state" role="status" aria-live="polite">
```

---

### [MEDIO-6] Dialog sin ancho fijo (`width`) al abrirse

**Archivo:** `pages/accounts/accounts.component.ts` — métodos `openCreateDialog()` y `openEditDialog()`
**Problema:** El dialog se abre sin especificar `width`. El ancho resultante depende del contenido, lo que puede causar que el dialog sea muy estrecho (especialmente en móvil) o que su tamaño varíe entre el modo crear y editar según la longitud del nombre de la cuenta.

```typescript
// Sin width:
this.dialog.open(AccountFormDialogComponent, { data: {} });
```

**Solución:**
```typescript
this.dialog.open(AccountFormDialogComponent, { data: {}, width: '440px' });
```

---

## BAJO

### [BAJO-1] `getById()` en el servicio es dead code

**Archivo:** `services/accounts.service.ts`
**Problema:** El método `getById(id)` existe en el servicio pero no se usa en ningún componente del módulo.

**Solución:** Eliminar hasta que sea necesario.

---

### [BAJO-2] Sin validador `maxLength` en el campo `name` del formulario

**Archivo:** `components/account-form-dialog/account-form-dialog.component.ts`
**Problema:** El campo `name` tiene `Validators.minLength(2)` pero no `Validators.maxLength(N)`. El backend probablemente impone un límite (usualmente 100 o 255 caracteres). Sin validación frontend, el usuario podría ingresar un nombre extremadamente largo y recibir un error genérico del backend en lugar de un mensaje claro en el formulario.

**Solución:**
```typescript
name: [
  this.data?.account?.name ?? '',
  [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
],
```

Y en el template:
```html
@if (form.get('name')?.hasError('maxlength') && form.get('name')?.touched) {
  <mat-error>Máximo 100 caracteres</mat-error>
}
```

---

### [BAJO-3] `mat-card-actions` con estilos sobreescritos por CSS

**Archivo:** `pages/accounts/accounts.component.scss`
**Problema:** `mat-card-actions` tiene soporte nativo para `align="end"` que alinea los botones sin necesidad de CSS adicional. El SCSS actual sobreescribe el layout con `display: flex; justify-content: flex-end`, lo cual es frágil ante actualizaciones de Angular Material.

```scss
/* Actual — sobreescritura frágil: */
mat-card-actions {
  display: flex;
  justify-content: flex-end;
  padding: 8px;
}
```

**Solución:** Eliminar los estilos de `mat-card-actions` del SCSS y usar el atributo nativo en el template:
```html
<mat-card-actions align="end">
```

---

### [BAJO-4] `account-form-dialog.component.ts` importa `MatProgressSpinnerModule` pero no `MatIconModule`

**Archivo:** `components/account-form-dialog/account-form-dialog.component.ts`
**Problema:** El template no usa ningún ícono de Material, por lo que `MatProgressSpinnerModule` se usa correctamente, pero si se agrega algún `<mat-icon>` en el futuro faltará el import. Es un issue de completitud de imports para futura extensión. Menor, pero visible al revisar el template vs imports.

> **Nota:** Esto no es un bug activo, sino un aviso preventivo.

---

## Resumen de issues

| Severidad | Cantidad | Issues principales |
|-----------|----------|--------------------|
| ALTO      | 3        | Subscriptions sin ciclo de vida (componente y dialog), delete() inconsistente |
| MEDIO     | 6        | totalBalance() como método, suma de monedas, VIRTUAL sin estilos, tipado Record, aria, width del dialog |
| BAJO      | 4        | dead code getById, maxLength faltante, mat-card-actions CSS, import preventivo |

**Prioridad de resolución recomendada:** ALTO-1 y ALTO-2 juntos (DestroyRef) → ALTO-3 (delete service) → MEDIO-3 (bug visual VIRTUAL) → MEDIO-4 (tipado) → resto.

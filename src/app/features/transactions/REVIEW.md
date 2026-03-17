# Code Review — Módulo Transactions

> Fecha: 2026-03-17
> Revisado por: Claude Sonnet 4.6
> Branch: feat/fix-ui

---

## ALTO

### [ALTO-1] Race condition en requests HTTP superpuestas

**Archivo:** `pages/transactions/transactions.component.ts` — línea 137
**Problema:** `loadTransactions()` se llama en múltiples escenarios (filtros, paginación, NavigationEnd, post-CRUD). No hay cancelación de la request anterior. Si el usuario pagina o filtra rápidamente, dos requests corren en paralelo y la última en resolver (no necesariamente la más reciente) pisa el estado. Esto puede mostrar datos de una página mientras el paginator indica otra.

```typescript
// Actualmente: sin cancelación
this.transactionsService.getAll(params).subscribe({ ... });
```

**Solución:** Usar un `Subject` de trigger y `switchMap` para cancelar automáticamente la request anterior:

```typescript
private readonly loadTrigger$ = new Subject<ListTransactionsParams>();

// En ngOnInit:
this.loadTrigger$.pipe(
  switchMap((params) => this.transactionsService.getAll(params)),
  takeUntilDestroyed(this.destroyRef),
).subscribe({ next: ..., error: ... });

// En loadTransactions():
this.loadTrigger$.next(params);
```

---

### [ALTO-2] Subscriptions sin gestión de ciclo de vida en el dialog

**Archivo:** `components/transaction-form-dialog/transaction-form-dialog.component.ts` — líneas 308 y 321
**Problema:** Las subscriptions en `loadData()` no usan `takeUntilDestroyed`. Si el usuario cierra el dialog antes de que las requests completen, los callbacks intentan actualizar signals de un componente destruido. También puede causar que datos de una instancia anterior del dialog contaminen una nueva apertura.

```typescript
// Sin protección de ciclo de vida:
this.accountsService.getAll().subscribe({ ... });
this.categoriesService.getAll().subscribe({ ... });
```

**Solución:** Inyectar `DestroyRef` y agregar `takeUntilDestroyed`:

```typescript
private readonly destroyRef = inject(DestroyRef);

this.accountsService.getAll().pipe(
  takeUntilDestroyed(this.destroyRef),
).subscribe({ ... });
```

---

### [ALTO-3] Patrón manual de carga paralela propenso a errores

**Archivo:** `components/transaction-form-dialog/transaction-form-dialog.component.ts` — líneas 299-333
**Problema:** Se usa un patrón manual con dos booleanos (`accountsLoaded`, `categoriesLoaded`) para coordinar dos requests paralelas. Tiene dos bugs:
1. Si ambas requests fallan, solo se muestra el error de categorías (pisa al de cuentas).
2. Si una request no termina nunca (timeout del servidor), `loadingData` nunca se setea en `false`, dejando el spinner infinito.

```typescript
// Frágil: coordina manualmente con flags booleanos
let accountsLoaded = false;
let categoriesLoaded = false;
const checkDone = () => { if (accountsLoaded && categoriesLoaded) { ... } };
```

**Solución:** Usar `forkJoin` que resuelve correctamente ambos casos:

```typescript
import { forkJoin } from 'rxjs';

forkJoin({
  accounts: this.accountsService.getAll(),
  categories: this.categoriesService.getAll(),
}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
  next: ({ accounts, categories }) => {
    this.accounts.set(accounts);
    this.categories.set(categories);
    this.loadingData.set(false);
  },
  error: (err) => {
    this.errorMessage.set(err?.error?.message ?? 'Error al cargar los datos');
    this.loadingData.set(false);
  },
});
```

---

### [ALTO-4] Subscriptions de `afterClosed()` sin `takeUntilDestroyed`

**Archivo:** `pages/transactions/transactions.component.ts` — líneas 173, 188, 204
**Problema:** Aunque `afterClosed()` completa automáticamente al emitir, las subscriptions abiertas mientras el componente está activo no se limpian si el componente se destruye antes de que el dialog cierre (por ejemplo, si se navega fuera con el dialog abierto). Los callbacks `next` podrían ejecutarse después de que el componente fue destruido.

```typescript
// Sin protección:
dialogRef.afterClosed().subscribe((result) => { ... });
```

**Solución:**

```typescript
dialogRef.afterClosed()
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((result) => { ... });
```

---

## MEDIO

### [MEDIO-1] Categorías en filtros no se filtran por tipo seleccionado

**Archivo:** `pages/transactions/transactions.component.html` — líneas 51-58
**Problema:** El `<mat-select>` de "Categoría" en el formulario de filtros muestra todas las categorías sin importar el tipo seleccionado. El usuario puede filtrar por `type: INCOME` y `categoryId` de una categoría de tipo `EXPENSE`, obteniendo 0 resultados sin entender por qué.

**Solución:** Agregar una computed signal en el componente que filtre categorías según el tipo activo en el formulario de filtros, similar a como lo hace el dialog.

---

### [MEDIO-2] Sin validación de rango de fechas en filtros

**Archivo:** `pages/transactions/transactions.component.ts` — líneas 125-135
**Problema:** No se valida que `dateFrom <= dateTo`. El usuario puede ingresar `dateFrom = 2026-03-17` y `dateTo = 2026-01-01`, lo que produce resultados vacíos sin feedback claro de por qué.

**Solución:** Agregar un validator cruzado al `filterForm` o validar en `applyFilters()` antes de llamar a `loadTransactions()`, mostrando un mensaje de error descriptivo.

---

### [MEDIO-3] Empty state no distingue "sin datos" de "sin resultados con filtros"

**Archivo:** `pages/transactions/transactions.component.html` — líneas 89-98
**Problema:** El mensaje "Sin transacciones registradas" y el CTA "Registrá tu primera transacción" se muestran tanto cuando no hay ninguna transacción como cuando los filtros activos no retornan resultados. En el segundo caso, el mensaje es confuso y el botón de "Registrar" no es la acción correcta.

**Solución:** Verificar si hay filtros activos y mostrar un mensaje diferenciado:
- Sin filtros + sin datos: "Registrá tu primera transacción" (CTA crear)
- Con filtros + sin resultados: "No hay transacciones con los filtros aplicados" (CTA limpiar filtros)

---

### [MEDIO-4] `delete()` en el servicio inconsistente con el contrato del backend

**Archivo:** `services/transactions.service.ts` — línea 65
**Problema:** El backend siempre retorna `{ statusCode, message, data }` según el contrato documentado, pero `delete` está tipado como `Observable<void>` y no mapea el response. Esto es inconsistente con los otros métodos del servicio y podría romper si el backend alguna vez incluye datos en el cuerpo del DELETE.

```typescript
// Inconsistente con el resto del servicio:
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

### [MEDIO-5] Sin `trackBy` en la tabla de transacciones

**Archivo:** `pages/transactions/transactions.component.html` — línea 103
**Problema:** La `mat-table` no tiene función `trackBy`. Cada vez que se actualiza el signal `transactions`, Angular re-renderiza todas las filas de la tabla aunque solo cambió una. Con 50 filas y paginación frecuente, esto impacta performance.

**Solución:**

```typescript
// En el componente:
readonly trackByTransactionId = (_index: number, tx: Transaction) => tx.id;
```

```html
<!-- En el template: -->
<table mat-table [dataSource]="transactions()" [trackBy]="trackByTransactionId" ...>
```

---

### [MEDIO-6] `TransactionAccount.type` tipado como `string` genérico

**Archivo:** `models/transaction.models.ts` — línea 11
**Problema:** `type: string` en `TransactionAccount` debería ser `AccountType` (`'CASH' | 'BANK' | 'CREDIT' | 'VIRTUAL'`) para consistencia con el modelo de accounts y seguridad de tipos. Actualmente, cualquier string pasa el compilador.

**Solución:**

```typescript
import type { AccountType } from '../../accounts/models/account.models';

export interface TransactionAccount {
  id: number;
  name: string;
  type: AccountType; // era: string
  currency: string;
}
```

---

### [MEDIO-7] `formatDate` con locale hardcodeado `'en-US'`

**Archivo:** `pages/transactions/transactions.component.ts` — línea 123
**Problema:** `formatDate(d, 'yyyy-MM-dd', 'en-US')` ignora el locale configurado en `app.config.ts` (`es-AR`). Aunque para `yyyy-MM-dd` el resultado es el mismo, es una inconsistencia que puede introducir bugs con otros formatos.

**Solución:** Usar `LOCALE_ID` inyectado o simplemente `d.toISOString().slice(0, 10)` que es independiente de locale y produce exactamente `yyyy-MM-dd`.

---

## BAJO

### [BAJO-1] `getById()` en el servicio es dead code

**Archivo:** `services/transactions.service.ts` — línea 46
**Problema:** El método `getById(id)` existe en el servicio pero no se usa en ningún componente del módulo. Es código muerto que aumenta la superficie de mantenimiento.

**Solución:** Eliminar el método hasta que sea necesario, o documentar su uso futuro previsto.

---

### [BAJO-2] `ViewEncapsulation.None` en el dialog expone estilos globalmente

**Archivo:** `components/transaction-form-dialog/transaction-form-dialog.component.ts` — línea 31
**Problema:** `ViewEncapsulation.None` hace que los estilos del dialog (`.full-width`, `.error-message`, `.select-search-wrapper`, etc.) se apliquen globalmente. Clases genéricas como `.full-width` o `.error-message` pueden colisionar con otros componentes.

**Solución:** Eliminar `ViewEncapsulation.None` (usar el default `Emulated`) y reemplazar las clases genéricas por nombres específicos como `.transaction-form-full-width`, o usar `:host` para scoping.

---

### [BAJO-3] `toYMD` definida inline dentro de `loadTransactions()`

**Archivo:** `pages/transactions/transactions.component.ts` — línea 123
**Problema:** La función helper `toYMD` se crea como una nueva función en cada invocación de `loadTransactions()`. Debería ser un método privado del componente.

```typescript
// Actual: recrea la función en cada llamada
const toYMD = (d: Date): string => formatDate(d, 'yyyy-MM-dd', 'en-US');
```

**Solución:**

```typescript
private toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

---

### [BAJO-4] Accesibilidad: empty state sin rol semántico

**Archivo:** `pages/transactions/transactions.component.html` — línea 90
**Problema:** El div del empty state no tiene `role="status"` ni `aria-live`, por lo que los lectores de pantalla no anuncian el cambio de estado cuando los resultados quedan vacíos tras aplicar filtros.

**Solución:**

```html
<div class="empty-state" role="status" aria-live="polite">
  ...
</div>
```

---

### [BAJO-5] Error silencioso en `loadCategories()` sin feedback al usuario

**Archivo:** `pages/transactions/transactions.component.ts` — líneas 104-108
**Problema:** Si `loadCategories()` falla, el error es completamente silencioso. El filtro de categoría aparece vacío y el usuario no sabe si no tiene categorías o si hubo un error de red. El comentario `/* silencioso: el filtro simplemente queda vacío */` lo documenta como intencional, pero degrada la experiencia de usuario.

**Solución:** Agregar un tooltip o placeholder en el select que indique "No se pudieron cargar las categorías" cuando el array quede vacío por error.

---

## Resumen de issues

| Severidad | Cantidad | Issues |
|-----------|----------|--------|
| ALTO      | 4        | Race condition HTTP, subscriptions sin ciclo de vida en dialog, patrón manual vs forkJoin, afterClosed sin takeUntilDestroyed |
| MEDIO     | 7        | Filtro categorías, validación fechas, empty state, delete service, trackBy, TransactionAccount.type, formatDate locale |
| BAJO      | 5        | Dead code getById, ViewEncapsulation.None, toYMD inline, aria empty state, loadCategories silencioso |

**Prioridad de resolución recomendada:** ALTO-1 (race condition) → ALTO-2 y ALTO-3 (memory/lifecycle en dialog, se pueden resolver juntos) → MEDIO-3 (empty state, fácil quick win) → resto de MEDIOs.

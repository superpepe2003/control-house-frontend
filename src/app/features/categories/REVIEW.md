# Code Review — Módulo Categories

**Fecha:** 2026-03-17
**Archivos revisados:**
- `categories.routes.ts`
- `models/category.models.ts`
- `services/categories.service.ts`
- `pages/categories/categories.component.ts`
- `pages/categories/categories.component.html`
- `components/category-form-dialog/category-form-dialog.component.ts`
- `components/delete-confirm-dialog/delete-confirm-dialog.component.ts`

---

## ALTO

### [ALTO-1] Memory leak: subscriptions HTTP sin `takeUntilDestroyed`
**Archivos:** `categories.component.ts` líneas 72 y 136

`loadCategories()` y `deleteCategory()` hacen `.subscribe()` sin limpiar la suscripción si el componente se destruye antes de que el request termine (ej: usuario navega a otra ruta). Aunque con signals el riesgo de crash es menor que con `detectChanges()`, el request sigue ejecutándose en background, el estado se actualiza en un componente destruido y puede generar comportamientos inesperados al volver.

```ts
// ❌ Actual
this.categoriesService.getAll().subscribe({ ... });

// ✅ Correcto
private readonly destroyRef = inject(DestroyRef);

this.categoriesService.getAll().pipe(
  takeUntilDestroyed(this.destroyRef)
).subscribe({ ... });
```

**Aplica también a:** `deleteCategory()` (línea 136).

---

### [ALTO-2] Race condition en `loadCategories` al reintentar
**Archivo:** `categories.component.ts` línea 68

Si el usuario hace click en "Reintentar" varias veces rápido, o si se llama a `loadCategories()` mientras ya hay una request en vuelo, se lanzan múltiples requests concurrentes. La última en llegar "gana" y sobreescribe el estado, lo que puede mostrar datos inconsistentes. Se debe cancelar el request anterior con `switchMap` o bloquear con un flag.

```ts
// ❌ Actual: no hay cancelación del request anterior
loadCategories(): void {
  this.loading.set(true);
  this.categoriesService.getAll().subscribe({ ... });
}

// ✅ Opción simple: deshabilitar el botón de reintento mientras carga
// (el template ya muestra loading, pero el botón "Reintentar" en el estado
// de error sí está siempre habilitado)

// ✅ Opción robusta: usar un Subject + switchMap en el servicio o el componente
```

Como mínimo, el botón "Reintentar" en el template debería estar deshabilitado mientras `loading()` es `true`, pero ese caso no puede ocurrir porque el error state y el loading state son mutuamente excluyentes. El riesgo real es una llamada programática desde otro lugar. Documentar o agregar el guard `if (this.loading()) return;` al inicio de `loadCategories()`.

---

## MEDIO

### [MEDIO-1] Template duplicado: tablas de ingresos y gastos son idénticas
**Archivo:** `categories.component.html` líneas 65–103 y 122–160

Las dos tablas (`mat-table`) tienen exactamente el mismo markup con las mismas columnas y el mismo comportamiento. Solo cambian `dataSource` y `aria-label`. Esto viola el principio DRY y hace que cualquier cambio (agregar columna, cambiar estilo) tenga que hacerse en dos lugares.

**Solución sugerida:** Extraer un componente `CategoryTableComponent` que reciba `categories: Category[]` y `ariaLabel: string` como inputs.

---

### [MEDIO-2] Sin loading/disabled state durante la operación de delete
**Archivo:** `categories.component.ts` línea 135

Al confirmar el delete, los botones de editar y eliminar de otras filas quedan habilitados mientras el request HTTP está en curso. Si el usuario hace click en eliminar otra categoría antes de que el primer delete finalice, se lanzan dos deletes concurrentes. No hay indicación visual de que algo está procesándose.

**Solución:** Agregar un signal `deletingId = signal<number | null>(null)` y deshabilitar los botones correspondientes en el template.

---

### [MEDIO-3] `delete()` en el service no mapea el `ApiResponse` wrapper
**Archivo:** `services/categories.service.ts` línea 31

Todos los métodos del servicio hacen `.pipe(map(r => r.data))` para extraer el payload de `ApiResponse<T>`, excepto `delete`. Si el backend devuelve el wrapper `{ statusCode, message, data }` en el DELETE (como lo hace en el resto de los endpoints según el CLAUDE.md), el método es inconsistente y el tipo de retorno sería incorrecto.

```ts
// ❌ Actual
delete(id: number): Observable<void> {
  return this.http.delete<void>(`${this.baseUrl}/${id}`);
}

// ✅ Correcto (si el backend retorna el wrapper)
delete(id: number): Observable<void> {
  return this.http
    .delete<ApiResponse<null>>(`${this.baseUrl}/${id}`)
    .pipe(map(() => void 0));
}
```

Verificar contra el contrato real del backend.

---

### [MEDIO-4] `loading` no se resetea en el path de éxito en `CategoryFormDialogComponent`
**Archivo:** `category-form-dialog.component.ts` líneas 142 y 151

En el callback `next`, se llama `this.dialogRef.close(category)` pero **no** `this.loading.set(false)`. En la práctica el dialog se cierra inmediatamente y el estado se destruye, por lo que no hay bug visible. Sin embargo, si el cierre del dialog fallara o si el componente se reutilizara, el estado quedaría corrupto.

```ts
// ✅ Agregar loading.set(false) antes del close
next: (category) => {
  this.loading.set(false);
  this.dialogRef.close(category);
},
```

---

### [MEDIO-5] `ApiResponse<T>` duplicada en el servicio
**Archivo:** `services/categories.service.ts` línea 7

La interfaz `ApiResponse<T>` probablemente existe en `accounts.service.ts`, `transactions.service.ts`, etc. Debería vivir en un archivo compartido (ej: `src/app/core/models/api-response.model.ts`) e importarse desde ahí.

---

## BAJO

### [BAJO-1] Formulario no tipado explícitamente → casteos innecesarios
**Archivo:** `category-form-dialog.component.ts` líneas 136–137

```ts
// ❌ Actual — casteos defensivos porque el form no está tipado
const name = raw.name as string;
const type = raw.type as CategoryType;
```

Angular 14+ soporta formularios tipados. Tipar el `FormGroup` elimina estos casteos y provee autocompletado:

```ts
readonly form = this.fb.group({
  name: [
    this.data?.category?.name ?? '',
    [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
  ] as [string, ...ValidatorFn[]],
  type: [
    this.data?.category?.type ?? 'EXPENSE' as CategoryType,
    Validators.required,
  ] as [CategoryType, ...ValidatorFn[]],
});
// raw.name es string, raw.type es CategoryType — sin casteos
```

---

### [BAJO-2] Columna "type" en la tabla es redundante
**Archivo:** `categories.component.html` líneas 71–75 y 128–132

Cada tabla ya está dentro de una sección titulada "Ingresos" o "Gastos". La columna "Tipo" que muestra un chip estático ("Ingreso" o "Gasto") siempre tiene el mismo valor para toda la tabla, porque la tabla está filtrada. Es ruido visual que ocupa espacio y no aporta información.

**Sugerencia:** Eliminar la columna `type` de `displayedColumns` dentro de cada sección, o mantenerla solo en una vista unificada sin secciones.

---

### [BAJO-3] Botones inline "Agregar una" en secciones vacías sin contexto de accesibilidad
**Archivo:** `categories.component.html` líneas 63 y 120

```html
<p class="section-empty">Sin categorías de ingreso. <button mat-button (click)="openCreateDialog()">Agregar una</button></p>
```

El texto "Agregar una" fuera de contexto (para un lector de pantalla que navega por botones) no es descriptivo. Agregar `aria-label`:

```html
<button mat-button (click)="openCreateDialog()" aria-label="Agregar categoría de ingreso">Agregar una</button>
```

---

### [BAJO-4] `loadCategories` se llama como método público innecesariamente
**Archivo:** `categories.component.ts` línea 68

`loadCategories()` es `public` (sin modificador de acceso) pero solo se usa internamente y desde el template (botón "Reintentar"). El template puede acceder a métodos privados en Angular, así que no es bloqueante, pero marcar métodos internos como `private` cuando corresponde mejora la legibilidad del API del componente. Sin embargo, dado que el template lo invoca, mantenerlo `protected` o sin modificador es aceptable; documentarlo es suficiente.

---

## Resumen

| ID | Severidad | Descripción | Archivo |
|----|-----------|-------------|---------|
| ALTO-1 | 🔴 ALTO | Memory leak: sin `takeUntilDestroyed` en requests HTTP | `categories.component.ts` |
| ALTO-2 | 🔴 ALTO | Race condition al reintentar carga | `categories.component.ts` |
| MEDIO-1 | 🟡 MEDIO | Template duplicado: dos tablas idénticas | `categories.component.html` |
| MEDIO-2 | 🟡 MEDIO | Sin loading/disabled durante delete | `categories.component.ts` |
| MEDIO-3 | 🟡 MEDIO | `delete()` no mapea ApiResponse | `categories.service.ts` |
| MEDIO-4 | 🟡 MEDIO | `loading` no se resetea en éxito del dialog | `category-form-dialog.component.ts` |
| MEDIO-5 | 🟡 MEDIO | `ApiResponse<T>` duplicada, debería estar en core | `categories.service.ts` |
| BAJO-1 | 🟢 BAJO | Formulario sin tipado fuerte → casteos innecesarios | `category-form-dialog.component.ts` |
| BAJO-2 | 🟢 BAJO | Columna "tipo" redundante en tablas por sección | `categories.component.html` |
| BAJO-3 | 🟢 BAJO | Botones inline sin `aria-label` descriptivo | `categories.component.html` |
| BAJO-4 | 🟢 BAJO | `loadCategories` podría ser `protected` | `categories.component.ts` |

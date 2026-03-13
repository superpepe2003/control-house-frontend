import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Category, CategoryType, CreateCategoryRequest, UpdateCategoryRequest } from '../../models/category.models';
import { CategoriesService } from '../../services/categories.service';

export interface CategoryFormDialogData {
  category?: Category;
}

const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

@Component({
  selector: 'app-category-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Editar categoría' : 'Nueva categoría' }}</h2>

    <mat-dialog-content>
      @if (errorMessage()) {
        <p class="error-message" role="alert">{{ errorMessage() }}</p>
      }

      <form [formGroup]="form" id="category-form" (ngSubmit)="submit()">
        <mat-form-field class="full-width">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" placeholder="Ej: Alimentación" />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
          @if (form.get('name')?.hasError('minlength') && form.get('name')?.touched) {
            <mat-error>Mínimo 2 caracteres</mat-error>
          }
          @if (form.get('name')?.hasError('maxlength') && form.get('name')?.touched) {
            <mat-error>Máximo 50 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type">
            @for (t of categoryTypes; track t.value) {
              <mat-option [value]="t.value">{{ t.label }}</mat-option>
            }
          </mat-select>
          @if (form.get('type')?.hasError('required') && form.get('type')?.touched) {
            <mat-error>El tipo es requerido</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button" [disabled]="loading()">Cancelar</button>
      <button
        mat-flat-button
        form="category-form"
        type="submit"
        [disabled]="form.invalid || loading()"
      >
        @if (loading()) {
          <mat-spinner diameter="20" />
        } @else {
          {{ isEdit ? 'Guardar cambios' : 'Crear categoría' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 320px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding-top: 8px;
    }

    .full-width {
      width: 100%;
    }

    .error-message {
      color: var(--mat-sys-error);
      font-size: 0.875rem;
      margin: 0 0 8px;
    }

    mat-spinner {
      display: inline-block;
    }
  `,
})
export class CategoryFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CategoryFormDialogComponent>);
  private readonly data = inject<CategoryFormDialogData>(MAT_DIALOG_DATA);
  private readonly categoriesService = inject(CategoriesService);

  readonly categoryTypes = CATEGORY_TYPES;
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isEdit = !!this.data?.category;

  readonly form = this.fb.group({
    name: [
      this.data?.category?.name ?? '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
    ],
    type: [this.data?.category?.type ?? ('EXPENSE' as CategoryType), Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const name = raw.name as string;
    const type = raw.type as CategoryType;

    if (this.isEdit) {
      const payload: UpdateCategoryRequest = { name, type };
      this.categoriesService.update(this.data.category!.id, payload).subscribe({
        next: (category) => this.dialogRef.close(category),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al actualizar la categoría');
          this.loading.set(false);
        },
      });
    } else {
      const payload: CreateCategoryRequest = { name, type };
      this.categoriesService.create(payload).subscribe({
        next: (category) => this.dialogRef.close(category),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al crear la categoría');
          this.loading.set(false);
        },
      });
    }
  }
}

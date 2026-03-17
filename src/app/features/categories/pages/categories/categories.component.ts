import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../auth/services/auth.service';
import { CategoriesService } from '../../services/categories.service';
import { Category } from '../../models/category.models';
import {
  CategoryFormDialogComponent,
  CategoryFormDialogData,
} from '../../components/category-form-dialog/category-form-dialog.component';
import {
  DeleteCategoryConfirmDialogComponent,
  DeleteCategoryConfirmDialogData,
} from '../../components/delete-confirm-dialog/delete-confirm-dialog.component';
import { CategoryTableComponent } from '../../components/category-table/category-table.component';

@Component({
  selector: 'app-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatDividerModule,
    CategoryTableComponent,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly deletingId = signal<number | null>(null);

  // Evita requests concurrentes al reintentar carga
  private loadInFlight = false;

  // Categorías separadas por tipo para mostrar en secciones
  readonly incomeCategories = computed(() =>
    this.categories().filter((c) => c.type === 'INCOME'),
  );
  readonly expenseCategories = computed(() =>
    this.categories().filter((c) => c.type === 'EXPENSE'),
  );

  ngOnInit(): void {
    this.loadCategories();
  }

  protected loadCategories(): void {
    if (this.loadInFlight) return;
    this.loadInFlight = true;
    this.loading.set(true);
    this.error.set(null);

    this.categoriesService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.loadInFlight = false;
          this.categories.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.loadInFlight = false;
          this.error.set(err?.error?.message ?? 'Error al cargar las categorías');
          this.loading.set(false);
        },
      });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<CategoryFormDialogComponent, CategoryFormDialogData, Category>(
      CategoryFormDialogComponent,
      { data: {} },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        // El backend retorna ordenado por tipo y nombre — insertamos y re-ordenamos
        this.categories.update((list) =>
          [...list, result].sort((a, b) =>
            a.type.localeCompare(b.type) || a.name.localeCompare(b.name),
          ),
        );
        this.snackBar.open('Categoría creada exitosamente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openEditDialog(category: Category): void {
    const dialogRef = this.dialog.open<CategoryFormDialogComponent, CategoryFormDialogData, Category>(
      CategoryFormDialogComponent,
      { data: { category } },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.categories.update((list) =>
          list
            .map((c) => (c.id === result.id ? result : c))
            .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)),
        );
        this.snackBar.open('Categoría actualizada exitosamente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  confirmDelete(category: Category): void {
    const dialogRef = this.dialog.open<
      DeleteCategoryConfirmDialogComponent,
      DeleteCategoryConfirmDialogData,
      boolean
    >(DeleteCategoryConfirmDialogComponent, { data: { categoryName: category.name } });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteCategory(category);
      }
    });
  }

  private deleteCategory(category: Category): void {
    this.deletingId.set(category.id);

    this.categoriesService
      .delete(category.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingId.set(null);
          this.categories.update((list) => list.filter((c) => c.id !== category.id));
          this.snackBar.open('Categoría eliminada', 'Cerrar', { duration: 3000 });
        },
        error: (err) => {
          this.deletingId.set(null);
          this.snackBar.open(
            err?.error?.message ?? 'Error al eliminar la categoría',
            'Cerrar',
            { duration: 4000 },
          );
        },
      });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}

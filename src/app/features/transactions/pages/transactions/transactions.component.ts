import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subject, switchMap } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../auth/services/auth.service';
import { TransactionsService } from '../../services/transactions.service';
import { CategoriesService } from '../../../categories/services/categories.service';
import { Category } from '../../../categories/models/category.models';
import { ListTransactionsParams, PaginationMeta, Transaction, TransactionType } from '../../models/transaction.models';
import {
  TransactionFormDialogComponent,
  TransactionFormDialogData,
} from '../../components/transaction-form-dialog/transaction-form-dialog.component';
import {
  TransactionDeleteConfirmDialogComponent,
  TransactionDeleteConfirmDialogData,
} from '../../components/delete-confirm-dialog/delete-confirm-dialog.component';

/** Validator de grupo: dateFrom no puede ser posterior a dateTo */
function dateRangeValidator(group: AbstractControl): ValidationErrors | null {
  const from = group.get('dateFrom')?.value as Date | null;
  const to = group.get('dateTo')?.value as Date | null;
  if (from && to && from > to) {
    return { dateRange: true };
  }
  return null;
}

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    CurrencyPipe,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './transactions.component.html',
  styleUrl: './transactions.component.scss',
})
export class TransactionsComponent implements OnInit {
  private readonly transactionsService = inject(TransactionsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);

  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  readonly displayedColumns = ['date', 'description', 'type', 'category', 'account', 'amount', 'actions'];

  readonly filterForm = this.fb.group(
    {
      type: ['' as TransactionType | ''],
      categoryId: [null as number | null],
      dateFrom: [null as Date | null],
      dateTo: [null as Date | null],
    },
    { validators: dateRangeValidator },
  );

  /** Categorías filtradas por el tipo seleccionado en el formulario de filtros */
  readonly filteredCategories = computed(() => {
    const selectedType = this.filterForm.get('type')?.value;
    const all = this.categories();
    if (!selectedType) return all;
    return all.filter((c) => c.type === selectedType);
  });

  /** Indica si hay algún filtro activo para mostrar el mensaje adecuado en el empty state */
  readonly hasActiveFilters = computed(() => {
    const v = this.filterForm.getRawValue();
    return !!(v.type || v.categoryId || v.dateFrom || v.dateTo);
  });

  /** Subject que emite los params de cada carga; switchMap cancela la request anterior */
  private readonly loadTrigger$ = new Subject<ListTransactionsParams>();

  readonly trackById = (_index: number, tx: Transaction): number => tx.id;

  ngOnInit(): void {
    // switchMap cancela automáticamente la request en vuelo cuando llega un nuevo trigger
    this.loadTrigger$
      .pipe(
        switchMap((params) => {
          this.loading.set(true);
          this.error.set(null);
          return this.transactionsService.getAll(params);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: ({ data, meta }) => {
          this.transactions.set(data);
          this.meta.set(meta);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Error al cargar las transacciones');
          this.loading.set(false);
        },
      });

    this.loadCategories();
    this.loadTransactions();

    // Recargar la lista al navegar de vuelta a esta página
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        filter((e) => e.urlAfterRedirects.startsWith('/transactions')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadTransactions());
  }

  loadCategories(): void {
    this.categoriesService.getAll().subscribe({
      next: (data) => this.categories.set(data),
      error: () => {
        this.snackBar.open(
          'No se pudieron cargar las categorías. El filtro por categoría no estará disponible.',
          'Cerrar',
          { duration: 5000 },
        );
      },
    });
  }

  loadTransactions(): void {
    const raw = this.filterForm.getRawValue();
    const params: ListTransactionsParams = {
      page: this.currentPage(),
      limit: this.pageSize(),
    };

    if (raw.type) params.type = raw.type as TransactionType;
    if (raw.categoryId) params.categoryId = raw.categoryId;

    if (raw.dateFrom && !raw.dateTo) {
      // Solo "desde": aplicar hasta hoy como límite superior
      params.dateFrom = this.toYMD(raw.dateFrom as Date);
      params.dateTo = this.toYMD(new Date());
    } else if (!raw.dateFrom && raw.dateTo) {
      // Solo "hasta": sin límite inferior
      params.dateTo = this.toYMD(raw.dateTo as Date);
    } else if (raw.dateFrom && raw.dateTo) {
      params.dateFrom = this.toYMD(raw.dateFrom as Date);
      params.dateTo = this.toYMD(raw.dateTo as Date);
    }

    this.loadTrigger$.next(params);
  }

  applyFilters(): void {
    if (this.filterForm.invalid) return;
    this.currentPage.set(1);
    this.loadTransactions();
  }

  clearFilters(): void {
    this.filterForm.reset({ type: '', categoryId: null, dateFrom: null, dateTo: null });
    this.currentPage.set(1);
    this.loadTransactions();
  }

  onPageChange(event: PageEvent): void {
    this.currentPage.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.loadTransactions();
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<TransactionFormDialogComponent, TransactionFormDialogData, Transaction>(
      TransactionFormDialogComponent,
      { data: {}, width: '480px' },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.snackBar.open('Transacción creada exitosamente', 'Cerrar', { duration: 3000 });
          this.currentPage.set(1);
          this.loadTransactions();
        }
      });
  }

  openEditDialog(transaction: Transaction): void {
    const dialogRef = this.dialog.open<TransactionFormDialogComponent, TransactionFormDialogData, Transaction>(
      TransactionFormDialogComponent,
      { data: { transaction }, width: '480px' },
    );

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        if (result) {
          this.snackBar.open('Transacción actualizada exitosamente', 'Cerrar', { duration: 3000 });
          this.loadTransactions();
        }
      });
  }

  confirmDelete(transaction: Transaction): void {
    const label = transaction.description ?? transaction.category.name;
    const dialogRef = this.dialog.open<
      TransactionDeleteConfirmDialogComponent,
      TransactionDeleteConfirmDialogData,
      boolean
    >(TransactionDeleteConfirmDialogComponent, { data: { description: label } });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (confirmed) {
          this.deleteTransaction(transaction);
        }
      });
  }

  private deleteTransaction(transaction: Transaction): void {
    this.transactionsService.delete(transaction.id).subscribe({
      next: () => {
        this.snackBar.open('Transacción eliminada y balance revertido', 'Cerrar', { duration: 3000 });
        // Si era la última en la página actual y no es la primera, retroceder
        if (this.transactions().length === 1 && this.currentPage() > 1) {
          this.currentPage.update((p) => p - 1);
        }
        this.loadTransactions();
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message ?? 'Error al eliminar la transacción',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  /** Convierte un Date a string yyyy-MM-dd usando el locale configurado */
  private toYMD(d: Date): string {
    return formatDate(d, 'yyyy-MM-dd', this.locale);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}

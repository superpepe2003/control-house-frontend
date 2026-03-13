import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CurrencyPipe, DatePipe, formatDate } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
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

  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  readonly displayedColumns = ['date', 'description', 'type', 'category', 'account', 'amount', 'actions'];

  readonly filterForm = this.fb.group({
    type: ['' as TransactionType | ''],
    categoryId: [null as number | null],
    dateFrom: [null as Date | null],
    dateTo: [null as Date | null],
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadTransactions();

    // Recargar la lista al navegar de vuelta a esta página (por si el componente es reutilizado)
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
      error: () => { /* silencioso: el filtro simplemente queda vacío */ },
    });
  }

  loadTransactions(): void {
    this.loading.set(true);
    this.error.set(null);

    const raw = this.filterForm.getRawValue();
    const params: ListTransactionsParams = {
      page: this.currentPage(),
      limit: this.pageSize(),
    };

    if (raw.type) params.type = raw.type as TransactionType;
    if (raw.categoryId) params.categoryId = raw.categoryId;

    const toYMD = (d: Date): string => formatDate(d, 'yyyy-MM-dd', 'en-US');

    if (raw.dateFrom && !raw.dateTo) {
      // Solo "desde": aplicar hasta hoy como límite superior
      params.dateFrom = toYMD(raw.dateFrom as Date);
      params.dateTo = toYMD(new Date());
    } else if (!raw.dateFrom && raw.dateTo) {
      // Solo "hasta": sin límite inferior
      params.dateTo = toYMD(raw.dateTo as Date);
    } else if (raw.dateFrom && raw.dateTo) {
      params.dateFrom = toYMD(raw.dateFrom as Date);
      params.dateTo = toYMD(raw.dateTo as Date);
    }

    this.transactionsService.getAll(params).subscribe({
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
  }

  applyFilters(): void {
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

    dialogRef.afterClosed().subscribe((result) => {
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

    dialogRef.afterClosed().subscribe((result) => {
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

    dialogRef.afterClosed().subscribe((confirmed) => {
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

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}

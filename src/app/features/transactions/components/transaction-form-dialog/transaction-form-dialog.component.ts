import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { AccountsService } from '../../../accounts/services/accounts.service';
import { CategoriesService } from '../../../categories/services/categories.service';
import { Account } from '../../../accounts/models/account.models';
import { Category } from '../../../categories/models/category.models';
import {
  CreateTransactionRequest,
  Transaction,
  TransactionType,
  UpdateTransactionRequest,
} from '../../models/transaction.models';
import { TransactionsService } from '../../services/transactions.service';

export interface TransactionFormDialogData {
  transaction?: Transaction;
}

@Component({
  selector: 'app-transaction-form-dialog',
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
    <h2 mat-dialog-title>{{ isEdit ? 'Editar transacción' : 'Nueva transacción' }}</h2>

    <mat-dialog-content>
      @if (errorMessage()) {
        <p class="error-message" role="alert">{{ errorMessage() }}</p>
      }

      @if (loadingData()) {
        <div class="loading-data" aria-live="polite" aria-label="Cargando datos">
          <mat-spinner diameter="32" />
        </div>
      } @else {
        <form [formGroup]="form" id="transaction-form" (ngSubmit)="submit()">
          <mat-form-field class="full-width">
            <mat-label>Tipo</mat-label>
            <mat-select formControlName="type" (selectionChange)="onTypeChange()">
              <mat-option value="INCOME">Ingreso</mat-option>
              <mat-option value="EXPENSE">Gasto</mat-option>
            </mat-select>
            @if (form.get('type')?.hasError('required') && form.get('type')?.touched) {
              <mat-error>El tipo es requerido</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Cuenta</mat-label>
            <mat-select formControlName="accountId">
              @for (account of accounts(); track account.id) {
                <mat-option [value]="account.id">{{ account.name }}</mat-option>
              }
            </mat-select>
            @if (form.get('accountId')?.hasError('required') && form.get('accountId')?.touched) {
              <mat-error>La cuenta es requerida</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="categoryId">
              @for (cat of filteredCategories(); track cat.id) {
                <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
              }
              @if (filteredCategories().length === 0) {
                <mat-option disabled>No hay categorías para este tipo</mat-option>
              }
            </mat-select>
            @if (form.get('categoryId')?.hasError('required') && form.get('categoryId')?.touched) {
              <mat-error>La categoría es requerida</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Monto</mat-label>
            <input matInput type="number" formControlName="amount" placeholder="0.00" min="0.01" step="0.01" />
            @if (form.get('amount')?.hasError('required') && form.get('amount')?.touched) {
              <mat-error>El monto es requerido</mat-error>
            }
            @if (form.get('amount')?.hasError('min') && form.get('amount')?.touched) {
              <mat-error>El monto debe ser mayor a 0</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Descripción (opcional)</mat-label>
            <input matInput formControlName="description" placeholder="Ej: Almuerzo en restaurante" maxlength="255" />
            @if (form.get('description')?.hasError('maxlength')) {
              <mat-error>Máximo 255 caracteres</mat-error>
            }
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Fecha</mat-label>
            <input matInput type="date" formControlName="date" />
            @if (form.get('date')?.hasError('required') && form.get('date')?.touched) {
              <mat-error>La fecha es requerida</mat-error>
            }
          </mat-form-field>
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button" [disabled]="loading()">Cancelar</button>
      <button
        mat-flat-button
        form="transaction-form"
        type="submit"
        [disabled]="form.invalid || loading() || loadingData()"
      >
        @if (loading()) {
          <mat-spinner diameter="20" />
        } @else {
          {{ isEdit ? 'Guardar cambios' : 'Crear transacción' }}
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 340px;
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

    .loading-data {
      display: flex;
      justify-content: center;
      padding: 32px 0;
    }

    mat-spinner {
      display: inline-block;
    }
  `,
})
export class TransactionFormDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<TransactionFormDialogComponent>);
  private readonly data = inject<TransactionFormDialogData>(MAT_DIALOG_DATA);
  private readonly transactionsService = inject(TransactionsService);
  private readonly accountsService = inject(AccountsService);
  private readonly categoriesService = inject(CategoriesService);

  readonly loading = signal(false);
  readonly loadingData = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly accounts = signal<Account[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly isEdit = !!this.data?.transaction;

  // Fecha formateada como "YYYY-MM-DD" para el input[type=date]
  private readonly initialDate = this.data?.transaction
    ? this.data.transaction.date.substring(0, 10)
    : '';

  readonly form = this.fb.group({
    type: [
      (this.data?.transaction?.type ?? 'EXPENSE') as TransactionType,
      Validators.required,
    ],
    accountId: [this.data?.transaction?.accountId ?? (null as number | null), Validators.required],
    categoryId: [this.data?.transaction?.categoryId ?? (null as number | null), Validators.required],
    amount: [
      this.data?.transaction?.amount ?? (null as number | null),
      [Validators.required, Validators.min(0.01)],
    ],
    description: [
      this.data?.transaction?.description ?? '',
      Validators.maxLength(255),
    ],
    date: [this.initialDate, Validators.required],
  });

  // Convierte el valueChanges del type a signal para filtrar categorías reactivamente
  readonly selectedType = toSignal(
    this.form.get('type')!.valueChanges.pipe(
      startWith(this.form.get('type')!.value as TransactionType),
    ),
    { initialValue: (this.data?.transaction?.type ?? 'EXPENSE') as TransactionType },
  );

  readonly filteredCategories = computed(() =>
    this.categories().filter((c) => c.type === this.selectedType()),
  );

  ngOnInit(): void {
    this.loadData();
  }

  // Cuando cambia el tipo, limpia la categoría seleccionada
  onTypeChange(): void {
    this.form.patchValue({ categoryId: null });
  }

  private loadData(): void {
    this.loadingData.set(true);

    // Carga cuentas y categorías en paralelo
    let accountsLoaded = false;
    let categoriesLoaded = false;

    const checkDone = () => {
      if (accountsLoaded && categoriesLoaded) {
        this.loadingData.set(false);
      }
    };

    this.accountsService.getAll().subscribe({
      next: (data) => {
        this.accounts.set(data);
        accountsLoaded = true;
        checkDone();
      },
      error: () => {
        this.errorMessage.set('Error al cargar las cuentas');
        accountsLoaded = true;
        checkDone();
      },
    });

    this.categoriesService.getAll().subscribe({
      next: (data) => {
        this.categories.set(data);
        categoriesLoaded = true;
        checkDone();
      },
      error: () => {
        this.errorMessage.set('Error al cargar las categorías');
        categoriesLoaded = true;
        checkDone();
      },
    });
  }

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    if (this.isEdit) {
      const payload: UpdateTransactionRequest = {
        amount: raw.amount as number,
        description: raw.description ?? undefined,
        date: raw.date as string,
        type: raw.type as TransactionType,
        categoryId: raw.categoryId as number,
        accountId: raw.accountId as number,
      };

      this.transactionsService.update(this.data.transaction!.id, payload).subscribe({
        next: (transaction) => this.dialogRef.close(transaction),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al actualizar la transacción');
          this.loading.set(false);
        },
      });
    } else {
      const payload: CreateTransactionRequest = {
        amount: raw.amount as number,
        description: raw.description ?? undefined,
        date: raw.date as string,
        type: raw.type as TransactionType,
        categoryId: raw.categoryId as number,
        accountId: raw.accountId as number,
      };

      this.transactionsService.create(payload).subscribe({
        next: (transaction) => this.dialogRef.close(transaction),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al crear la transacción');
          this.loading.set(false);
        },
      });
    }
  }
}

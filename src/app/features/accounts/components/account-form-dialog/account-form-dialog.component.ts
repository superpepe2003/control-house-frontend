import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Account, AccountType, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.models';
import { AccountsService } from '../../services/accounts.service';

export interface AccountFormDialogData {
  account?: Account;
}

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'CASH', label: 'Efectivo' },
  { value: 'BANK', label: 'Cuenta bancaria' },
  { value: 'CREDIT', label: 'Tarjeta de crédito' },
  { value: 'VIRTUAL', label: 'Billetera virtual' },
];

export const CURRENCIES = ['USD', 'PYG', 'ARS', 'EUR', 'BRL'];

@Component({
  selector: 'app-account-form-dialog',
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
    <h2 mat-dialog-title>{{ isEdit ? 'Editar cuenta' : 'Nueva cuenta' }}</h2>

    <mat-dialog-content>
      @if (errorMessage()) {
        <p class="error-message" role="alert">{{ errorMessage() }}</p>
      }

      <form [formGroup]="form" id="account-form" (ngSubmit)="submit()">
        <mat-form-field class="full-width">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" placeholder="Ej: Cuenta corriente" />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>El nombre es requerido</mat-error>
          }
          @if (form.get('name')?.hasError('minlength') && form.get('name')?.touched) {
            <mat-error>Mínimo 2 caracteres</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Tipo de cuenta</mat-label>
          <mat-select formControlName="type">
            @for (t of accountTypes; track t.value) {
              <mat-option [value]="t.value">{{ t.label }}</mat-option>
            }
          </mat-select>
          @if (form.get('type')?.hasError('required') && form.get('type')?.touched) {
            <mat-error>El tipo es requerido</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Balance inicial</mat-label>
          <input matInput type="number" formControlName="balance" placeholder="0" />
          @if (form.get('balance')?.hasError('min') && form.get('balance')?.touched) {
            <mat-error>El balance no puede ser negativo</mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label>Moneda</mat-label>
          <mat-select formControlName="currency">
            @for (c of currencies; track c) {
              <mat-option [value]="c">{{ c }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button" [disabled]="loading()">Cancelar</button>
      <button
        mat-flat-button
        form="account-form"
        type="submit"
        [disabled]="form.invalid || loading()"
      >
        @if (loading()) {
          <mat-spinner diameter="20" />
        } @else {
          {{ isEdit ? 'Guardar cambios' : 'Crear cuenta' }}
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
export class AccountFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<AccountFormDialogComponent>);
  private readonly data = inject<AccountFormDialogData>(MAT_DIALOG_DATA);
  private readonly accountsService = inject(AccountsService);

  readonly accountTypes = ACCOUNT_TYPES;
  readonly currencies = CURRENCIES;

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly isEdit = !!this.data?.account;

  readonly form = this.fb.group({
    name: [this.data?.account?.name ?? '', [Validators.required, Validators.minLength(2)]],
    type: [this.data?.account?.type ?? ('CASH' as AccountType), Validators.required],
    balance: [this.data?.account?.balance ?? 0, Validators.min(0)],
    currency: [this.data?.account?.currency ?? 'ARS'],
  });

  submit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const name = raw.name as string;
    const type = raw.type as AccountType;
    const balance = raw.balance as number;
    const currency = raw.currency as string;

    if (this.isEdit) {
      const payload: UpdateAccountRequest = { name, type, balance, currency };
      this.accountsService.update(this.data.account!.id, payload).subscribe({
        next: (account) => this.dialogRef.close(account),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al actualizar la cuenta');
          this.loading.set(false);
        },
      });
    } else {
      const payload: CreateAccountRequest = { name, type, balance, currency };
      this.accountsService.create(payload).subscribe({
        next: (account) => this.dialogRef.close(account),
        error: (err) => {
          this.errorMessage.set(err?.error?.message ?? 'Error al crear la cuenta');
          this.loading.set(false);
        },
      });
    }
  }
}

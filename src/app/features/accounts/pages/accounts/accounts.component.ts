import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../../auth/services/auth.service';
import { AccountsService } from '../../services/accounts.service';
import { Account } from '../../models/account.models';
import {
  AccountFormDialogComponent,
  AccountFormDialogData,
} from '../../components/account-form-dialog/account-form-dialog.component';
import {
  DeleteConfirmDialogComponent,
  DeleteConfirmDialogData,
} from '../../components/delete-confirm-dialog/delete-confirm-dialog.component';

const TYPE_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  BANK: 'Banco',
  CREDIT: 'Crédito',
  VIRTUAL: 'Virtual',
};

const TYPE_ICONS: Record<string, string> = {
  CASH: 'account_balance_wallet',
  BANK: 'account_balance',
  CREDIT: 'credit_card',
  VIRTUAL: 'smartphone',
};

@Component({
  selector: 'app-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  templateUrl: './accounts.component.html',
  styleUrl: './accounts.component.scss',
})
export class AccountsComponent implements OnInit {
  private readonly accountsService = inject(AccountsService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);

  readonly accounts = signal<Account[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly typeLabels = TYPE_LABELS;
  readonly typeIcons = TYPE_ICONS;

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.loading.set(true);
    this.error.set(null);

    this.accountsService.getAll().subscribe({
      next: (data) => {
        this.accounts.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Error al cargar las cuentas');
        this.loading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open<AccountFormDialogComponent, AccountFormDialogData, Account>(
      AccountFormDialogComponent,
      { data: {} },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.accounts.update((list) => [...list, result]);
        this.snackBar.open('Cuenta creada exitosamente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  openEditDialog(account: Account): void {
    const dialogRef = this.dialog.open<AccountFormDialogComponent, AccountFormDialogData, Account>(
      AccountFormDialogComponent,
      { data: { account } },
    );

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.accounts.update((list) => list.map((a) => (a.id === result.id ? result : a)));
        this.snackBar.open('Cuenta actualizada exitosamente', 'Cerrar', { duration: 3000 });
      }
    });
  }

  confirmDelete(account: Account): void {
    const dialogRef = this.dialog.open<DeleteConfirmDialogComponent, DeleteConfirmDialogData, boolean>(
      DeleteConfirmDialogComponent,
      { data: { accountName: account.name } },
    );

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.deleteAccount(account);
      }
    });
  }

  private deleteAccount(account: Account): void {
    this.accountsService.delete(account.id).subscribe({
      next: () => {
        this.accounts.update((list) => list.filter((a) => a.id !== account.id));
        this.snackBar.open('Cuenta eliminada', 'Cerrar', { duration: 3000 });
      },
      error: (err) => {
        this.snackBar.open(
          err?.error?.message ?? 'Error al eliminar la cuenta',
          'Cerrar',
          { duration: 4000 },
        );
      },
    });
  }

  logout(): void {
    this.authService.logout();
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  totalBalance(): number {
    return this.accounts().reduce((sum, a) => sum + a.balance, 0);
  }
}

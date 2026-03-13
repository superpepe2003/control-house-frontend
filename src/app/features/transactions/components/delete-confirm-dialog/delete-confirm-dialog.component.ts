import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface TransactionDeleteConfirmDialogData {
  description: string;
}

@Component({
  selector: 'app-transaction-delete-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Eliminar transacción</h2>
    <mat-dialog-content>
      <p>
        ¿Estás seguro de que querés eliminar la transacción
        <strong>{{ data.description }}</strong>?
      </p>
      <p>Esta acción no se puede deshacer y el balance de la cuenta será revertido.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">Eliminar</button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      min-width: 300px;
    }
  `,
})
export class TransactionDeleteConfirmDialogComponent {
  readonly data = inject<TransactionDeleteConfirmDialogData>(MAT_DIALOG_DATA);
}

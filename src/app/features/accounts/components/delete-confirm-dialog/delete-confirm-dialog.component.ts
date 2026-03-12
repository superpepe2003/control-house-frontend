import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DeleteConfirmDialogData {
  accountName: string;
}

@Component({
  selector: 'app-delete-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Eliminar cuenta</h2>
    <mat-dialog-content>
      <p>
        ¿Estás seguro de que querés eliminar la cuenta
        <strong>{{ data.accountName }}</strong>?
      </p>
      <p>Esta acción no se puede deshacer.</p>
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
export class DeleteConfirmDialogComponent {
  readonly data = inject<DeleteConfirmDialogData>(MAT_DIALOG_DATA);
}

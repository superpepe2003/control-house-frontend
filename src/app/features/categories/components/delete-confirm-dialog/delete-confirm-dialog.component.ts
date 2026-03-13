import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

export interface DeleteCategoryConfirmDialogData {
  categoryName: string;
}

@Component({
  selector: 'app-delete-category-confirm-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Eliminar categoría</h2>
    <mat-dialog-content>
      <p>
        ¿Estás seguro de que querés eliminar la categoría
        <strong>{{ data.categoryName }}</strong>?
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
export class DeleteCategoryConfirmDialogComponent {
  readonly data = inject<DeleteCategoryConfirmDialogData>(MAT_DIALOG_DATA);
}

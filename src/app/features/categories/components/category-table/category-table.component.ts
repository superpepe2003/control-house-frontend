import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Category } from '../../models/category.models';

@Component({
  selector: 'app-category-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule],
  template: `
    <table mat-table [dataSource]="categories()" class="category-table" [attr.aria-label]="ariaLabel()">
      <ng-container matColumnDef="name">
        <th mat-header-cell *matHeaderCellDef>Nombre</th>
        <td mat-cell *matCellDef="let category">{{ category.name }}</td>
      </ng-container>

      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef class="actions-header"></th>
        <td mat-cell *matCellDef="let category" class="actions-cell">
          <button
            mat-icon-button
            (click)="editCategory.emit(category)"
            [attr.aria-label]="'Editar categoría ' + category.name"
            matTooltip="Editar"
            [disabled]="deletingId() === category.id"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            mat-icon-button
            class="delete-btn"
            (click)="deleteCategory.emit(category)"
            [attr.aria-label]="'Eliminar categoría ' + category.name"
            matTooltip="Eliminar"
            [disabled]="deletingId() === category.id"
          >
            @if (deletingId() === category.id) {
              <mat-spinner diameter="20" />
            } @else {
              <mat-icon>delete</mat-icon>
            }
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
      <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
    </table>
  `,
  styles: `
    .category-table {
      width: 100%;
    }

    .actions-header {
      width: 96px;
    }

    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }

    .delete-btn {
      color: var(--mat-sys-error);
    }

    mat-spinner {
      display: inline-block;
    }
  `,
})
export class CategoryTableComponent {
  readonly categories = input.required<Category[]>();
  readonly ariaLabel = input.required<string>();
  readonly deletingId = input<number | null>(null);

  readonly editCategory = output<Category>();
  readonly deleteCategory = output<Category>();

  readonly displayedColumns = ['name', 'actions'];
}

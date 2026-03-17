import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ProfileService } from '../../services/profile.service';
import { UserProfile } from '../../models/profile.models';

@Component({
  selector: 'app-profile-info-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './profile-info-form.component.html',
  styleUrl: './profile-info-form.component.scss',
})
export class ProfileInfoFormComponent implements OnInit {
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly profile = input.required<UserProfile>();
  readonly profileUpdated = output<UserProfile>();
  readonly saving = signal(false);

  // Formulario tipado con nonNullable para evitar casteos
  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  ngOnInit(): void {
    const { name, email } = this.profile();
    this.form.patchValue({ name, email });
  }

  save(): void {
    if (this.form.invalid || this.form.pristine) return;

    this.saving.set(true);
    const { name, email } = this.form.getRawValue();

    this.profileService
      .updateProfile({ name, email })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.profileUpdated.emit(updated);
          this.form.markAsPristine();
          this.snackBar.open('Perfil actualizado exitosamente', 'Cerrar', { duration: 3000 });
          this.saving.set(false);
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'Error al actualizar el perfil';
          this.snackBar.open(msg, 'Cerrar', { duration: 4000 });
          this.saving.set(false);
        },
      });
  }
}

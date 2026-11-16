import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError } from '../api/api-error';
import { TranslatePipe } from '../i18n/t.pipe';
import { Params, Translations } from '../i18n/translations.store';
import { SessionStore } from '../session/session.store';
import { IconComponent } from './icon.component';

/**
 * Puts the API's refusal on the form control it names, so the field shows it. Returns whether a
 * control took it; otherwise the caller shows it as a general message.
 */
export function applyApiError(form: AbstractControl, failure: unknown): boolean {
  const error = ApiError.from(failure);
  const path = error.controlPath;
  if (!path) {
    return false;
  }
  const control = form.get(path) ?? form.get(path.split('.').pop() ?? '');
  if (!control) {
    return false;
  }
  control.setErrors({ ...(control.errors ?? {}), api: error.message });
  control.markAsTouched();
  return true;
}

/** The message to show under a control: the API's, or a generic one for a local rule. */
export function controlError(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) {
    return null;
  }
  const errors = control.errors;
  if (typeof errors['api'] === 'string') {
    return errors['api'];
  }
  if (errors['required']) {
    return text('ui.form.required', 'Required');
  }
  if (errors['email']) {
    return text('ui.form.email', 'Enter a valid email address');
  }
  if (errors['min']) {
    return text('ui.form.min', `Must be at least ${errors['min'].min}`, { min: errors['min'].min });
  }
  if (errors['max']) {
    return text('ui.form.max', `Must be at most ${errors['max'].max}`, { max: errors['max'].max });
  }
  if (errors['minlength']) {
    const length = errors['minlength'].requiredLength;
    return text('ui.form.minlength', `At least ${length} characters`, { length });
  }
  if (errors['maxlength']) {
    const length = errors['maxlength'].requiredLength;
    return text('ui.form.maxlength', `At most ${length} characters`, { length });
  }
  if (errors['pattern']) {
    return text('ui.form.pattern', 'Invalid format');
  }
  return text('ui.form.invalid', 'Invalid value');
}

/** A form message in the current language (English before the app has started). */
function text(key: string, fallback: string, params?: Params): string {
  return Translations.current?.t(key, params, fallback) ?? fallback;
}

/** Marks every control touched so their errors show, and says whether the form is valid. */
export function validate(form: FormGroup): boolean {
  form.markAllAsTouched();
  if (form.invalid) {
    revealFirstInvalid();
  }
  return form.valid;
}

/**
 * Scrolls to and focuses the first invalid field, in the open dialog if there is one, so an error
 * below the fold is never missed. Runs after the error messages have rendered.
 */
export function revealFirstInvalid(): void {
  setTimeout(() => {
    const fields = 'input.ng-invalid, select.ng-invalid, textarea.ng-invalid';
    const dialogs = document.querySelectorAll<HTMLElement>('.modal');
    const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document;
    const field = scope.querySelector<HTMLElement>(fields);
    if (!field) {
      return;
    }
    field.scrollIntoView({ block: 'center', behavior: 'smooth' });
    field.focus({ preventScroll: true });
  });
}

/** Shown on a branch page while "All branches" is chosen. */
@Component({
  selector: 'app-branch-required',
  imports: [IconComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card card-pad empty">
      <app-icon name="building" [size]="34" [stroke]="1.4" />
      <b>{{ 'ui.branchRequired.title' | t }}</b>
      <span>{{
        'ui.branchRequired.text' | t: { what: what() ?? ('ui.branchRequired.default' | t) }
      }}</span>
      @if (session.branches().length === 0) {
        <div style="margin-top:12px">
          <a class="btn sm" routerLink="/workspace">{{ 'ui.branchRequired.link' | t }}</a>
        </div>
      }
    </div>
  `,
})
export class BranchRequiredComponent {
  protected readonly session = inject(SessionStore);
  readonly what = input<string | null>(null);
}

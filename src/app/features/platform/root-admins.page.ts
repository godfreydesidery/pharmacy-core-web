import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { User } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-root-admins',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'platform.rootAdministrators' | t }}</h1>
          <p class="sub">
            {{ 'platform.peopleWithAccessToThe' | t }}
          </p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" (click)="open()">
            <app-icon name="plus" [size]="16" /> {{ 'platform.addRootAdministrator' | t }}
          </button>
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'platform.name' | t }}</th>
                <th>{{ 'platform.email' | t }}</th>
                <th>{{ 'platform.since' | t }}</th>
              </tr>
            </thead>
            <tbody>
              @for (u of admins.value() ?? []; track u.uid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="thumb tone-purple"><app-icon name="key" [size]="16" /></span
                      ><b>{{ u.name }}</b>
                    </div>
                  </td>
                  <td>{{ u.email }}</td>
                  <td class="muted">{{ u.createdAt | day }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <app-empty
                      [loading]="admins.loading()"
                      icon="key"
                      [title]="'platform.noRootAdministrators' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <app-modal
      [open]="creating()"
      [title]="'platform.addRootAdministrator' | t"
      (closed)="creating.set(false)"
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="create()">
        <div class="notice tone-amber">
          <app-icon name="alert" /> {{ 'platform.aRootAdministratorCanSee' | t }}
        </div>
        <div class="field">
          <label>{{ 'platform.name' | t }}</label
          ><input class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'platform.email' | t }}</label
          ><input class="input" type="email" formControlName="email" />
          @if (err('email'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'platform.password' | t }}</label
          ><input
            class="input"
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
          @if (err('password'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="creating.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="create()">
          {{ 'common.add' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class RootAdminsPage {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly admins = loaded<User[]>(() => ({
    path: '/platform/root-admins',
    options: { noBranch: true },
  }));
  protected readonly creating = signal(false);
  protected readonly busy = signal(false);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected err(name: 'name' | 'email' | 'password'): string | null {
    return controlError(this.form.controls[name]);
  }

  protected open(): void {
    this.form.reset();
    this.creating.set(true);
  }

  protected async create(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    this.busy.set(true);
    try {
      await this.api.post<User>('/platform/root-admins', this.form.getRawValue(), {
        silent: true,
        noBranch: true,
      });
      this.toasts.success(this.translations.t('toast.rootAdminAdded'));
      this.creating.set(false);
      await this.admins.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

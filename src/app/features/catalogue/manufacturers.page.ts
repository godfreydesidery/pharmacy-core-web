import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { Manufacturer } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-manufacturers',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'catalogue.manufacturers' | t }}</h1>
          <p class="sub">{{ 'catalogue.whoMakesTheProductsYouStock' | t }}</p>
        </div>
        <div class="actions">
          @if (session.can('catalogue.manage')) {
            <button class="btn primary" type="button" (click)="edit(null)">
              <app-icon name="plus" [size]="16" /> {{ 'catalogue.addManufacturer' | t }}
            </button>
          }
        </div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'catalogue.manufacturer' | t }}</th>
                <th>{{ 'catalogue.country' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (m of list.items(); track m.uid) {
                <tr>
                  <td>
                    <div class="cell-main">
                      <span class="thumb tone-orange"><app-icon name="building" [size]="16" /></span
                      ><b>{{ m.name }}</b>
                    </div>
                  </td>
                  <td>{{ m.country ?? '—' }}</td>
                  <td class="right">
                    @if (session.can('catalogue.manage')) {
                      <button class="btn sm" type="button" (click)="edit(m)">
                        <app-icon name="edit" [size]="14" /> {{ 'catalogue.edit' | t }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="3">
                    <app-empty
                      [for]="list"
                      icon="building"
                      [title]="'catalogue.noManufacturers' | t"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-pager [list]="list" />
      </div>
    </div>
    <app-modal
      [open]="open()"
      [title]="current() ? ('ui.l.editManufacturer' | t) : ('ui.l.addManufacturer' | t)"
      (closed)="open.set(false)"
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="save()">
        <div class="field">
          <label>{{ 'catalogue.name' | t }}</label><input class="input" formControlName="name" />
          @if (err('name'); as m) {
            <span class="error">{{ m }}</span>
          }
        </div>
        <div class="field">
          <label>{{ 'catalogue.country' | t }}</label><input
            class="input"
            formControlName="country"
            placeholder="India"
          />
        </div>
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'catalogue.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'catalogue.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class ManufacturersPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly list = pagedList<Manufacturer>(() => ({
    path: '/manufacturers',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Manufacturer | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    country: [''],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(manufacturer: Manufacturer | null): void {
    this.current.set(manufacturer);
    this.form.reset({ name: manufacturer?.name ?? '', country: manufacturer?.country ?? '' });
    this.open.set(true);
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const body = {
      name: this.form.getRawValue().name,
      country: this.form.getRawValue().country || null,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(`/manufacturers/${current.uid}`, body, { silent: true, noBranch: true });
      } else {
        await this.api.post('/manufacturers', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('toast.manufacturerSaved'));
      this.open.set(false);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

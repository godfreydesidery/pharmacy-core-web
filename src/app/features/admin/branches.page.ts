import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Api } from '../../core/api/api.service';
import { StaleRecordService, ifMatch } from '../../core/api/concurrency';
import { Branch } from '../../core/api/models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { applyApiError, controlError, validate } from '../../core/ui/forms';
import { ToastService } from '../../core/ui/toast.service';
import { Translations } from '../../core/i18n/translations.store';

@Component({
  selector: 'app-branches',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'admin.branches' | t }}</h1>
          <p class="sub">{{ 'admin.eachBranchKeepsItsOwn' | t }}</p>
        </div>
        <div class="actions">
          <button class="btn primary" type="button" (click)="edit(null)">
            <app-icon name="plus" [size]="16" /> {{ 'admin.addBranch' | t }}
          </button>
        </div>
      </div>
      <div class="grid three">
        @for (b of list.value() ?? []; track b.uid) {
          <div class="card card-pad stack">
            <div class="row">
              <span
                class="thumb tone-teal"
                style="width:40px;height:40px;border-radius:11px;display:grid;place-items:center"
                ><app-icon name="building"
              /></span>
              <div class="grow">
                <b>{{ b.name }}</b>
                <div class="muted" style="font-size:12px">
                  {{ b.code }}{{ b.headOffice ? ('ui.l.preHeadOffice' | t) : '' }}
                </div>
              </div>
              <app-status [value]="b.active ? 'ACTIVE' : 'INACTIVE'" />
            </div>
            <dl class="dl" style="grid-template-columns:1fr 1fr">
              <div>
                <dt>{{ 'admin.address' | t }}</dt>
                <dd>{{ b.address ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.phone' | t }}</dt>
                <dd>{{ b.phone ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.licence' | t }}</dt>
                <dd>{{ b.licenceNumber ?? '—' }}</dd>
              </div>
              <div>
                <dt>{{ 'admin.since' | t }}</dt>
                <dd>{{ b.createdAt | day }}</dd>
              </div>
            </dl>
            <button class="btn sm" type="button" (click)="edit(b)">
              <app-icon name="edit" [size]="14" /> {{ 'common.edit' | t }}
            </button>
          </div>
        } @empty {
          <app-empty [for]="list" icon="building" [title]="'admin.noBranches' | t" />
        }
      </div>
    </div>
    <app-modal
      [open]="open()"
      [title]="current() ? ('ui.l.editSp' | t) + current()!.name : ('ui.l.addBranch' | t)"
      (closed)="open.set(false)"
    >
      <form class="form-grid" [formGroup]="form" (ngSubmit)="save()">
        <app-field [label]="'admin.code' | t" [error]="err('code')">
          <input class="input" formControlName="code" style="text-transform:uppercase" />
        </app-field>
        <app-field [label]="'admin.name' | t" [error]="err('name')">
          <input class="input" formControlName="name" />
        </app-field>
        <app-field class="full" [label]="'admin.address' | t">
          <input class="input" formControlName="address" />
        </app-field>
        <app-field [label]="'admin.phone' | t">
          <input class="input" formControlName="phone" />
        </app-field>
        <app-field [label]="'admin.premisesLicenceNo' | t">
          <input class="input" formControlName="licenceNumber" />
        </app-field>
        @if (current()) {
          <label class="check full"
            ><input type="checkbox" formControlName="active" /> {{ 'admin.active' | t }}</label
          >
        }
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="open.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button class="btn primary" type="button" [disabled]="busy()" (click)="save()">
          {{ 'common.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class BranchesPage {
  private readonly api = inject(Api);
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly stale = inject(StaleRecordService);
  protected readonly list = loaded<Branch[]>(() => ({
    path: '/branches',
    options: { noBranch: true },
  }));
  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly current = signal<Branch | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{2,12}$/)]],
    name: ['', Validators.required],
    address: [''],
    phone: [''],
    licenceNumber: [''],
    active: [true],
  });

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected edit(branch: Branch | null): void {
    this.current.set(branch);
    this.form.reset({
      code: branch?.code ?? '',
      name: branch?.name ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
      licenceNumber: branch?.licenceNumber ?? '',
      active: branch?.active ?? true,
    });
    this.open.set(true);
  }

  /** Someone who works in every branch sees a new or renamed branch in the switcher at once. */
  private async refreshSwitcher(): Promise<void> {
    if (!this.session.workspace()?.allBranches) {
      return;
    }
    const branches = await this.api.get<Branch[]>('/branches', undefined, {
      noBranch: true,
      silent: true,
    });
    this.session.setBranches(
      branches.filter((b) => b.active).map(({ uid, code, name }) => ({ uid, code, name })),
    );
  }

  /** Someone else changed the branch: it is read again into the form, their change shown. */
  private async reload(uid: string): Promise<void> {
    const fresh = await this.api.get<Branch>(`/branches/${uid}`, undefined, { noBranch: true });
    this.edit(fresh);
    void this.list.reload();
  }

  protected async save(): Promise<void> {
    if (!validate(this.form)) {
      return;
    }
    const v = this.form.getRawValue();
    const body = {
      code: v.code.toUpperCase(),
      name: v.name,
      address: v.address || null,
      phone: v.phone || null,
      licenceNumber: v.licenceNumber || null,
    };
    const current = this.current();
    this.busy.set(true);
    try {
      if (current) {
        await this.api.put(
          `/branches/${current.uid}`,
          { ...body, active: v.active },
          { silent: true, noBranch: true, headers: ifMatch(current.version) },
        );
      } else {
        await this.api.post('/branches', body, { silent: true, noBranch: true });
      }
      this.toasts.success(this.translations.t('ui.toast.branchSaved'));
      this.open.set(false);
      await Promise.all([this.list.reload(), this.refreshSwitcher()]);
    } catch (failure) {
      if (current && (await this.stale.handle(failure, () => this.reload(current.uid)))) {
        return;
      }
      if (!applyApiError(this.form, failure)) {
        this.toasts.error((failure as Error).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

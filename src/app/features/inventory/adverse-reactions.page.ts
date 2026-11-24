import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ApiError } from '../../core/api/api-error';
import { Api } from '../../core/api/api.service';
import {
  AdrOutcome,
  AdrSeriousReason,
  AdrSeriousness,
  AdverseReaction,
  AdverseReactionInput,
  Customer,
  PatientSex,
  Product,
} from '../../core/api/models';
import { debounced, pagedList } from '../../core/data/data';
import { isoDay } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { downloadFrom } from '../../core/ui/export.component';
import { applyApiError, controlError, notAfterToday, validate } from '../../core/ui/forms';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ToastService } from '../../core/ui/toast.service';

export const ADR_SERIOUS_REASONS: readonly AdrSeriousReason[] = [
  'DEATH',
  'LIFE_THREATENING',
  'HOSPITALISATION',
  'DISABILITY',
  'CONGENITAL_ANOMALY',
  'OTHER_MEDICALLY_IMPORTANT',
];
export const ADR_OUTCOMES: readonly AdrOutcome[] = [
  'RECOVERED',
  'RECOVERING',
  'NOT_RECOVERED',
  'RECOVERED_WITH_SEQUELAE',
  'FATAL',
  'UNKNOWN',
];

/**
 * Inventory → Adverse reactions (STD-8): suspected adverse drug reactions reported at the
 * pharmacy, each downloadable as a CSV laid out like the TMDA yellow form to send on. Reading them
 * needs `health.view` (they name patients); reporting one needs `adr.report` and a branch.
 */
@Component({
  selector: 'app-adverse-reactions',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'adr.title' | t }}</h1>
          <p class="sub">{{ 'adr.sub' | t }}</p>
        </div>
        <div class="actions">
          @if (shown()) {
            <button class="btn" type="button" (click)="shown.set(null)">
              <app-icon name="arrow-left" [size]="16" /> {{ 'adr.back' | t }}
            </button>
            @if (canExport()) {
              <button
                class="btn"
                type="button"
                data-testid="adr-export"
                [disabled]="busy()"
                (click)="exportCsv(shown()!)"
              >
                <app-icon name="download" [size]="16" /> {{ 'adr.export' | t }}
              </button>
            }
          } @else if (session.can('adr.report')) {
            <button
              class="btn primary"
              type="button"
              data-testid="adr-new"
              [disabled]="!session.branch()"
              [title]="session.branch() ? '' : ('adr.pickBranch' | t)"
              (click)="openForm()"
            >
              <app-icon name="plus" [size]="16" /> {{ 'adr.new' | t }}
            </button>
          }
        </div>
      </div>

      @if (shown(); as r) {
        <div class="card card-pad" data-testid="adr-detail">
          <div class="row between">
            <h2 class="mono">{{ r.number }}</h2>
            <span
              class="badge"
              [class]="r.seriousness === 'SERIOUS' ? 'badge red' : 'badge gray'"
              >{{ 'adr.seriousness.' + r.seriousness | t }}</span
            >
          </div>
          <h3 class="mt">{{ 'adr.section.patient' | t }}</h3>
          <dl class="dl">
            <div>
              <dt>{{ 'adr.patientName' | t }}</dt>
              <dd>{{ r.patientName ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.patientAge' | t }}</dt>
              <dd>{{ r.patientAge ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.patientSex' | t }}</dt>
              <dd>{{ r.patientSex ? ('adr.sex.' + r.patientSex | t) : '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.patientWeightKg' | t }}</dt>
              <dd>{{ r.patientWeightKg ?? '—' }}</dd>
            </div>
          </dl>
          <h3 class="mt">{{ 'adr.section.medicine' | t }}</h3>
          <dl class="dl">
            <div>
              <dt>{{ 'adr.product' | t }}</dt>
              <dd>{{ r.productName }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.batchNumber' | t }}</dt>
              <dd class="mono">{{ r.batchNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.dose' | t }}</dt>
              <dd>{{ r.dose ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.route' | t }}</dt>
              <dd>{{ r.route ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.indication' | t }}</dt>
              <dd>{{ r.indication ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.therapy' | t }}</dt>
              <dd>
                {{ r.therapyStarted ? (r.therapyStarted | day) : '—' }} →
                {{ r.therapyStopped ? (r.therapyStopped | day) : '—' }}
              </dd>
            </div>
          </dl>
          <h3 class="mt">{{ 'adr.section.reaction' | t }}</h3>
          <dl class="dl">
            <div>
              <dt>{{ 'adr.reaction' | t }}</dt>
              <dd>{{ r.reaction }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.onsetDate' | t }}</dt>
              <dd>{{ r.onsetDate | day }}</dd>
            </div>
            @if (r.seriousReason) {
              <div>
                <dt>{{ 'adr.seriousReason' | t }}</dt>
                <dd>{{ 'adr.seriousReason.' + r.seriousReason | t }}</dd>
              </div>
            }
            <div>
              <dt>{{ 'adr.outcome' | t }}</dt>
              <dd>{{ 'adr.outcome.' + r.outcome | t }}</dd>
            </div>
          </dl>
          <h3 class="mt">{{ 'adr.section.reporter' | t }}</h3>
          <dl class="dl">
            <div>
              <dt>{{ 'adr.reporterName' | t }}</dt>
              <dd>{{ r.reporterName ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.reporterProfession' | t }}</dt>
              <dd>{{ r.reporterProfession ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.reporterPhone' | t }}</dt>
              <dd>{{ r.reporterPhone ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'adr.recorded' | t }}</dt>
              <dd>{{ r.createdBy ?? '' }} · {{ r.createdAt | when }}</dd>
            </div>
            @if (r.note) {
              <div>
                <dt>{{ 'adr.note' | t }}</dt>
                <dd>{{ r.note }}</dd>
              </div>
            }
          </dl>
          <p class="muted mt small">{{ 'adr.formHint' | t }}</p>
        </div>
      } @else {
        <div class="card">
          <div class="toolbar">
            <label class="search"
              ><app-icon name="search" [size]="16" /><input
                data-testid="adr-search"
                [placeholder]="'adr.search' | t"
                (input)="q.set($any($event.target).value)"
            /></label>
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'adr.number' | t }}</th>
                  <th>{{ 'adr.onsetDate' | t }}</th>
                  <th>{{ 'adr.product' | t }}</th>
                  <th>{{ 'adr.patientName' | t }}</th>
                  <th>{{ 'adr.reaction' | t }}</th>
                  <th>{{ 'adr.seriousnessCol' | t }}</th>
                  <th>{{ 'adr.outcome' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (r of list.items(); track r.uid) {
                  <tr class="clickable" appRowLink>
                    <td class="mono strong">
                      <button type="button" class="row-link" (click)="open(r)">
                        {{ r.number }}
                      </button>
                    </td>
                    <td>{{ r.onsetDate | day }}</td>
                    <td>
                      {{ r.productName }}
                      @if (r.batchNumber) {
                        <small class="muted block mono">{{ r.batchNumber }}</small>
                      }
                    </td>
                    <td>{{ r.patientName ?? '—' }}</td>
                    <td class="clip">{{ r.reaction }}</td>
                    <td>
                      <span
                        class="badge"
                        [class]="r.seriousness === 'SERIOUS' ? 'badge red' : 'badge gray'"
                        >{{ 'adr.seriousness.' + r.seriousness | t }}</span
                      >
                    </td>
                    <td>{{ 'adr.outcome.' + r.outcome | t }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty [for]="list" icon="stethoscope" [title]="'adr.none' | t" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="list" />
        </div>
      }
    </div>

    <app-modal
      [open]="editing()"
      [wide]="true"
      [dirty]="form.dirty"
      [title]="'adr.new' | t"
      (closed)="editing.set(false)"
    >
      <form class="stack" [formGroup]="form" (ngSubmit)="save()">
        <p class="notice tone-amber" data-testid="adr-form-hint">{{ 'adr.formHint' | t }}</p>
        <fieldset class="form-grid">
          <legend>{{ 'adr.section.patient' | t }}</legend>
          <app-field class="full" [label]="'adr.customer' | t" [hint]="'adr.customerHint' | t">
            <app-lookup
              path="/customers"
              [placeholder]="'adr.searchCustomer' | t"
              [display]="customerName"
              (picked)="pickCustomer($event)"
            />
          </app-field>
          <app-field [label]="'adr.patientName' | t" [error]="err('patientName')">
            <input class="input" formControlName="patientName" />
          </app-field>
          <app-field [label]="'adr.patientAge' | t" [error]="err('patientAge')">
            <input class="input" type="number" min="0" max="130" formControlName="patientAge" />
          </app-field>
          <app-field [label]="'adr.patientSex' | t">
            <select class="select" formControlName="patientSex">
              <option value="">—</option>
              <option value="FEMALE">{{ 'adr.sex.FEMALE' | t }}</option>
              <option value="MALE">{{ 'adr.sex.MALE' | t }}</option>
            </select>
          </app-field>
          <app-field [label]="'adr.patientWeightKg' | t" [error]="err('patientWeightKg')">
            <input
              class="input"
              type="number"
              min="0"
              step="any"
              formControlName="patientWeightKg"
            />
          </app-field>
        </fieldset>
        <fieldset class="form-grid">
          <legend>{{ 'adr.section.medicine' | t }}</legend>
          <app-field
            class="full"
            [label]="'adr.product' | t"
            [required]="true"
            [error]="productError()"
          >
            <app-lookup
              path="/products"
              [placeholder]="'adr.searchProduct' | t"
              (picked)="pickProduct($event)"
            />
          </app-field>
          <app-field [label]="'adr.batchNumber' | t" [error]="err('batchNumber')">
            <input class="input" formControlName="batchNumber" />
          </app-field>
          <app-field [label]="'adr.dose' | t" [error]="err('dose')">
            <input class="input" formControlName="dose" [placeholder]="'adr.doseHint' | t" />
          </app-field>
          <app-field [label]="'adr.route' | t" [error]="err('route')">
            <input class="input" formControlName="route" [placeholder]="'adr.routeHint' | t" />
          </app-field>
          <app-field [label]="'adr.indication' | t" [error]="err('indication')">
            <input class="input" formControlName="indication" />
          </app-field>
          <app-field [label]="'adr.therapyStarted' | t" [error]="err('therapyStarted')">
            <input class="input" type="date" [max]="today()" formControlName="therapyStarted" />
          </app-field>
          <app-field [label]="'adr.therapyStopped' | t" [error]="err('therapyStopped')">
            <input class="input" type="date" [max]="today()" formControlName="therapyStopped" />
          </app-field>
        </fieldset>
        <fieldset class="form-grid">
          <legend>{{ 'adr.section.reaction' | t }}</legend>
          <app-field
            class="full"
            [label]="'adr.reaction' | t"
            [required]="true"
            [error]="err('reaction')"
          >
            <textarea
              class="input"
              formControlName="reaction"
              data-testid="adr-reaction"
            ></textarea>
          </app-field>
          <app-field [label]="'adr.onsetDate' | t" [required]="true" [error]="err('onsetDate')">
            <input
              class="input"
              type="date"
              data-testid="adr-onset"
              [max]="today()"
              formControlName="onsetDate"
            />
          </app-field>
          <app-field [label]="'adr.seriousnessCol' | t" [required]="true">
            <select class="select" formControlName="seriousness" data-testid="adr-seriousness">
              <option value="NOT_SERIOUS">{{ 'adr.seriousness.NOT_SERIOUS' | t }}</option>
              <option value="SERIOUS">{{ 'adr.seriousness.SERIOUS' | t }}</option>
            </select>
          </app-field>
          @if (serious()) {
            <app-field
              [label]="'adr.seriousReason' | t"
              [required]="true"
              [error]="err('seriousReason')"
            >
              <select
                class="select"
                formControlName="seriousReason"
                data-testid="adr-serious-reason"
              >
                <option value="">—</option>
                @for (s of seriousReasons; track s) {
                  <option [value]="s">{{ 'adr.seriousReason.' + s | t }}</option>
                }
              </select>
            </app-field>
          }
          <app-field [label]="'adr.outcome' | t" [required]="true" [error]="err('outcome')">
            <select class="select" formControlName="outcome">
              @for (o of outcomes; track o) {
                <option [value]="o">{{ 'adr.outcome.' + o | t }}</option>
              }
            </select>
          </app-field>
        </fieldset>
        <fieldset class="form-grid">
          <legend>{{ 'adr.section.reporter' | t }}</legend>
          <app-field [label]="'adr.reporterName' | t" [error]="err('reporterName')">
            <input class="input" formControlName="reporterName" data-testid="adr-reporter" />
          </app-field>
          <app-field [label]="'adr.reporterProfession' | t" [error]="err('reporterProfession')">
            <input
              class="input"
              formControlName="reporterProfession"
              [placeholder]="'adr.professionHint' | t"
            />
          </app-field>
          <app-field [label]="'adr.reporterPhone' | t" [error]="err('reporterPhone')">
            <input class="input" formControlName="reporterPhone" placeholder="+255…" />
          </app-field>
          <app-field class="full" [label]="'adr.note' | t" [error]="err('note')">
            <textarea class="input" formControlName="note"></textarea>
          </app-field>
        </fieldset>
        @if (problem(); as p) {
          <div class="notice tone-red" role="alert" data-testid="adr-problem">{{ p }}</div>
        }
      </form>
      <ng-container footer>
        <button class="btn" type="button" (click)="editing.set(false)">
          {{ 'common.cancel' | t }}
        </button>
        <button
          class="btn primary"
          type="button"
          data-testid="adr-save"
          [disabled]="busy()"
          (click)="save()"
        >
          {{ 'adr.save' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: `
    fieldset {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin: 0;
    }
    legend {
      padding: 0 4px;
      font-weight: 600;
    }
    .clip {
      max-width: 280px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .small {
      font-size: 12.5px;
    }
  `,
})
export default class AdverseReactionsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  protected readonly seriousReasons = ADR_SERIOUS_REASONS;
  protected readonly outcomes = ADR_OUTCOMES;

  protected readonly q = signal('');
  private readonly query = debounced(this.q);
  protected readonly list = pagedList<AdverseReaction>(() => ({
    path: '/adverse-reactions',
    query: { q: this.query() },
  }));

  /** The report open in the detail view, read on its own (each read is audited). */
  protected readonly shown = signal<AdverseReaction | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);
  protected readonly today = signal(isoDay());
  protected readonly product = signal<Product | null>(null);
  private readonly productTouched = signal(false);
  private readonly customer = signal<Customer | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    patientName: ['', Validators.maxLength(200)],
    patientAge: [null as number | null, [Validators.min(0), Validators.max(130)]],
    patientSex: ['' as PatientSex | ''],
    patientWeightKg: [null as number | null, [Validators.min(0), Validators.max(500)]],
    batchNumber: [''],
    dose: [''],
    route: [''],
    indication: [''],
    therapyStarted: ['', notAfterToday],
    therapyStopped: ['', notAfterToday],
    reaction: ['', Validators.required],
    onsetDate: ['', [Validators.required, notAfterToday]],
    seriousness: ['NOT_SERIOUS' as AdrSeriousness, Validators.required],
    seriousReason: ['' as AdrSeriousReason | ''],
    outcome: ['UNKNOWN' as AdrOutcome, Validators.required],
    reporterName: [''],
    reporterProfession: [''],
    reporterPhone: [''],
    note: [''],
  });
  private readonly seriousness = toSignal(this.form.controls.seriousness.valueChanges, {
    initialValue: this.form.controls.seriousness.value,
  });
  protected readonly serious = computed(() => this.seriousness() === 'SERIOUS');

  protected readonly canExport = computed(
    () => this.session.can('health.view') && this.session.can('adr.report'),
  );

  protected readonly customerName = (c: Customer) => c.name;

  protected err(name: string): string | null {
    return controlError(this.form.get(name));
  }

  protected productError(): string | null {
    return this.productTouched() && !this.product()
      ? this.translations.t('ui.form.required', undefined, 'Required')
      : null;
  }

  protected openForm(): void {
    this.today.set(isoDay());
    this.product.set(null);
    this.productTouched.set(false);
    this.customer.set(null);
    this.problem.set(null);
    this.form.reset({
      seriousness: 'NOT_SERIOUS',
      outcome: 'UNKNOWN',
      onsetDate: isoDay(),
      // The API puts the signed-in user's name when left empty; shown so it can be changed.
      reporterName: this.session.user()?.name ?? '',
    });
    this.editing.set(true);
  }

  protected pickProduct(product: Product | null): void {
    this.product.set(product);
    this.productTouched.set(true);
  }

  /** A customer picked fills the patient's name, which may still be changed. */
  protected pickCustomer(customer: Customer | null): void {
    this.customer.set(customer);
    if (customer && !this.form.controls.patientName.value.trim()) {
      this.form.controls.patientName.setValue(customer.name);
    }
  }

  protected async open(reaction: AdverseReaction): Promise<void> {
    try {
      this.shown.set(await this.api.get<AdverseReaction>(`/adverse-reactions/${reaction.uid}`));
    } catch {
      // The interceptor has said why.
    }
  }

  protected async exportCsv(reaction: AdverseReaction): Promise<void> {
    this.busy.set(true);
    try {
      await downloadFrom(
        this.http,
        `/adverse-reactions/${reaction.uid}/export`,
        this.toasts,
        this.translations.t('adr.exportFailed'),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.productTouched.set(true);
    const reason = this.form.controls.seriousReason;
    reason.setValidators(this.serious() ? Validators.required : null);
    reason.updateValueAndValidity();
    const valid = validate(this.form);
    const product = this.product();
    if (!valid || !product) {
      return;
    }
    const v = this.form.getRawValue();
    const text = (value: string) => value.trim() || null;
    const number = (value: number | null) =>
      value === null || (value as unknown) === '' ? null : Number(value);
    const body: AdverseReactionInput = {
      customerUid: this.customer()?.uid ?? null,
      patientName: text(v.patientName),
      patientAge: number(v.patientAge),
      patientSex: v.patientSex || null,
      patientWeightKg: number(v.patientWeightKg),
      productUid: product.uid,
      batchNumber: text(v.batchNumber),
      dose: text(v.dose),
      route: text(v.route),
      indication: text(v.indication),
      therapyStarted: v.therapyStarted || null,
      therapyStopped: v.therapyStopped || null,
      reaction: v.reaction.trim(),
      onsetDate: v.onsetDate,
      seriousness: v.seriousness,
      seriousReason: v.seriousness === 'SERIOUS' ? v.seriousReason || null : null,
      outcome: v.outcome,
      reporterName: text(v.reporterName),
      reporterProfession: text(v.reporterProfession),
      reporterPhone: text(v.reporterPhone),
      note: text(v.note),
    };
    this.problem.set(null);
    this.busy.set(true);
    try {
      const saved = await this.api.post<AdverseReaction>('/adverse-reactions', body, {
        silent: true,
      });
      this.toasts.success(this.translations.t('adr.saved', { number: saved.number }));
      this.form.markAsPristine();
      this.editing.set(false);
      this.shown.set(saved);
      await this.list.reload();
    } catch (failure) {
      if (!applyApiError(this.form, failure)) {
        this.problem.set(ApiError.from(failure).message);
      }
    } finally {
      this.busy.set(false);
    }
  }
}

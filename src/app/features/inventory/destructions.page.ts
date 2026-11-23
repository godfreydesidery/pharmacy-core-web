import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Api } from '../../core/api/api.service';
import { Batch, Product } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { LookupComponent } from '../../core/ui/lookup.component';
import { ConfirmService } from '../../core/ui/confirm';
import { ToastService } from '../../core/ui/toast.service';

type DestructionReason = 'EXPIRED' | 'DAMAGED';

interface DestructionLine {
  productUid: string;
  productName: string;
  batchUid: string;
  batchNumber: string;
  expiryDate: string | null;
  reason: DestructionReason;
  quantity: number;
  unitCost: number;
  value: number;
}

interface Destruction {
  uid: string;
  number: string;
  branchName: string | null;
  destroyedOn: string;
  method: string;
  witnessName: string;
  witnessTitle: string | null;
  certificateNumber: string | null;
  note: string | null;
  totalCost: number;
  createdAt: string;
  createdBy: string;
  /** The recorder's name (older records: their reference). */
  createdByName?: string;
  lines: DestructionLine[];
}

interface DraftLine {
  product: Product | null;
  batches: Batch[];
  batchUid: string;
  quantity: number;
  reason: DestructionReason;
}

/** Inventory → Destructions: the register of expired or damaged stock destroyed, with certificate. */
@Component({
  selector: 'app-destructions',
  imports: [TranslatePipe, ...SHARED, LookupComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <div>
          <h1>{{ 'dest.title' | t }}</h1>
          <p class="sub">{{ 'dest.sub' | t }}</p>
        </div>
        <div class="actions">
          @if (current()) {
            <button class="btn" type="button" (click)="current.set(null)">
              <app-icon name="arrow-left" [size]="16" /> {{ 'dest.back' | t }}
            </button>
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'dest.print' | t }}
            </button>
          } @else if (session.branch() && session.can('inventory.adjust')) {
            <button class="btn primary" type="button" (click)="open()">
              <app-icon name="plus" [size]="16" /> {{ 'dest.new' | t }}
            </button>
          }
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'dest.title' | t" />
      } @else if (current(); as d) {
        <div class="card print-area">
          <div class="card-pad row between">
            <div>
              <h2>{{ 'dest.certificate' | t }}</h2>
              <div class="muted">{{ session.tenant()?.name }} · {{ d.branchName }}</div>
            </div>
            <div class="right">
              <h3 class="mono">{{ d.number }}</h3>
              <div class="muted">{{ d.destroyedOn | day }}</div>
            </div>
          </div>
          <div class="card-pad dl">
            <div>
              <dt>{{ 'dest.method' | t }}</dt>
              <dd>{{ d.method }}</dd>
            </div>
            <div>
              <dt>{{ 'dest.certificateNumber' | t }}</dt>
              <dd>{{ d.certificateNumber ?? '—' }}</dd>
            </div>
            <div>
              <dt>{{ 'dest.witness' | t }}</dt>
              <dd>{{ d.witnessName }}{{ d.witnessTitle ? ', ' + d.witnessTitle : '' }}</dd>
            </div>
            <div>
              <dt>{{ 'dest.recordedBy' | t }}</dt>
              <dd>{{ d.createdByName ?? d.createdBy }} · {{ d.createdAt | when }}</dd>
            </div>
            @if (d.note) {
              <div>
                <dt>{{ 'dest.note' | t }}</dt>
                <dd>{{ d.note }}</dd>
              </div>
            }
          </div>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'dest.product' | t }}</th>
                  <th>{{ 'dest.batch' | t }}</th>
                  <th>{{ 'dest.expiry' | t }}</th>
                  <th>{{ 'dest.reason' | t }}</th>
                  <th class="right">{{ 'dest.quantity' | t }}</th>
                  <th class="right">{{ 'dest.value' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (l of d.lines; track l.batchUid) {
                  <tr>
                    <td class="strong">{{ l.productName }}</td>
                    <td class="mono">{{ l.batchNumber }}</td>
                    <td>{{ l.expiryDate ? (l.expiryDate | day) : '—' }}</td>
                    <td>{{ 'dest.reason.' + l.reason | t }}</td>
                    <td class="right">{{ l.quantity | num }}</td>
                    <td class="right">{{ l.value | money }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="5" class="right strong">{{ 'dest.total' | t }}</td>
                  <td class="right strong">{{ d.totalCost | money }}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="card-pad row between" style="margin-top: 32px">
            <div>______________________<br />{{ 'dest.signPharmacist' | t }}</div>
            <div>______________________<br />{{ 'dest.signWitness' | t }}</div>
          </div>
        </div>
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'dest.number' | t }}</th>
                  <th>{{ 'dest.date' | t }}</th>
                  <th>{{ 'dest.method' | t }}</th>
                  <th>{{ 'dest.witness' | t }}</th>
                  <th class="right">{{ 'dest.lines' | t }}</th>
                  <th class="right">{{ 'dest.value' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (d of destructions.items(); track d.uid) {
                  <tr class="clickable" (click)="current.set(d)">
                    <td class="mono strong">{{ d.number }}</td>
                    <td>{{ d.destroyedOn | day }}</td>
                    <td>{{ d.method }}</td>
                    <td>{{ d.witnessName }}</td>
                    <td class="right">{{ d.lines.length }}</td>
                    <td class="right">{{ d.totalCost | money }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6">
                      <app-empty [for]="destructions" icon="trash" [title]="'dest.none' | t" />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-pager [list]="destructions" />
        </div>
      }
    </div>

    <app-modal [open]="editing()" [title]="'dest.new' | t" (closed)="editing.set(false)">
      <div class="form-grid">
        <div class="field">
          <label>{{ 'dest.date' | t }}</label>
          <input
            class="input"
            type="date"
            [value]="destroyedOn()"
            (input)="destroyedOn.set(sel($event))"
          />
        </div>
        <div class="field">
          <label>{{ 'dest.method' | t }}</label>
          <input
            class="input"
            [value]="method()"
            (input)="method.set(sel($event))"
            [placeholder]="'dest.methodHint' | t"
          />
        </div>
        <div class="field">
          <label>{{ 'dest.witnessName' | t }}</label>
          <input class="input" [value]="witnessName()" (input)="witnessName.set(sel($event))" />
        </div>
        <div class="field">
          <label>{{ 'dest.witnessTitle' | t }}</label>
          <input
            class="input"
            [value]="witnessTitle()"
            (input)="witnessTitle.set(sel($event))"
            [placeholder]="'dest.witnessTitleHint' | t"
          />
        </div>
        <div class="field full">
          <label>{{ 'dest.certificateNumber' | t }}</label>
          <input
            class="input"
            [value]="certificateNumber()"
            (input)="certificateNumber.set(sel($event))"
          />
        </div>
        @for (line of lines(); track $index; let i = $index) {
          <div class="field full">
            <label>{{ 'dest.lineN' | t: { n: i + 1 } }}</label>
            <div class="row" style="gap: 8px; flex-wrap: wrap">
              <div style="flex: 2 1 220px">
                <app-lookup
                  path="/products"
                  [small]="true"
                  [placeholder]="'dest.searchProduct' | t"
                  (picked)="pickProduct(i, $event)"
                />
              </div>
              <select
                class="select"
                style="flex: 2 1 200px"
                [value]="line.batchUid"
                (change)="batchChosen(i, sel($event))"
              >
                <option value="">{{ 'dest.chooseBatch' | t }}</option>
                @for (b of line.batches; track b.uid) {
                  <option [value]="b.uid">
                    {{ b.batchNumber }} · {{ b.expiryDate ?? '—' }} · {{ b.quantity }}
                    {{ b.expired ? ('dest.expiredMark' | t) : '' }}
                  </option>
                }
              </select>
              <select
                class="select"
                style="flex: 1 1 120px"
                [value]="line.reason"
                (change)="patch(i, { reason: $any(sel($event)) })"
              >
                <option value="EXPIRED">{{ 'dest.reason.EXPIRED' | t }}</option>
                <option value="DAMAGED">{{ 'dest.reason.DAMAGED' | t }}</option>
              </select>
              <input
                class="input"
                type="number"
                min="1"
                style="flex: 0 1 90px"
                [value]="line.quantity"
                (input)="patch(i, { quantity: +sel($event) })"
              />
              @if (lines().length > 1) {
                <button class="btn ghost" type="button" (click)="removeLine(i)">
                  <app-icon name="x" [size]="16" />
                </button>
              }
            </div>
          </div>
        }
        <div class="field full">
          <button class="btn sm" type="button" (click)="addLine()">
            <app-icon name="plus" [size]="14" /> {{ 'dest.addLine' | t }}
          </button>
        </div>
        <div class="field full">
          <label>{{ 'dest.note' | t }}</label>
          <textarea class="input" [value]="note()" (input)="note.set(sel($event))"></textarea>
        </div>
      </div>
      <ng-container footer>
        <button class="btn" type="button" (click)="editing.set(false)">
          {{ 'dest.cancel' | t }}
        </button>
        <button class="btn danger" type="button" [disabled]="busy()" (click)="save()">
          {{ 'dest.record' | t }}
        </button>
      </ng-container>
    </app-modal>
  `,
})
export default class DestructionsPage {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly confirm = inject(ConfirmService);
  protected readonly current = signal<Destruction | null>(null);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);
  protected readonly destroyedOn = signal('');
  protected readonly method = signal('');
  protected readonly witnessName = signal('');
  protected readonly witnessTitle = signal('');
  protected readonly certificateNumber = signal('');
  protected readonly note = signal('');
  protected readonly lines = signal<DraftLine[]>([]);
  protected readonly destructions = pagedList<Destruction>(() =>
    this.session.branch() ? { path: '/destructions' } : null,
  );

  protected sel(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  private blank(): DraftLine {
    return { product: null, batches: [], batchUid: '', quantity: 1, reason: 'EXPIRED' };
  }

  protected open(): void {
    this.destroyedOn.set(new Date().toISOString().slice(0, 10));
    this.method.set('');
    this.witnessName.set('');
    this.witnessTitle.set('');
    this.certificateNumber.set('');
    this.note.set('');
    this.lines.set([this.blank()]);
    this.editing.set(true);
  }

  protected async pickProduct(index: number, product: Product | null): Promise<void> {
    const batches = product ? await this.api.get<Batch[]>(`/stock/${product.uid}/batches`) : [];
    this.patch(index, { product, batches, batchUid: '' });
  }

  protected batchChosen(index: number, batchUid: string): void {
    const batch = this.lines()[index]?.batches.find((b) => b.uid === batchUid);
    this.patch(index, {
      batchUid,
      reason: batch && !batch.expired ? 'DAMAGED' : 'EXPIRED',
      quantity: batch?.quantity ?? 1,
    });
  }

  protected patch(index: number, change: Partial<DraftLine>): void {
    this.lines.update((all) => all.map((l, i) => (i === index ? { ...l, ...change } : l)));
  }

  protected addLine(): void {
    this.lines.update((all) => [...all, this.blank()]);
  }

  protected removeLine(index: number): void {
    this.lines.update((all) => all.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    const lines = this.lines().filter((l) => l.batchUid);
    // The witness may be left empty when a manager approves: they become the witness (Batch 4).
    if (!this.method().trim() || !this.note().trim() || !lines.length) {
      this.toasts.error(this.translations.t('dest.incomplete'));
      return;
    }
    if (
      !(await this.confirm.ask({
        title: this.translations.t('common.areYouSure'),
        text: this.translations.t('dest.confirm'),
        icon: 'danger',
      }))
    ) {
      return;
    }
    this.busy.set(true);
    try {
      const saved = await this.api.post<Destruction>('/destructions', {
        destroyedOn: this.destroyedOn() || null,
        method: this.method(),
        witnessName: this.witnessName(),
        witnessTitle: this.witnessTitle() || null,
        certificateNumber: this.certificateNumber() || null,
        note: this.note() || null,
        lines: lines.map((l) => ({ batchUid: l.batchUid, quantity: l.quantity, reason: l.reason })),
      });
      this.toasts.success(this.translations.t('dest.recorded'));
      this.editing.set(false);
      this.current.set(saved);
      this.destructions.reload();
    } finally {
      this.busy.set(false);
    }
  }

  protected print(): void {
    window.print();
  }
}

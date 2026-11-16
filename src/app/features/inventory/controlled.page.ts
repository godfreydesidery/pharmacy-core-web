import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Uid } from '../../core/api/models';
import { loaded, pagedList } from '../../core/data/data';
import { downloadCsv } from '../../core/format/format';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';

interface ControlledProduct {
  productUid: Uid;
  name: string;
  strength: string | null;
  dosageForm: string | null;
  onHand: number;
}

interface RegisterLine {
  uid: Uid;
  at: string;
  type: string;
  reference: string | null;
  batchNumber: string | null;
  quantityIn: number;
  quantityOut: number;
  balance: number;
  patientName: string | null;
  prescriberName: string | null;
  prescriberRegistration: string | null;
  prescriptionReference: string | null;
  note: string | null;
  recordedBy: string;
}

/**
 * Inventory → Controlled drugs: every CONTROLLED product's balance at the branch and, for the one
 * picked, its register: each movement with the running balance and, for sales, the prescription.
 */
@Component({
  selector: 'app-controlled',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'controlled.title' | t }}</h1>
          <p class="sub">{{ 'controlled.sub' | t: { branch: session.branch()?.name ?? '—' } }}</p>
        </div>
        @if (selected()) {
          <div class="actions">
            <button class="btn" type="button" (click)="print()">
              <app-icon name="printer" [size]="16" /> {{ 'controlled.print' | t }}
            </button>
            <button class="btn" type="button" (click)="export()">
              <app-icon name="download" [size]="16" /> {{ 'controlled.export' | t }}
            </button>
          </div>
        }
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'controlled.what' | t" />
      } @else {
        <div class="grid controlled">
          <div class="card no-print">
            <div class="card-pad">
              <h3>{{ 'controlled.products' | t }}</h3>
            </div>
            @for (p of products.value() ?? []; track p.productUid) {
              <button
                type="button"
                class="drug"
                [class.active]="selected()?.productUid === p.productUid"
                (click)="selected.set(p)"
              >
                <span class="grow"
                  ><b>{{ p.name }}</b
                  ><small class="muted">{{ p.strength }}</small></span
                >
                <span class="badge" [class.red]="p.onHand === 0">{{ p.onHand | num }}</span>
              </button>
            } @empty {
              <div class="empty">{{ 'controlled.none' | t }}</div>
            }
          </div>
          <div class="card">
            @if (selected(); as s) {
              <div class="card-pad">
                <h3>{{ s.name }} {{ s.strength }}</h3>
                <p class="muted">{{ 'controlled.balance' | t: { count: s.onHand } }}</p>
              </div>
              <div class="table-wrap">
                <table class="table">
                  <thead>
                    <tr>
                      <th>{{ 'controlled.date' | t }}</th>
                      <th>{{ 'controlled.entry' | t }}</th>
                      <th>{{ 'controlled.reference' | t }}</th>
                      <th>{{ 'controlled.batch' | t }}</th>
                      <th class="right">{{ 'controlled.in' | t }}</th>
                      <th class="right">{{ 'controlled.out' | t }}</th>
                      <th class="right">{{ 'controlled.balanceCol' | t }}</th>
                      <th>{{ 'controlled.patient' | t }}</th>
                      <th>{{ 'controlled.prescriber' | t }}</th>
                      <th>{{ 'controlled.by' | t }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (r of register.items(); track r.uid) {
                      <tr>
                        <td class="muted">{{ r.at | when }}</td>
                        <td>{{ 'enum.' + r.type | t: null : (r.type | label) }}</td>
                        <td class="mono">{{ r.reference ?? '—' }}</td>
                        <td class="mono">{{ r.batchNumber ?? '—' }}</td>
                        <td class="right">{{ r.quantityIn || '' }}</td>
                        <td class="right">{{ r.quantityOut || '' }}</td>
                        <td class="right strong">{{ r.balance }}</td>
                        <td>{{ r.patientName ?? '—' }}</td>
                        <td>
                          @if (r.prescriberName) {
                            {{ r.prescriberName }}
                            <small class="muted block"
                              >{{ r.prescriberRegistration }} · {{ r.prescriptionReference }}</small
                            >
                          } @else {
                            {{ r.note ?? '—' }}
                          }
                        </td>
                        <td class="muted">{{ r.recordedBy }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="10" class="empty">{{ 'controlled.noEntries' | t }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <app-pager
                [count]="register.items().length"
                [total]="register.total()"
                [hasMore]="register.hasMore()"
                [loading]="register.loading()"
                (more)="register.more()"
              />
            } @else {
              <div class="empty card-pad">{{ 'controlled.pick' | t }}</div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .controlled {
      grid-template-columns: minmax(220px, 300px) 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .controlled {
        grid-template-columns: 1fr;
      }
    }
    .drug {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 10px 16px;
      border: 0;
      border-top: 1px solid var(--border);
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .drug small {
      display: block;
    }
    .drug.active {
      background: var(--primary-soft);
    }
  `,
})
export default class ControlledPage {
  protected readonly session = inject(SessionStore);
  private readonly translations = inject(Translations);
  protected readonly selected = signal<ControlledProduct | null>(null);
  protected readonly products = loaded<ControlledProduct[]>(() =>
    this.session.branch() ? { path: '/controlled-drugs' } : null,
  );
  protected readonly register = pagedList<RegisterLine>(() => {
    const s = this.selected();
    return s ? { path: `/controlled-drugs/${s.productUid}/register` } : null;
  }, 50);

  protected print(): void {
    window.print();
  }

  protected export(): void {
    const s = this.selected();
    if (!s) {
      return;
    }
    const t = (k: string) => this.translations.t(k);
    downloadCsv(
      `controlled-register-${s.name.replace(/\W+/g, '-').toLowerCase()}.csv`,
      [
        t('controlled.date'),
        t('controlled.entry'),
        t('controlled.reference'),
        t('controlled.batch'),
        t('controlled.in'),
        t('controlled.out'),
        t('controlled.balanceCol'),
        t('controlled.patient'),
        t('controlled.prescriber'),
        t('controlled.registration'),
        t('controlled.rxReference'),
        t('controlled.by'),
      ],
      this.register
        .items()
        .map((r) => [
          r.at,
          r.type,
          r.reference ?? '',
          r.batchNumber ?? '',
          r.quantityIn,
          r.quantityOut,
          r.balance,
          r.patientName ?? '',
          r.prescriberName ?? '',
          r.prescriberRegistration ?? '',
          r.prescriptionReference ?? '',
          r.recordedBy,
        ]),
    );
  }
}

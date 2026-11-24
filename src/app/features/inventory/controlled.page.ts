import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ControlledProduct, ControlledRegisterLine } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { Translations } from '../../core/i18n/translations.store';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';

/**
 * Inventory → Controlled drugs: every CONTROLLED product's balance at the branch and, for the one
 * picked, its register: each movement with the running balance and, for sales, the prescription
 * and who dispensed it. The drugs come a page at a time; without `health.view` a line's patient and
 * prescription are withheld.
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
            @if (session.can('data.export')) {
              <!-- Patients and prescribers: bulk export is its own permission (ISO-10). -->
              <app-export [list]="register" />
            }
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
            @for (p of products.items(); track p.productUid) {
              <button
                type="button"
                class="drug"
                [class.active]="selected()?.productUid === p.productUid"
                (click)="selected.set(p)"
              >
                <span class="grow"
                  ><b>{{ p.name }}</b
                  ><small class="muted"
                    >{{ p.strength }}
                    @if (p.controlledNow === false) {
                      · {{ 'controlled.noLonger' | t }}
                    }
                  </small></span
                >
                <span class="badge" [class.red]="p.onHand === 0">{{ p.onHand | num }}</span>
              </button>
            } @empty {
              <app-empty [for]="products" icon="shield" [title]="'controlled.none' | t" />
            }
            <app-pager [list]="products" />
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
                      <th>{{ 'controlled.rxDate' | t }}</th>
                      <th>{{ 'controlled.dispensedBy' | t }}</th>
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
                        @if (r.withheld) {
                          <td colspan="3" class="muted" data-testid="withheld">
                            <app-icon name="lock" [size]="14" /> {{ 'controlled.withheld' | t }}
                          </td>
                        } @else {
                          <td>{{ r.patientName ?? '—' }}</td>
                          <td>
                            @if (r.prescriberName) {
                              {{ r.prescriberName }}
                              <small class="muted block"
                                >{{ r.prescriberRegistration }} ·
                                {{ r.prescriptionReference }}</small
                              >
                            } @else {
                              {{ r.note ?? '—' }}
                            }
                          </td>
                          <td>{{ r.prescriptionDate ? (r.prescriptionDate | day) : '—' }}</td>
                        }
                        <td>{{ r.dispensedBy ?? '—' }}</td>
                        <td class="muted">{{ r.recordedBy }}</td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="12" class="empty">{{ 'controlled.noEntries' | t }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <app-pager [list]="register" />
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
  /** The controlled drugs by name, a page at a time (a Page since Batch 9). */
  protected readonly products = pagedList<ControlledProduct>(() =>
    this.session.branch() ? { path: '/controlled-drugs' } : null,
  );
  protected readonly register = pagedList<ControlledRegisterLine>(() => {
    const s = this.selected();
    return s ? { path: `/controlled-drugs/${s.productUid}/register` } : null;
  }, 50);

  protected print(): void {
    window.print();
  }
}

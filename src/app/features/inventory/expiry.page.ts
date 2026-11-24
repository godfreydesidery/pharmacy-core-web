import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ExpiringBatch } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';
import { TranslatePipe } from '../../core/i18n/t.pipe';

@Component({
  selector: 'app-expiry',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'inventory.expiry' | t }}</h1>
          <p class="sub">
            {{ 'ui.t.expirySub' | t: { branch: session.branch()?.name ?? '—' } }}
          </p>
        </div>
        <div class="actions">
          <div class="segmented">
            @for (d of [30, 60, 90, 180, 365]; track d) {
              <button type="button" [class.active]="withinDays() === d" (click)="withinDays.set(d)">
                {{ d }}d
              </button>
            }
          </div>
          <app-export [list]="list" />
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'ui.what.expiry' | t" />
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'inventory.medicine' | t }}</th>
                  <th>{{ 'inventory.batch' | t }}</th>
                  <th>{{ 'inventory.expiryDate' | t }}</th>
                  <th class="right">{{ 'inventory.daysLeft' | t }}</th>
                  <th class="right">{{ 'inventory.quantity' | t }}</th>
                  <th class="right">{{ 'inventory.costValue' | t }}</th>
                  <th>{{ 'inventory.status' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (b of list.items(); track b.batchUid) {
                  <tr>
                    <td>
                      <div class="cell-main">
                        <span class="thumb" [class]="tone(b.daysLeft)"
                          ><app-icon name="pill" [size]="16" /></span
                        ><b>{{ b.productName }}</b>
                      </div>
                    </td>
                    <td class="mono">{{ b.batchNumber }}</td>
                    <td>{{ b.expiryDate | day }}</td>
                    <td
                      class="right strong"
                      [class.text-red]="b.daysLeft <= 30"
                      [class.text-amber]="b.daysLeft > 30 && b.daysLeft <= 90"
                    >
                      {{ b.daysLeft < 0 ? -b.daysLeft + ('ui.l.preAgo' | t) : b.daysLeft }}
                    </td>
                    <td class="right">{{ b.quantity | num }}</td>
                    <td class="right">{{ b.costValue | money }}</td>
                    <td>
                      <app-status
                        [value]="b.daysLeft < 0 ? 'EXPIRED' : 'PENDING'"
                        [label]="
                          b.daysLeft < 0
                            ? ('ui.l.expired' | t)
                            : b.daysLeft <= 30
                              ? ('ui.l.critical' | t)
                              : ('ui.l.expiringSoon' | t)
                        "
                        [tone]="b.daysLeft <= 30 ? 'red' : 'amber'"
                      />
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      <app-empty
                        [for]="list"
                        icon="check"
                        [title]="'inventory.nothingExpiring' | t"
                        [text]="
                          ('ui.l.noBatchOnHandExpiresWithinSp' | t) +
                          withinDays() +
                          ('ui.l.preDays' | t)
                        "
                      />
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
  `,
})
export default class ExpiryPage {
  protected readonly session = inject(SessionStore);
  protected readonly withinDays = signal(90);
  protected readonly list = pagedList<ExpiringBatch>(() =>
    this.session.branch()
      ? { path: '/stock/expiring', query: { withinDays: this.withinDays() } }
      : null,
  );

  protected tone(daysLeft: number): string {
    return `thumb ${daysLeft <= 30 ? 'tone-red' : daysLeft <= 90 ? 'tone-amber' : 'tone-green'}`;
  }
}

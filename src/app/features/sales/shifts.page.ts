import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { loaded } from '../../core/data/data';
import { TranslatePipe } from '../../core/i18n/t.pipe';
import { SessionStore } from '../../core/session/session.store';
import { SHARED } from '../../core/shared';
import { ShiftView } from '../pos/shift-bar.component';

/** Sales → Shifts: the branch's till shifts with expected and counted cash. */
@Component({
  selector: 'app-shifts',
  imports: [TranslatePipe, ...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'shift.title' | t }}</h1>
          <p class="sub">{{ 'shift.sub' | t }}</p>
        </div>
      </div>
      @if (!session.branch()) {
        <app-branch-required [what]="'shift.title' | t" />
      } @else {
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>{{ 'shift.cashier' | t }}</th>
                  <th>{{ 'shift.opened' | t }}</th>
                  <th>{{ 'shift.closed' | t }}</th>
                  <th class="right">{{ 'shift.salesCount' | t }}</th>
                  <th class="right">{{ 'shift.expected' | t }}</th>
                  <th class="right">{{ 'shift.counted' | t }}</th>
                  <th class="right">{{ 'shift.variance' | t }}</th>
                </tr>
              </thead>
              <tbody>
                @for (s of shifts.value() ?? []; track s.uid) {
                  <tr>
                    <td>{{ s.cashierName ?? s.cashier }}</td>
                    <td class="muted">{{ s.openedAt | when }}</td>
                    <td class="muted">
                      @if (s.closedAt) {
                        {{ s.closedAt | when }}
                      } @else {
                        <span class="badge green">{{ 'shift.stillOpen' | t }}</span>
                      }
                    </td>
                    <td class="right">{{ s.sales }} · {{ s.salesTotal | money }}</td>
                    <td class="right">{{ s.expectedCash | money }}</td>
                    <td class="right">
                      {{ s.countedCash === null ? '—' : (s.countedCash | money) }}
                    </td>
                    <td class="right strong" [class.text-red]="(s.variance ?? 0) < 0">
                      {{ s.variance === null ? '—' : (s.variance | money) }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty">{{ 'shift.noShifts' | t }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export default class ShiftsPage {
  protected readonly session = inject(SessionStore);
  protected readonly shifts = loaded<ShiftView[]>(() =>
    this.session.branch() ? { path: '/shifts' } : null,
  );
}

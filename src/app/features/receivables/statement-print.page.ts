import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ENTRY_LABELS, Statement } from '../../core/api/credit.models';
import { loaded } from '../../core/data/data';
import { SHARED } from '../../core/shared';
import { SessionStore } from '../../core/session/session.store';

/** A print-friendly customer statement: Ctrl+P or the Print button prints only the statement. */
@Component({
  selector: 'app-statement-print',
  imports: [...SHARED, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head no-print">
        <a class="btn" [routerLink]="['/receivables', customerUid]"
          ><app-icon name="arrow-left" [size]="16" /> {{ 'receivables.back' | t }}</a
        >
        <button class="btn primary" type="button" (click)="print()">
          <app-icon name="printer" [size]="16" /> {{ 'receivables.printPdf' | t }}
        </button>
      </div>
      @if (statement.value(); as s) {
        <article class="card print-area doc">
          <header>
            <div>
              <h1>{{ 'receivables.statementOfAccount' | t }}</h1>
              <p class="muted">{{ session.tenant()?.name }}</p>
            </div>
            <div class="right">
              <b>{{ s.account.customerName }}</b>
              <p class="muted">
                {{ (s.from | day) || ('ui.l.fromTheStart' | t) }} – {{ (s.to | day) || 'today' }}
              </p>
              <p class="muted">{{ 'receivables.printed' | t }} {{ printedOn | day }}</p>
            </div>
          </header>
          <table class="table">
            <thead>
              <tr>
                <th>{{ 'receivables.date' | t }}</th>
                <th>{{ 'receivables.description' | t }}</th>
                <th>{{ 'receivables.reference' | t }}</th>
                <th class="right">{{ 'receivables.debit' | t }}</th>
                <th class="right">{{ 'receivables.credit' | t }}</th>
                <th class="right">{{ 'receivables.balance' | t }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td></td>
                <td colspan="4">
                  <i>{{ 'receivables.openingBalance' | t }}</i>
                </td>
                <td class="right">{{ s.openingBalance | money }}</td>
              </tr>
              @for (e of s.entries.items; track e.uid) {
                <tr>
                  <td>{{ e.date | day }}</td>
                  <td>
                    {{ labels[e.type] }}
                    @if (e.allocations.length) {
                      <small class="muted"> · {{ allocated(e) }}</small>
                    }
                  </td>
                  <td class="mono">{{ e.reference }}</td>
                  <td class="right">{{ e.amount > 0 ? (e.amount | money) : '' }}</td>
                  <td class="right">{{ e.amount < 0 ? (-e.amount | money) : '' }}</td>
                  <td class="right">{{ e.runningBalance | money }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr>
                <td colspan="5">
                  {{ closing() >= 0 ? ('ui.l.amountDue' | t) : ('ui.l.creditHeld' | t) }}
                </td>
                <td class="right">{{ (closing() < 0 ? -closing() : closing()) | money }}</td>
              </tr>
            </tfoot>
          </table>
          <footer class="muted">
            {{ 'receivables.overdue' | t }} {{ s.account.overdue | money }}
            {{ 'receivables.creditLimit2' | t }} {{ s.account.creditLimit | money }}
            {{ 'receivables.terms' | t }} {{ s.account.termsDays }} {{ 'receivables.days' | t }}
          </footer>
        </article>
      } @else {
        <app-empty [for]="statement" icon="receipt" [title]="'receivables.noStatement' | t" />
      }
    </div>
  `,
  styles: `
    .doc {
      padding: 28px;
      max-width: 960px;
    }
    header {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 18px;
    }
    header h1 {
      font-size: 22px;
      margin: 0;
    }
    header p {
      margin: 2px 0;
    }
    footer {
      margin-top: 16px;
      font-size: 12.5px;
    }
  `,
})
export default class StatementPrintPage {
  protected readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);
  protected readonly labels = ENTRY_LABELS;
  protected readonly customerUid = this.route.snapshot.paramMap.get('customerUid')!;
  protected readonly printedOn = new Date().toISOString().slice(0, 10);
  protected readonly statement = loaded<Statement>(() => ({
    path: `/receivables/accounts/${this.customerUid}/statement`,
    query: {
      from: this.route.snapshot.queryParamMap.get('from'),
      to: this.route.snapshot.queryParamMap.get('to'),
      limit: 100,
    },
    options: { noBranch: true },
  }));
  protected readonly closing = computed(() => {
    const s = this.statement.value();
    const items = s?.entries.items ?? [];
    return items.length ? (items[items.length - 1].runningBalance ?? 0) : (s?.openingBalance ?? 0);
  });

  protected allocated(e: Statement['entries']['items'][number]): string {
    return e.allocations.map((a) => a.reference).join(', ');
  }

  protected print(): void {
    window.print();
  }
}

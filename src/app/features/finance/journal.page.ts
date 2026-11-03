import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { JournalEntry } from '../../core/api/models';
import { pagedList } from '../../core/data/data';
import { SHARED } from '../../core/shared';

@Component({
  selector: 'app-journal',
  imports: [...SHARED],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <h1>{{ 'finance.journal' | t }}</h1>
          <p class="sub">
            {{ 'finance.everyPostingDebitAndCredit' | t }}
          </p>
        </div>
        <div class="actions">
          <input
            class="input"
            style="width:auto"
            type="date"
            (change)="from.set($any($event.target).value)"
            [attr.aria-label]="'finance.from' | t"
          />
          <input
            class="input"
            style="width:auto"
            type="date"
            (change)="to.set($any($event.target).value)"
            [attr.aria-label]="'finance.to' | t"
          />
        </div>
      </div>
      <div class="stack">
        @for (e of list.items(); track e.uid) {
          <div class="card">
            <div class="card-head" style="padding-bottom:10px">
              <div class="row">
                <span class="badge blue">{{ e.number }}</span
                ><b>{{ e.description }}</b>
              </div>
              <span class="muted" style="font-size:12px"
                >{{ e.entryDate | day }} · {{ e.sourceType | label
                }}{{ e.sourceReference ? ' ' + e.sourceReference : '' }}</span
              >
            </div>
            <div class="table-wrap">
              <table class="table compact">
                <thead>
                  <tr>
                    <th>{{ 'finance.account' | t }}</th>
                    <th class="right">{{ 'finance.debit' | t }}</th>
                    <th class="right">{{ 'finance.credit' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of e.lines; track $index) {
                    <tr>
                      <td>
                        <span class="mono muted">{{ l.accountCode }}</span> {{ l.accountName }}
                      </td>
                      <td class="right">{{ l.debit ? (l.debit | money) : '' }}</td>
                      <td class="right">{{ l.credit ? (l.credit | money) : '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @empty {
          <div class="card">
            <app-empty
              [loading]="list.loading()"
              icon="book"
              [title]="'finance.noJournalEntries' | t"
              text="Sales, receipts and expenses post here automatically."
            />
          </div>
        }
        @if (list.items().length) {
          <div class="card">
            <app-pager
              [count]="list.items().length"
              [total]="list.total()"
              [hasMore]="list.hasMore()"
              [loading]="list.loading()"
              (more)="list.more()"
            />
          </div>
        }
      </div>
    </div>
  `,
})
export default class JournalPage {
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly list = pagedList<JournalEntry>(() => ({
    path: '/journal',
    query: { from: this.from(), to: this.to() },
    options: { noBranch: true },
  }));
}

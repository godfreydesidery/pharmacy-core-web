import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SILENT } from '../api/api.interceptor';
import { Api, apiUrl, toParams } from '../api/api.service';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { SessionStore } from '../session/session.store';
import { IconComponent } from './icon.component';
import { ModalComponent } from './overlay.components';
import { ToastService } from './toast.service';

/** A problem the API found in an upload: its row (headings are row 1), column and words. */
export interface ImportProblem {
  row: number | null;
  column: string | null;
  reason: string;
  message: string;
}

/** The API's answer to a check or an import. */
export interface ImportReport {
  kind: string;
  rows: number;
  creating: number;
  updating: number;
  saved: boolean;
  problemCount: number;
  problems: ImportProblem[];
}

/**
 * The Import button of a list and its dialog: download the template, choose an Excel or CSV file,
 * see every problem by row and column (nothing is saved), then import — all rows or none. The API
 * routes are {@code <path>/template}, {@code <path>/check} and {@code <path>} itself.
 */
@Component({
  selector: 'app-import',
  imports: [TranslatePipe, IconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (allowed()) {
      <button class="btn" type="button" (click)="show()">
        <app-icon name="upload" [size]="16" /> {{ 'ui.import.button' | t }}
      </button>
      <app-modal [open]="open()" [title]="title() | t" [wide]="true" (closed)="close()">
        <ol class="steps">
          <li>
            {{ 'ui.import.step1' | t }}
            <button class="btn sm" type="button" [disabled]="busy()" (click)="template()">
              <app-icon name="download" [size]="14" /> {{ 'ui.import.template' | t }}
            </button>
          </li>
          <li>{{ step2() | t }}</li>
          <li>
            {{ 'ui.import.step3' | t }}
            <label class="btn sm">
              <app-icon name="upload" [size]="14" /> {{ 'ui.import.choose' | t }}
              <input
                type="file"
                hidden
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                (change)="picked($event)"
              />
            </label>
            @if (file(); as f) {
              <span class="file">{{ f.name }}</span>
            }
          </li>
        </ol>

        @if (busy()) {
          <div class="notice tone-blue">{{ 'ui.import.checking' | t }}</div>
        } @else if (failure()) {
          <div class="notice tone-red"><app-icon name="alert" /> {{ failure() }}</div>
        } @else if (report(); as r) {
          @if (r.problemCount === 0) {
            <div class="notice tone-green" data-testid="import-ready">
              <app-icon name="check" />
              {{
                'ui.import.ready' | t: { rows: r.rows, creating: r.creating, updating: r.updating }
              }}
            </div>
          } @else {
            <div class="notice tone-amber" data-testid="import-problems">
              <app-icon name="alert" />
              {{ 'ui.import.problems' | t: { count: r.problemCount } }}
            </div>
            <div class="table-wrap problems">
              <table class="table">
                <thead>
                  <tr>
                    <th>{{ 'ui.import.row' | t }}</th>
                    <th>{{ 'ui.import.column' | t }}</th>
                    <th>{{ 'ui.import.problem' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (p of r.problems; track $index) {
                    <tr>
                      <td class="mono">{{ p.row ?? '—' }}</td>
                      <td>{{ p.column ?? '—' }}</td>
                      <td>{{ p.message }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (r.problemCount > r.problems.length) {
              <p class="sub">
                {{ 'ui.import.more' | t: { count: r.problemCount - r.problems.length } }}
              </p>
            }
          }
        }

        <div footer>
          <button class="btn" type="button" (click)="close()">{{ 'ui.import.cancel' | t }}</button>
          <button
            class="btn primary"
            type="button"
            data-testid="import-save"
            [disabled]="!ready() || busy()"
            (click)="save()"
          >
            {{ 'ui.import.save' | t }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .steps {
      margin: 0 0 14px;
      padding-left: 20px;
      display: grid;
      gap: 10px;
      font-size: 14px;
    }
    .steps li > .btn {
      margin-left: 8px;
      vertical-align: middle;
    }
    .file {
      margin-left: 8px;
      font-family: var(--mono);
      font-size: 13px;
    }
    .problems {
      max-height: 320px;
      overflow: auto;
      margin-top: 10px;
    }
    .problems td {
      white-space: normal;
      vertical-align: top;
    }
    .problems td:last-child {
      min-width: 280px;
    }
    .notice {
      margin-top: 4px;
    }
  `,
})
export class ImportComponent {
  private readonly api = inject(Api);
  private readonly http = inject(HttpClient);
  private readonly translations = inject(Translations);
  private readonly toasts = inject(ToastService);
  private readonly session = inject(SessionStore);

  /** The import route, such as /products/import. */
  readonly path = input.required<string>();
  /** The permission that adds these records by hand; without it there is no button. */
  readonly permission = input.required<string>();
  /** The dialog's title, a dictionary key. */
  readonly title = input('ui.import.title');
  /** What one row is, a dictionary key. */
  readonly step2 = input('ui.import.step2');
  /** After rows were saved, so the list can reload. */
  readonly imported = output<ImportReport>();

  protected readonly open = signal(false);
  protected readonly busy = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly report = signal<ImportReport | null>(null);
  protected readonly failure = signal<string | null>(null);
  protected readonly allowed = computed(() => this.session.can(this.permission()));
  protected readonly ready = computed(() => {
    const r = this.report();
    return !!this.file() && !!r && r.problemCount === 0 && r.rows > 0;
  });

  protected show(): void {
    this.file.set(null);
    this.report.set(null);
    this.failure.set(null);
    this.open.set(true);
  }

  protected close(): void {
    if (!this.busy()) {
      this.open.set(false);
    }
  }

  protected async template(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get(apiUrl(`${this.path()}/template`), {
          params: toParams({ lang: this.translations.lang() }),
          responseType: 'blob',
          observe: 'response',
          context: new HttpContext().set(SILENT, true),
        }),
      );
      save(response);
    } catch {
      this.toasts.error(this.translations.t('ui.import.templateFailed'));
    }
  }

  /** A chosen file is checked at once; nothing is saved. */
  protected async picked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const chosen = input.files?.[0] ?? null;
    input.value = '';
    if (!chosen) {
      return;
    }
    this.file.set(chosen);
    this.report.set(null);
    this.failure.set(null);
    this.busy.set(true);
    try {
      this.report.set(await this.send('/check', chosen));
    } catch (failure) {
      this.failure.set((failure as Error)?.message ?? this.translations.t('ui.import.failed'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save(): Promise<void> {
    const chosen = this.file();
    if (!chosen) {
      return;
    }
    this.busy.set(true);
    try {
      const report = await this.send('', chosen);
      if (report.saved) {
        this.toasts.success(
          this.translations.t('ui.import.done', {
            creating: report.creating,
            updating: report.updating,
          }),
        );
        this.open.set(false);
        this.imported.emit(report);
      } else {
        // Something changed since the check (another person's edit): show what stopped it.
        this.report.set(report);
      }
    } catch (failure) {
      this.failure.set((failure as Error)?.message ?? this.translations.t('ui.import.failed'));
    } finally {
      this.busy.set(false);
    }
  }

  private send(suffix: string, file: File): Promise<ImportReport> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.post<ImportReport>(
      `${this.path()}${suffix}?lang=${encodeURIComponent(this.translations.lang())}`,
      form,
      { silent: true },
    );
  }
}

/** Saves the answer under the name the API gave it. */
function save(response: HttpResponse<Blob>): void {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'template.xlsx';
  const url = URL.createObjectURL(response.body as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

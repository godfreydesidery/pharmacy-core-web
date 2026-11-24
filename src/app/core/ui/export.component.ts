import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SILENT } from '../api/api.interceptor';
import { Query, apiUrl, toParams } from '../api/api.service';
import { PagedList } from '../data/data';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { IconComponent } from './icon.component';
import { ToastService } from './toast.service';

/**
 * The Export button of a list: Excel or CSV of every row its filters match, made by the API
 * (`<path>?format=&lang=` with the list's own filters), headed in the person's language.
 */
@Component({
  selector: 'app-export',
  imports: [TranslatePipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="export">
      <button
        class="btn"
        type="button"
        [disabled]="busy()"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        <app-icon name="download" [size]="16" />
        {{ (busy() ? 'ui.export.working' : 'ui.export.button') | t }}
      </button>
      @if (open()) {
        <div class="menu" role="menu">
          <button type="button" role="menuitem" (click)="download('xlsx')">
            {{ 'ui.export.xlsx' | t }}
          </button>
          <button type="button" role="menuitem" (click)="download('csv')">
            {{ 'ui.export.csv' | t }}
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .export {
      position: relative;
      display: inline-block;
    }
    .menu {
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 20;
      min-width: 180px;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: 10px;
      background: var(--surface, #fff);
      box-shadow: 0 10px 24px rgb(0 0 0 / 12%);
      display: grid;
    }
    .menu button {
      text-align: left;
      padding: 8px 10px;
      border: 0;
      border-radius: 6px;
      background: none;
      cursor: pointer;
      color: inherit;
      font: inherit;
    }
    .menu button:hover {
      background: var(--surface-2, var(--bg));
    }
  `,
})
export class ExportComponent {
  private readonly http = inject(HttpClient);
  private readonly translations = inject(Translations);
  private readonly toasts = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  /** The export route; by default the list's own path with /export, such as /products/export. */
  readonly path = input<string | null>(null);
  /** The list whose filters it takes (or give them in {@code query}). */
  readonly list = input<PagedList<unknown> | null>(null);
  readonly query = input<Query | null>(null);
  protected readonly open = signal(false);
  protected readonly busy = signal(false);

  @HostListener('document:click', ['$event'])
  protected close(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected async download(format: 'xlsx' | 'csv'): Promise<void> {
    this.open.set(false);
    this.busy.set(true);
    const filters = this.query() ?? this.list()?.request()?.query ?? {};
    try {
      const response = await firstValueFrom(
        this.http.get(apiUrl(this.path() ?? `${this.list()?.request()?.path}/export`), {
          params: toParams({ ...filters, format, lang: this.translations.lang() }),
          responseType: 'blob',
          observe: 'response',
          context: new HttpContext().set(SILENT, true),
        }),
      );
      save(response);
    } catch (failure) {
      this.toasts.error(await reason(failure, this.translations.t('ui.export.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}

/**
 * GETs a file from the API (such as a pharmacy's data export) and saves it under the name the API
 * gave it; a refusal becomes a toast in the API's own words. True when it was saved. A file the
 * API makes on a POST (a customer's personal data, which also records the request) passes
 * `{ method: 'POST', body }`.
 */
export async function downloadFrom(
  http: HttpClient,
  path: string,
  toasts: ToastService,
  fallback: string,
  request: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<boolean> {
  const options = {
    responseType: 'blob' as const,
    observe: 'response' as const,
    context: new HttpContext().set(SILENT, true),
  };
  try {
    save(
      await firstValueFrom(
        request.method === 'POST'
          ? http.post(apiUrl(path), request.body ?? {}, options)
          : http.get(apiUrl(path), options),
      ),
    );
    return true;
  } catch (failure) {
    toasts.error(await reason(failure, fallback));
    return false;
  }
}

/** Saves the answer under the name the API gave it. */
function save(response: HttpResponse<Blob>): void {
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? 'export';
  const url = URL.createObjectURL(response.body as Blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The API's own words for a refused export (its problem arrives as a blob), else a fallback. */
async function reason(failure: unknown, fallback: string): Promise<string> {
  const body = (failure as { error?: unknown })?.error;
  if (body instanceof Blob) {
    try {
      const problem = JSON.parse(await body.text()) as { detail?: string };
      return problem.detail ?? fallback;
    } catch {
      return fallback;
    }
  }
  return (failure as Error)?.message ?? fallback;
}

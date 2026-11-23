import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../api/api.service';
import { ApiError } from '../api/api-error';
import { Translations } from '../i18n/translations.store';
import { ToastService } from './toast.service';

/** `GET /data-export/{uid}`: a background export of every record of the pharmacy. */
export interface DataExportJob {
  uid: string;
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED';
  downloadUrl?: string | null;
  downloadExpiresAt?: string | null;
  sizeBytes?: number | null;
  error?: string | null;
}

const POLL_MS = 3000;
/** Stop waiting on this screen after this long; the export still finishes and can be fetched. */
const GIVE_UP_MS = 15 * 60 * 1000;

/**
 * The pharmacy's full export (its right to take its data) as a background job (INT-7): start it,
 * wait while the server builds the ZIP in short steps, then download it from a short-lived signed
 * link. One export runs at a time per pharmacy; asking again joins the one running.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyExportService {
  private readonly api = inject(Api);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);

  /** An export is being prepared on this screen. */
  readonly busy = signal(false);

  async run(): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    try {
      const job = await this.start();
      this.toasts.success(this.translations.t('data.preparing'));
      const done = await this.wait(job.uid);
      if (done?.status === 'READY' && done.downloadUrl) {
        this.download(done.downloadUrl);
        this.toasts.success(this.translations.t('data.ready'));
      } else if (done?.status === 'FAILED') {
        this.toasts.error(done.error || this.translations.t('close.exportFailed'));
      } else if (done) {
        this.toasts.error(this.translations.t('data.expired'));
      } else {
        this.toasts.error(this.translations.t('data.stillPreparing'));
      }
    } catch (failure) {
      this.toasts.error((failure as ApiError).message || this.translations.t('close.exportFailed'));
    } finally {
      this.busy.set(false);
    }
  }

  /** Starts an export, or joins the one already running. */
  private async start(): Promise<{ uid: string }> {
    try {
      return await this.api.post<DataExportJob>('/data-export', {}, { silent: true });
    } catch (failure) {
      const error = ApiError.from(failure);
      const running = error.extras['uid'];
      if (error.reason === 'export_running' && typeof running === 'string') {
        return { uid: running };
      }
      throw error;
    }
  }

  /** Polls until the export leaves PENDING/RUNNING; null when it takes too long here. */
  private async wait(uid: string): Promise<DataExportJob | null> {
    const until = Date.now() + GIVE_UP_MS;
    while (Date.now() < until) {
      const job = await this.api.get<DataExportJob>(`/data-export/${uid}`, undefined, {
        silent: true,
      });
      if (job.status !== 'PENDING' && job.status !== 'RUNNING') {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return null;
  }

  /** The link is signed and short-lived: opened directly, without the session's headers. */
  private download(url: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = url.split('?')[0].split('/').pop() || 'export.zip';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
}

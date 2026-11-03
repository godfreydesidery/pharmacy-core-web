import { Injectable, inject, signal } from '@angular/core';
import { FilesService, StoredFile } from './files.service';

/**
 * The current pharmacy's logo (a TENANT/LOGO file) as a short-lived presigned URL, for the top bar
 * and receipts. It is refreshed before the URL expires.
 */
@Injectable({ providedIn: 'root' })
export class TenantLogoStore {
  private readonly files = inject(FilesService);
  private tenantUid: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly url = signal<string | null>(null);
  readonly file = signal<StoredFile | null>(null);

  async load(tenantUid: string | null): Promise<void> {
    this.tenantUid = tenantUid;
    this.stopTimer();
    if (!tenantUid) {
      this.url.set(null);
      this.file.set(null);
      return;
    }
    try {
      const logos = (await this.files.list({ ownerType: 'TENANT', ownerUid: tenantUid })).filter(
        (f) => f.purpose === 'LOGO' && f.contentType.startsWith('image/'),
      );
      const latest = logos[0] ?? null;
      this.file.set(latest);
      this.url.set(latest ? await this.files.url(latest.uid) : null);
      if (latest) {
        // presigned URLs last five minutes: refresh a little earlier
        this.timer = setTimeout(() => void this.load(this.tenantUid), 4 * 60 * 1000);
      }
    } catch {
      this.url.set(null);
    }
  }

  reload(): Promise<void> {
    return this.load(this.tenantUid);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

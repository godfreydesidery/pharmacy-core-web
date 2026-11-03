import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { WhenPipe } from '../format/pipes';
import { TranslatePipe } from '../i18n/t.pipe';
import { IconComponent } from '../ui/icon.component';
import { FilesService, OwnerType, Purpose, StoredFile } from './files.service';
import { UploadComponent } from './upload.component';

/**
 * The files attached to a record, such as a sale's prescription image or a goods receipt's
 * supplier invoice: image thumbnails (presigned, short-lived), PDFs as links, an upload zone and
 * remove buttons when allowed.
 */
@Component({
  selector: 'app-attachments',
  imports: [IconComponent, TranslatePipe, WhenPipe, UploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card attachments">
      <div class="card-head">
        <h3><app-icon name="paperclip" [size]="16" /> {{ title() ?? 'files.attachments' | t }}</h3>
        <span class="muted small">{{ files().length }}</span>
      </div>
      <div class="card-body">
        @if (files().length) {
          <ul class="grid">
            @for (file of files(); track file.uid) {
              <li class="item">
                @if (isImage(file) && urls()[file.uid]; as url) {
                  <a class="thumb" [href]="url" target="_blank" rel="noopener">
                    <img [src]="url" [alt]="file.name" loading="lazy" />
                  </a>
                } @else {
                  <button class="thumb doc" type="button" (click)="open(file)">
                    <app-icon [name]="isImage(file) ? 'image' : 'file'" [size]="26" />
                  </button>
                }
                <div class="meta">
                  <b [title]="file.name">{{ file.name }}</b>
                  <small>{{ size(file.size) }} · {{ file.createdAt | when }}</small>
                </div>
                <div class="actions">
                  <button
                    class="icon-btn sm"
                    type="button"
                    (click)="open(file)"
                    [attr.aria-label]="'files.open' | t"
                  >
                    <app-icon name="external" [size]="15" />
                  </button>
                  @if (canManage()) {
                    <button
                      class="icon-btn sm danger"
                      type="button"
                      (click)="remove(file)"
                      [attr.aria-label]="'common.remove' | t"
                    >
                      <app-icon name="trash" [size]="15" />
                    </button>
                  }
                </div>
              </li>
            }
          </ul>
        } @else if (!canManage()) {
          <p class="muted small">{{ 'files.noAttachments' | t }}</p>
        }
        @if (canManage() && ownerUid()) {
          <app-upload
            [compact]="true"
            [owner]="{ ownerType: ownerType(), ownerUid: ownerUid(), purpose: purpose() }"
            (uploaded)="added($event)"
          />
        }
      </div>
    </div>
  `,
  styles: `
    .attachments .card-head h3 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-body {
      display: grid;
      gap: 12px;
    }
    .grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
    }
    .thumb {
      width: 52px;
      height: 52px;
      flex-shrink: 0;
      border-radius: 9px;
      overflow: hidden;
      display: grid;
      place-items: center;
      background: var(--surface-2);
      border: 0;
      color: var(--muted);
      cursor: pointer;
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .meta {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .meta b {
      font-weight: 600;
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .meta small,
    .small {
      color: var(--muted);
      font-size: 12px;
    }
    .actions {
      display: flex;
      gap: 2px;
    }
  `,
})
export class AttachmentsComponent {
  private readonly service = inject(FilesService);

  readonly ownerType = input.required<OwnerType>();
  readonly ownerUid = input.required<string | null>();
  readonly purpose = input<Purpose>('ATTACHMENT');
  readonly canManage = input(false);
  readonly title = input<string | null>(null);

  protected readonly files = signal<StoredFile[]>([]);
  protected readonly urls = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const ownerUid = this.ownerUid();
      const ownerType = this.ownerType();
      if (ownerUid) {
        void this.load(ownerType, ownerUid);
      } else {
        this.files.set([]);
      }
    });
  }

  /** Reloads, such as after the caller uploaded a file itself. */
  reload(): void {
    const ownerUid = this.ownerUid();
    if (ownerUid) {
      void this.load(this.ownerType(), ownerUid);
    }
  }

  protected isImage(file: StoredFile): boolean {
    return file.contentType.startsWith('image/');
  }

  protected size(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected async open(file: StoredFile): Promise<void> {
    window.open(await this.service.url(file.uid), '_blank', 'noopener');
  }

  protected async remove(file: StoredFile): Promise<void> {
    await this.service.delete(file.uid);
    this.files.update((files) => files.filter((f) => f.uid !== file.uid));
  }

  protected added(file: StoredFile): void {
    this.files.update((files) => [file, ...files]);
    void this.thumbnail(file);
  }

  private async load(ownerType: OwnerType, ownerUid: string): Promise<void> {
    const files = await this.service.list({ ownerType, ownerUid });
    this.files.set(files);
    await Promise.all(files.filter((f) => this.isImage(f)).map((f) => this.thumbnail(f)));
  }

  private async thumbnail(file: StoredFile): Promise<void> {
    if (!this.isImage(file)) {
      return;
    }
    try {
      const url = await this.service.url(file.uid);
      this.urls.update((urls) => ({ ...urls, [file.uid]: url }));
    } catch {
      /* the icon stays */
    }
  }
}

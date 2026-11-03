import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '../i18n/t.pipe';
import { Translations } from '../i18n/translations.store';
import { IconComponent } from '../ui/icon.component';
import { ToastService } from '../ui/toast.service';
import { FilesService, Owner, StoredFile, fileProblem } from './files.service';

/**
 * A drop zone: drag a file onto it or click to choose. With an owner it uploads at once (presigned
 * PUT with progress) and emits `uploaded`; without one it only emits `picked`, so the caller can
 * upload later, such as a prescription image once the sale exists.
 */
@Component({
  selector: 'app-upload',
  imports: [IconComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="dropzone"
      [class.over]="over()"
      [class.busy]="percent() !== null"
      [class.compact]="compact()"
      role="button"
      tabindex="0"
      (click)="choose()"
      (keydown.enter)="choose()"
      (keydown.space)="choose(); $event.preventDefault()"
      (dragover)="$event.preventDefault(); over.set(true)"
      (dragleave)="over.set(false)"
      (drop)="drop($event)"
    >
      <input #picker type="file" hidden [accept]="accept()" (change)="pickedFromInput($event)" />
      @if (percent() !== null) {
        <div class="progress" [style.width.%]="percent()"></div>
        <app-icon name="upload" [size]="18" />
        <span>{{ 'files.uploading' | t: { percent: percent() } }}</span>
      } @else if (chosen(); as file) {
        <app-icon name="file" [size]="18" />
        <span class="name">{{ file.name }}</span>
        <button
          class="icon-btn sm"
          type="button"
          (click)="clear($event)"
          [attr.aria-label]="'common.remove' | t"
        >
          <app-icon name="x" [size]="14" />
        </button>
      } @else {
        <span class="bubble tone-blue"><app-icon name="upload" [size]="18" /></span>
        <span class="text">
          <b>{{ label() ?? 'files.dropHere' | t }}</b>
          <small>{{ 'files.types' | t }}</small>
        </span>
      }
    </div>
  `,
  styles: `
    .dropzone {
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 18px;
      border: 1.5px dashed var(--border-strong, var(--border));
      border-radius: var(--radius);
      background: var(--surface-2);
      color: var(--text);
      cursor: pointer;
      transition:
        border-color 0.15s,
        background 0.15s,
        transform 0.15s;
    }
    .dropzone:hover,
    .dropzone:focus-visible,
    .dropzone.over {
      border-color: var(--primary);
      background: color-mix(in srgb, var(--primary) 6%, var(--surface));
      outline: none;
    }
    .dropzone.over {
      transform: scale(1.01);
    }
    .dropzone.compact {
      padding: 10px 14px;
    }
    .dropzone .text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .dropzone small {
      color: var(--muted);
      font-size: 12px;
    }
    .dropzone .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 500;
    }
    .progress {
      position: absolute;
      inset: 0 auto 0 0;
      background: color-mix(in srgb, var(--primary) 14%, transparent);
      transition: width 0.2s;
      pointer-events: none;
    }
    .bubble {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
    }
  `,
})
export class UploadComponent {
  private readonly files = inject(FilesService);
  private readonly toasts = inject(ToastService);
  private readonly translations = inject(Translations);
  private readonly picker = viewChild.required<ElementRef<HTMLInputElement>>('picker');

  /** Upload at once to this owner; without one the file is only picked. */
  readonly owner = input<Owner | null>(null);
  readonly accept = input('image/png,image/jpeg,image/webp,application/pdf');
  readonly label = input<string | null>(null);
  readonly compact = input(false);
  readonly uploaded = output<StoredFile>();
  readonly picked = output<File | null>();

  protected readonly over = signal(false);
  protected readonly percent = signal<number | null>(null);
  protected readonly chosen = signal<File | null>(null);

  protected choose(): void {
    if (this.percent() === null) {
      this.picker().nativeElement.click();
    }
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      void this.take(file);
    }
  }

  protected pickedFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.take(file);
    }
  }

  protected clear(event: Event): void {
    event.stopPropagation();
    this.chosen.set(null);
    this.picked.emit(null);
  }

  /** Forgets a picked file, such as after the caller uploaded it. */
  reset(): void {
    this.chosen.set(null);
  }

  private async take(file: File): Promise<void> {
    const problem = fileProblem(file);
    if (problem) {
      this.toasts.error(this.translations.t(problem));
      return;
    }
    const owner = this.owner();
    if (!owner) {
      this.chosen.set(file);
      this.picked.emit(file);
      return;
    }
    this.percent.set(0);
    try {
      const stored = await this.files.upload(file, owner, (p) => this.percent.set(p));
      this.toasts.success(this.translations.t('files.uploaded', { name: stored.name }));
      this.uploaded.emit(stored);
    } catch (error) {
      if (error instanceof Error && !('status' in error)) {
        this.toasts.error(error.message);
      }
    } finally {
      this.percent.set(null);
    }
  }
}

import { HttpInterceptorFn } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injectable,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { finalize } from 'rxjs';
import { SILENT } from '../api/api.interceptor';
import { TranslatePipe } from '../i18n/t.pipe';

/** A wait shorter than this shows no bar, so quick answers do not flicker. */
export const LOADING_DELAY_MS = 200;

/** What the app is waiting for: a page being opened, and the API reads and saves in flight. */
@Injectable({ providedIn: 'root' })
export class LoadingState {
  /** Requests in flight that the page waits on (background ones, marked silent, are not counted). */
  readonly requests = signal(0);
  /** A route (and its lazy chunk) is being loaded. */
  readonly navigating = signal(false);
  readonly busy = computed(() => this.navigating() || this.requests() > 0);

  started(): void {
    this.requests.update((n) => n + 1);
  }

  finished(): void {
    this.requests.update((n) => Math.max(0, n - 1));
  }
}

/**
 * Counts the API requests the page waits on (UX-14). A request marked silent is the page's own
 * background work (a price quote, a poll) and shows no bar.
 */
export const loadingInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.context.get(SILENT)) {
    return next(request);
  }
  const state = inject(LoadingState);
  state.started();
  return next(request).pipe(finalize(() => state.finished()));
};

/**
 * The thin bar along the top of the window while a page or the data it asked for is loading
 * (UX-14). It shows only after {@link LOADING_DELAY_MS}, and tells assistive technology the page
 * is busy.
 */
@Component({
  selector: 'app-loading-bar',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (shown()) {
      <div
        class="loading-bar"
        role="progressbar"
        data-testid="loading-bar"
        [attr.aria-label]="'common.loading' | t"
      >
        <span></span>
      </div>
    }
  `,
  styles: `
    .loading-bar {
      position: fixed;
      inset: 0 0 auto 0;
      height: 3px;
      z-index: 200;
      overflow: hidden;
      background: var(--primary-soft, transparent);
      pointer-events: none;
    }
    span {
      position: absolute;
      inset: 0 auto 0 0;
      width: 40%;
      background: var(--primary);
      animation: slide 1.1s ease-in-out infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(260%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      span {
        width: 100%;
        animation: none;
        opacity: 0.7;
      }
    }
    @media print {
      .loading-bar {
        display: none;
      }
    }
  `,
})
export class LoadingBarComponent {
  private readonly state = inject(LoadingState);
  protected readonly shown = signal(false);

  constructor() {
    const router = inject(Router);
    const subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.state.navigating.set(true);
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.state.navigating.set(false);
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
    let timer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const busy = this.state.busy();
      clearTimeout(timer);
      if (busy) {
        timer = setTimeout(() => this.shown.set(true), LOADING_DELAY_MS);
      } else {
        this.shown.set(false);
      }
    });
  }
}

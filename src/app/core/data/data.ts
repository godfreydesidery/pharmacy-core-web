import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Api, Query, RequestOptions } from '../api/api.service';
import { ApiError } from '../api/api-error';
import { Page } from '../api/models';
import { SessionStore } from '../session/session.store';

export interface ListRequest {
  path: string;
  query?: Query;
  options?: RequestOptions;
}

/**
 * How {@link loaded} reads a value the API pages (a statement's entries): the next page's cursor
 * of what was read, and how a following page joins it. At most {@code maxPages} are read.
 */
export interface FollowPages<T> {
  next(value: T): string | null;
  join(sofar: T, page: T): T;
  maxPages?: number;
}

/**
 * What a list or value read from the API shows besides its rows: loading, or the failure of its
 * last read and a way to read it again. The shared empty widget takes one (`<app-empty [for]>`),
 * so a list that failed to load says so, with Retry, instead of looking empty.
 */
export interface LoadState {
  readonly loading: Signal<boolean>;
  /** The last read's failure, cleared when a read starts; the rows are empty meanwhile. */
  readonly error: Signal<ApiError | null>;
  reload(): Promise<void>;
}

export interface PagedList<T> extends LoadState {
  readonly items: Signal<T[]>;
  /** How many rows the whole list has (null until the first page arrives). */
  readonly total: Signal<number | null>;
  /** The API capped the count: the list has more rows than {@link total} (shown as "10,000+"). */
  readonly capped: Signal<boolean>;
  /** The page shown, from 1. */
  readonly page: Signal<number>;
  /** Rows per page. */
  readonly size: Signal<number>;
  /** How many pages the list has (at least 1). */
  readonly pages: Signal<number>;
  /** The request the list shows (its path and filters), such as for an export of it. */
  readonly request: Signal<ListRequest | null>;
  readonly hasMore: Signal<boolean>;
  /** Shows page {@code page} (kept between 1 and the last). */
  goTo(page: number): Promise<void>;
  /** Changes rows per page, back to page 1; remembered for every table. */
  setSize(size: number): void;
  /** The next page. */
  more(): Promise<void>;
}

/** Rows per page a table may show; 25 unless the person chose another. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;
const SIZE_KEY = 'pharmacy-core.page-size';

function rememberedSize(fallback: number): number {
  try {
    const saved = Number(localStorage.getItem(SIZE_KEY));
    return (PAGE_SIZES as readonly number[]).includes(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A list shown one numbered page at a time, read from the API (`?page=&limit=`, whose answer
 * carries the total). It loads when created and again, from page 1, whenever its request, the
 * tenant or the branch changes. Responses that arrive after a newer request are dropped. Return
 * `null` from `request` to wait, such as until a filter is set.
 */
export function pagedList<T>(request: () => ListRequest | null, limit = 25): PagedList<T> {
  const api = inject(Api);
  const session = inject(SessionStore);
  const items = signal<T[]>([]);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const total = signal<number | null>(null);
  const capped = signal(false);
  const page = signal(1);
  const size = signal(rememberedSize(limit));
  const pages = computed(() => Math.max(1, Math.ceil((total() ?? 0) / size())));
  let generation = 0;
  let current: ListRequest | null = null;
  const shown = signal<ListRequest | null>(null);

  async function fetch(wanted: number): Promise<void> {
    if (!current) {
      return;
    }
    const mine = ++generation;
    loading.set(true);
    error.set(null);
    try {
      const answer = await api.get<Page<T>>(
        current.path,
        { ...current.query, page: wanted, limit: size() },
        current.options,
      );
      if (mine !== generation) {
        return;
      }
      // A list that answers whole (not paged) is shown as one page.
      const rows = Array.isArray(answer) ? (answer as unknown as T[]) : answer.items;
      items.set(rows);
      page.set(wanted);
      total.set(Array.isArray(answer) ? rows.length : (answer.total ?? rows.length));
      capped.set(!Array.isArray(answer) && answer.totalCapped === true);
      // A page past the end (rows deleted meanwhile): show the last one instead.
      const last = Math.max(1, Math.ceil((total() ?? 0) / size()));
      if (wanted > last) {
        await fetch(last);
      }
    } catch (failure) {
      if (mine === generation) {
        // Not an empty list: the empty widget shows the failure and Retry (LoadState).
        error.set(ApiError.from(failure));
        items.set([]);
      }
    } finally {
      if (mine === generation) {
        loading.set(false);
      }
    }
  }

  effect(() => {
    session.tenant();
    session.branch();
    const next = request();
    untracked(() => {
      current = next;
      shown.set(next);
      if (next) {
        void fetch(1);
      } else {
        items.set([]);
        total.set(null);
        capped.set(false);
        page.set(1);
      }
    });
  });

  const goTo = (wanted: number) => fetch(Math.min(Math.max(1, Math.trunc(wanted) || 1), pages()));

  return {
    items,
    loading,
    error,
    total,
    capped,
    page,
    size,
    pages,
    request: shown,
    hasMore: computed(() => page() < pages()),
    reload: () => fetch(page()),
    goTo,
    setSize: (next: number) => {
      size.set(next);
      try {
        localStorage.setItem(SIZE_KEY, String(next));
      } catch {
        // Remembering is a convenience; the table works without it.
      }
      void fetch(1);
    },
    more: () => goTo(page() + 1),
  };
}

export interface Loaded<T> extends LoadState {
  readonly value: Signal<T | null>;
  set(value: T): void;
}

/** One value read from the API, reloaded like {@link pagedList}. */
export function loaded<T>(request: () => ListRequest | null, follow?: FollowPages<T>): Loaded<T> {
  const api = inject(Api);
  const session = inject(SessionStore);
  const value = signal<T | null>(null);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  let generation = 0;
  let current: ListRequest | null = null;

  async function fetch(): Promise<void> {
    if (!current) {
      value.set(null);
      return;
    }
    const mine = ++generation;
    loading.set(true);
    error.set(null);
    try {
      let result: T = await api.get<T>(current.path, current.query, current.options);
      // A paged value is read to its end (up to maxPages), each page after the cursor of the last.
      for (let page = 1, cursor = follow?.next(result); follow && cursor; page++) {
        if (page >= (follow.maxPages ?? 50) || mine !== generation) {
          break;
        }
        const more: T = await api.get<T>(
          current.path,
          { ...(current.query ?? {}), cursor },
          current.options,
        );
        result = follow.join(result, more);
        cursor = follow.next(more);
      }
      if (mine === generation) {
        value.set(result);
      }
    } catch (failure) {
      if (mine === generation) {
        error.set(ApiError.from(failure));
      }
    } finally {
      if (mine === generation) {
        loading.set(false);
      }
    }
  }

  effect(() => {
    session.tenant();
    session.branch();
    const next = request();
    untracked(() => {
      current = next;
      void fetch();
    });
  });

  return { value, loading, error, reload: fetch, set: (next: T) => value.set(next) };
}

/** A debounced copy of a signal, for search boxes. */
export function debounced<T>(source: Signal<T>, ms = 300): Signal<T> {
  const out = signal(untracked(source));
  let timer: ReturnType<typeof setTimeout> | undefined;
  effect(() => {
    const value = source();
    clearTimeout(timer);
    timer = setTimeout(() => out.set(value), ms);
  });
  return out;
}

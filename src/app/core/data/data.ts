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

export interface PagedList<T> {
  readonly items: Signal<T[]>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<ApiError | null>;
  /** How many rows the whole list has (null until the first page arrives). */
  readonly total: Signal<number | null>;
  /** The page shown, from 1. */
  readonly page: Signal<number>;
  /** Rows per page. */
  readonly size: Signal<number>;
  /** How many pages the list has (at least 1). */
  readonly pages: Signal<number>;
  readonly hasMore: Signal<boolean>;
  reload(): Promise<void>;
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
  const page = signal(1);
  const size = signal(rememberedSize(limit));
  const pages = computed(() => Math.max(1, Math.ceil((total() ?? 0) / size())));
  let generation = 0;
  let current: ListRequest | null = null;

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
      // A page past the end (rows deleted meanwhile): show the last one instead.
      const last = Math.max(1, Math.ceil((total() ?? 0) / size()));
      if (wanted > last) {
        await fetch(last);
      }
    } catch (failure) {
      if (mine === generation) {
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
      if (next) {
        void fetch(1);
      } else {
        items.set([]);
        total.set(null);
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
    page,
    size,
    pages,
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

export interface Loaded<T> {
  readonly value: Signal<T | null>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<ApiError | null>;
  reload(): Promise<void>;
  set(value: T): void;
}

/** One value read from the API, reloaded like {@link pagedList}. */
export function loaded<T>(request: () => ListRequest | null): Loaded<T> {
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
      const result = await api.get<T>(current.path, current.query, current.options);
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

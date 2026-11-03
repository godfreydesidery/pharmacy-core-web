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
  readonly total: Signal<number | null>;
  readonly hasMore: Signal<boolean>;
  reload(): Promise<void>;
  more(): Promise<void>;
}

/**
 * A cursor-paged list that loads when created and again whenever its request, the tenant or the
 * branch changes. Responses that arrive after a newer request are dropped. Return `null` from
 * `request` to wait, such as until a filter is set.
 */
export function pagedList<T>(request: () => ListRequest | null, limit = 25): PagedList<T> {
  const api = inject(Api);
  const session = inject(SessionStore);
  const items = signal<T[]>([]);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const total = signal<number | null>(null);
  const cursor = signal<string | null>(null);
  let generation = 0;
  let current: ListRequest | null = null;

  async function fetch(after: string | null): Promise<void> {
    if (!current) {
      return;
    }
    const mine = ++generation;
    loading.set(true);
    error.set(null);
    try {
      const page = await api.get<Page<T>>(
        current.path,
        { ...current.query, cursor: after, limit },
        current.options,
      );
      if (mine !== generation) {
        return;
      }
      items.set(after ? [...items(), ...page.items] : page.items);
      cursor.set(page.nextCursor);
      total.set(page.total);
    } catch (failure) {
      if (mine === generation) {
        error.set(ApiError.from(failure));
        if (!after) {
          items.set([]);
        }
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
      cursor.set(null);
      if (next) {
        void fetch(null);
      } else {
        items.set([]);
      }
    });
  });

  return {
    items,
    loading,
    error,
    total,
    hasMore: computed(() => cursor() !== null),
    reload: () => fetch(null),
    more: () => fetch(cursor()),
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

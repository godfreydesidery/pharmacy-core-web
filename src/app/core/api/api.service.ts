import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NO_BRANCH, SILENT } from './api.interceptor';

export const API_BASE = '/api/v1';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export interface RequestOptions {
  /** The caller shows the error itself; no toast. */
  silent?: boolean;
  /** Leave `X-Branch-Id` out, for a tenant-wide read. */
  noBranch?: boolean;
  /** Overrides, such as `X-Tenant-Id` while the root administrator is still choosing a tenant. */
  headers?: Record<string, string>;
}

/** Builds query parameters, leaving out empty values. */
export function toParams(query: Query = {}): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The API as promises; the interceptor has already unwrapped the envelope. */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: Query, options: RequestOptions = {}): Promise<T> {
    return firstValueFrom(
      this.http.get<T>(apiUrl(path), { params: toParams(query), ...this.extras(options) }),
    );
  }

  post<T>(path: string, body: unknown = {}, options: RequestOptions = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(apiUrl(path), body, this.extras(options)));
  }

  put<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
    return firstValueFrom(this.http.put<T>(apiUrl(path), body, this.extras(options)));
  }

  delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return firstValueFrom(this.http.delete<T>(apiUrl(path), this.extras(options)));
  }

  private extras(options: RequestOptions): { context: HttpContext; headers?: HttpHeaders } {
    const context = new HttpContext()
      .set(SILENT, options.silent ?? false)
      .set(NO_BRANCH, options.noBranch ?? false);
    return options.headers ? { context, headers: new HttpHeaders(options.headers) } : { context };
  }
}

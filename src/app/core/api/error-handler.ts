import { ErrorHandler, Injectable } from '@angular/core';
import { ApiError } from './api-error';

/**
 * Logs unexpected errors only. An API refusal (4xx) has already been shown to the person as a toast
 * or a field message by the interceptor; when a click handler lets it escape, logging it again as
 * an uncaught error with a stack trace only buries the real failures.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const cause = (error as { rejection?: unknown })?.rejection ?? error;
    if (cause instanceof ApiError && cause.status > 0 && cause.status < 500) {
      return;
    }
    console.error(error);
  }
}

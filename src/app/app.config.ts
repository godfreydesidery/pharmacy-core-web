import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { apiInterceptor } from './core/api/api.interceptor';
import { reloadOnStaleBuild } from './core/layout/stale-build';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({ skipInitialTransition: true }),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      withNavigationErrorHandler(reloadOnStaleBuild),
    ),
    provideHttpClient(withFetch(), withInterceptors([apiInterceptor])),
  ],
};

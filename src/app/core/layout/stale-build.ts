import { NavigationError } from '@angular/router';

const RELOADED = 'pharmacy.staleReload';

/** The browser's wording when a lazy page's file is gone or is not JavaScript. */
const CHUNK_FAILURE =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk|MIME type/i;

/**
 * A tab opened before a deploy still asks for the previous build's page files, which no longer
 * exist, so its links silently do nothing. Reload once at the page the person clicked: the fresh
 * index.html points at the current files. The session marker stops a reload loop if the failure
 * has another cause.
 */
export function reloadOnStaleBuild(error: NavigationError): void {
  const message = String((error.error as Error | undefined)?.message ?? error.error);
  if (!CHUNK_FAILURE.test(message)) {
    return;
  }
  try {
    if (sessionStorage.getItem(RELOADED) === error.url) {
      return;
    }
    sessionStorage.setItem(RELOADED, error.url);
  } catch {
    /* storage blocked: still reload once */
  }
  window.location.assign(error.url);
}

import { Injectable, inject } from '@angular/core';
import { Translations } from '../i18n/translations.store';
import { ConfirmService } from '../ui/confirm';
import { ApiError } from './api-error';

/**
 * Optimistic concurrency on a save (RFC 9110 §13.1.1 `If-Match`): a form sends the version of the
 * record as it loaded it, and the API refuses the save (412 `precondition_failed`) when someone
 * else changed the record meanwhile, instead of quietly overwriting their change.
 *
 * `this.api.put(path, body, { noBranch: true, headers: ifMatch(record.version) })`
 *
 * The entity tag is the record's version number, strong and quoted: `If-Match: "7"`. A record with
 * no version yet (an API that does not send one) sends no header.
 */
export function ifMatch(version: number | null | undefined): Record<string, string> {
  return typeof version === 'number' && Number.isFinite(version)
    ? { 'If-Match': `"${version}"` }
    : {};
}

/**
 * The save crossed another person's change: 412 `precondition_failed` (the `If-Match` version is
 * not the record's any more), or 409 `stale_version` (the product's body version, a change that
 * crossed in flight). Both mean the same to the person: reload to see the other change.
 */
export function isStaleWrite(failure: unknown): boolean {
  return (
    failure instanceof ApiError &&
    (failure.status === 412 ||
      failure.reason === 'precondition_failed' ||
      failure.reason === 'stale_version')
  );
}

/**
 * Explains a save refused because someone else changed the record, in the app's dialog: "Reload"
 * reads the record again into the form (the local edits are dropped), "Keep editing" leaves the
 * form as it is. The interceptor shows no toast for such a refusal of a request sent with
 * `If-Match`; this dialog is the one message.
 *
 * ```
 * } catch (failure) {
 *   if (await this.stale.handle(failure, () => this.load())) return;
 *   ...
 * ```
 */
@Injectable({ providedIn: 'root' })
export class StaleRecordService {
  private readonly confirm = inject(ConfirmService);
  private readonly translations = inject(Translations);

  /**
   * When {@code failure} is a stale write, asks and, on "Reload", runs {@code reload}. True when it
   * was one (the caller shows nothing else); false for any other failure, which the caller handles.
   */
  async handle(failure: unknown, reload: () => unknown): Promise<boolean> {
    if (!isStaleWrite(failure)) {
      return false;
    }
    const reloading = await this.confirm.ask({
      key: 'stale-record',
      icon: 'warning',
      title: this.translations.t('ui.stale.title'),
      text: this.translations.t('ui.stale.text'),
      confirmText: this.translations.t('ui.stale.reload'),
      cancelText: this.translations.t('ui.stale.keep'),
      // Reload drops the edits on screen: a stray Enter keeps them.
      focus: 'cancel',
    });
    if (reloading) {
      await reload();
    }
    return true;
  }
}

/**
 * The pharmacy code of a staff login as people type it, such as `DAWA` for `juma@DAWA`, or null
 * for an email address. A staff login (a managed account) has no dot after the @, which every
 * email has, and its pharmacy code is 2 to 12 letters or digits. Its password is reset by the
 * pharmacy (Administration → Users → Reset password), never by an email link or an SMS code.
 */
export function staffLoginCode(value: string | null | undefined): string | null {
  const text = (value ?? '').trim();
  const at = text.lastIndexOf('@');
  if (at < 1) {
    return null;
  }
  const code = text.slice(at + 1);
  return /^[A-Za-z0-9]{2,12}$/.test(code) ? code.toUpperCase() : null;
}

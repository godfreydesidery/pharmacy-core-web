/**
 * A sign-in as people type it. An email stays as it is; a pharmacy's staff login, stored in lower
 * case (juma@dawa), shows its pharmacy code in capitals: juma@DAWA. A staff login is told apart by
 * having no dot after the @, which every email has.
 */
export function signInLabel(signIn: string | null | undefined): string {
  if (!signIn) {
    return '';
  }
  const at = signIn.lastIndexOf('@');
  if (at < 0 || signIn.slice(at + 1).includes('.')) {
    return signIn;
  }
  return signIn.slice(0, at + 1) + signIn.slice(at + 1).toUpperCase();
}

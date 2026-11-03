/**
 * Passkeys in the browser (WebAuthn Level 3). The API sends ceremony options in the WebAuthn JSON
 * form, with base64url binary values; these helpers turn them into what `navigator.credentials`
 * takes and turn its credential back into JSON, without relying on the newer `parse…FromJSON`
 * helpers, so every current browser works.
 */

export function passkeysSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'PublicKeyCredential' in window && !!navigator.credentials
  );
}

export function fromBase64Url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function toBase64Url(
  buffer: ArrayBuffer | ArrayBufferView | null | undefined,
): string | null {
  if (!buffer) {
    return null;
  }
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

type Json = Record<string, unknown>;

function descriptors(list: unknown): PublicKeyCredentialDescriptor[] | undefined {
  if (!Array.isArray(list)) {
    return undefined;
  }
  return list.map((item: Json) => ({
    ...(item as object),
    type: 'public-key',
    id: fromBase64Url(item['id'] as string),
  })) as PublicKeyCredentialDescriptor[];
}

/** Registers a passkey with the creation options and returns the credential as JSON. */
export async function createPasskey(publicKey: Json): Promise<Json> {
  const user = publicKey['user'] as Json;
  const options = {
    ...publicKey,
    challenge: fromBase64Url(publicKey['challenge'] as string),
    user: { ...user, id: fromBase64Url(user['id'] as string) },
    excludeCredentials: descriptors(publicKey['excludeCredentials']),
  } as unknown as PublicKeyCredentialCreationOptions;
  const credential = (await navigator.credentials.create({
    publicKey: options,
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error('No passkey was created.');
  }
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      attestationObject: toBase64Url(response.attestationObject),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults() ?? {},
  };
}

/** Signs in with a passkey using the request options and returns the assertion as JSON. */
export async function getPasskey(publicKey: Json): Promise<Json> {
  const options = {
    ...publicKey,
    challenge: fromBase64Url(publicKey['challenge'] as string),
    allowCredentials: descriptors(publicKey['allowCredentials']),
  } as unknown as PublicKeyCredentialRequestOptions;
  const credential = (await navigator.credentials.get({
    publicKey: options,
  })) as PublicKeyCredential | null;
  if (!credential) {
    throw new Error('No passkey was chosen.');
  }
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      clientDataJSON: toBase64Url(response.clientDataJSON),
      authenticatorData: toBase64Url(response.authenticatorData),
      signature: toBase64Url(response.signature),
      userHandle: toBase64Url(response.userHandle),
    },
    clientExtensionResults: credential.getClientExtensionResults() ?? {},
  };
}

/** The cancel of a passkey prompt is a DOMException named NotAllowedError: not an error to show. */
export function cancelled(failure: unknown): boolean {
  return failure instanceof DOMException && failure.name === 'NotAllowedError';
}

/**
 * Validation of the Capgo key-v2 material, shared by the native build config,
 * the release scripts and the tests.
 *
 * Why this exists: a public key that is present but malformed looks exactly like
 * a secured build until the first update fails on a device. The native code is
 * strict about the format —
 *
 *   `CryptoCipher.stringToPublicKey` strips `-----BEGIN RSA PUBLIC KEY-----`
 *   (PKCS#1, *not* `PUBLIC KEY`/SPKI),
 *   `DecryptionSession` rejects a key that does not start with that header.
 *
 * — so the build validates the same shape up front and refuses to produce an
 * APK that would silently skip verification.
 */

const PUBLIC_KEY_HEADER = '-----BEGIN RSA PUBLIC KEY-----';
const PUBLIC_KEY_FOOTER = '-----END RSA PUBLIC KEY-----';
const PRIVATE_KEY_HEADER = 'PRIVATE KEY-----';

/** Turn env-style `\n` escapes and stray whitespace into a real PEM body. */
export const normalizePem = (value: string): string =>
  value
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();

const base64Body = (
  pem: string,
  header: string,
  footer: string
): string | null => {
  if (!pem.startsWith(header) || !pem.endsWith(footer)) return null;
  const body = pem.slice(header.length, pem.length - footer.length).replace(/\s+/g, '');
  return /^[A-Za-z0-9+/=]+$/.test(body) ? body : null;
};

/**
 * A Capgo key-v2 *public* key: PKCS#1 RSA PEM.
 *
 * The decoded body must be large enough to be a real RSA public key
 * (a 2048-bit PKCS#1 RSAPublicKey is 294 bytes → 392 base64 characters).
 */
export const isValidCapgoPublicKey = (value: string | undefined | null): boolean => {
  if (!value) return false;
  const pem = normalizePem(value);
  const body = base64Body(pem, PUBLIC_KEY_HEADER, PUBLIC_KEY_FOOTER);
  return Boolean(body && body.length >= 300);
};

/**
 * A Capgo key-v2 *private* key file, as written by `@capgo/cli key create`
 * (`.capgo_key_v2`). Only the shape is checked here; the CLI remains the
 * authority on whether it can sign.
 */
export const isValidCapgoPrivateKey = (value: string | undefined | null): boolean => {
  if (!value) return false;
  const pem = normalizePem(value);
  if (!pem.startsWith('-----BEGIN') || !pem.includes(PRIVATE_KEY_HEADER)) {
    return false;
  }
  const body = pem
    .replace(/-----(BEGIN|END)[^-]+-----/g, '')
    .replace(/\s+/g, '');
  return /^[A-Za-z0-9+/=]+$/.test(body) && body.length >= 800;
};

export type SignaturePolicy = {
  /** The client refuses releases that carry no signature. */
  required: boolean;
  /** Public key to embed in the APK, or null when signing is off. */
  publicKey: string | null;
};

export type SignaturePolicyProblem =
  | 'missing_public_key'
  | 'invalid_public_key';

/**
 * Decide the signing policy for a build.
 *
 * `required` comes from `POROKH_OTA_REQUIRE_SIGNATURE` and is mirrored into the
 * web bundle as `VITE_OTA_REQUIRE_SIGNATURE`. When it is on, a missing or
 * malformed key is a build error: shipping an APK that cannot verify a
 * signature is worse than not shipping at all, because it looks protected.
 */
export const resolveSignaturePolicy = (options: {
  requireSignature: boolean;
  publicKey?: string | null;
}): { ok: true; policy: SignaturePolicy } | { ok: false; problem: SignaturePolicyProblem } => {
  const raw = options.publicKey?.trim();
  const normalized = raw ? normalizePem(raw) : null;
  const valid = isValidCapgoPublicKey(normalized);

  if (options.requireSignature) {
    if (!normalized) return { ok: false, problem: 'missing_public_key' };
    if (!valid) return { ok: false, problem: 'invalid_public_key' };
    return { ok: true, policy: { required: true, publicKey: normalized } };
  }

  // Signing not required: still embed a key when one is supplied and valid, so
  // a developer build pointed at a signed channel behaves like production.
  return {
    ok: true,
    policy: { required: false, publicKey: valid ? normalized : null },
  };
};

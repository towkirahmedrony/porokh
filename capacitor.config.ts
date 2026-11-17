import type { CapacitorConfig } from '@capacitor/cli';
import { resolveSignaturePolicy } from './src/features/app-update/signingConfig';

/**
 * Channel is baked into the native binary at build time. OTA bundles are only
 * accepted when their release metadata names the same channel.
 *
 * The public key is Capgo's key-v2 RSA *public* key (never the private key). It
 * is embedded in the APK so a downloaded bundle can be authenticated on-device:
 * the plugin decrypts the signed checksum with it and rejects anything that does
 * not match, including a clear (unsigned) bundle.
 *
 * `POROKH_OTA_REQUIRE_SIGNATURE=true` makes a missing or malformed key a build
 * error. Without that guard a CI misconfiguration silently produces an APK that
 * looks protected but skips verification entirely — the exact failure this
 * audit found. Keep it paired with `VITE_OTA_REQUIRE_SIGNATURE` so the web
 * bundle inside the APK rejects unsigned releases too.
 */
const otaChannel = process.env.POROKH_OTA_CHANNEL || 'production-android';
const requireSignature =
  (process.env.POROKH_OTA_REQUIRE_SIGNATURE ?? '').trim().toLowerCase() ===
  'true';

const signature = resolveSignaturePolicy({
  requireSignature,
  publicKey: process.env.CAPGO_PUBLIC_KEY,
});

if (!signature.ok) {
  const reason =
    signature.problem === 'missing_public_key'
      ? 'CAPGO_PUBLIC_KEY is not set'
      : 'CAPGO_PUBLIC_KEY is not a PKCS#1 RSA public key (-----BEGIN RSA PUBLIC KEY-----)';
  throw new Error(
    `[capacitor.config] OTA signature verification is required but unusable: ${reason}. ` +
      'Provision the Capgo key-v2 public key before building the native app. ' +
      'Refusing to produce an APK that cannot verify updates.'
  );
}

const config: CapacitorConfig = {
  appId: 'net.porokh.app',
  appName: 'Porokh',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    CapacitorUpdater: {
      // Activation is always decided by the app's exam-aware gate, never by the
      // plugin's background/instant modes.
      autoUpdate: 'off',
      // Give the startup health check time to call notifyAppReady().
      appReadyTimeout: 20_000,
      responseTimeout: 20_000,
      autoDeleteFailed: true,
      // Rollback target retention: the plugin must not delete the previous
      // bundle the moment the new one is confirmed. Retention is decided by the
      // controller, which keeps the running bundle plus one fallback.
      autoDeletePrevious: false,
      resetWhenUpdate: true,
      defaultChannel: otaChannel,
      keepUrlPathAfterReload: true,
      // Bundles are distributed through GitHub Releases, so there is no Capgo
      // endpoint to report statistics to. An empty value disables reporting
      // instead of letting every check fire failing requests at the old host.
      statsUrl: '',
      ...(signature.policy.publicKey
        ? { publicKey: signature.policy.publicKey }
        : {}),
    },
  },
};

export default config;

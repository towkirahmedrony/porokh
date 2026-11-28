import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest, resolveBuildIdentity } from './scripts/build-identity';

/**
 * Refuse to build without a backend URL.
 *
 * `src/shared/lib/apiConfig.ts` has no fallback, so a bundle built without
 * `VITE_API_URL` throws the moment the app imports the API client. Failing here
 * puts that error in the build log instead of on a user's screen.
 */
const requireApiUrlPlugin = (): Plugin => ({
  name: 'porokh-require-api-url',
  apply: 'build',
  config(_config, { mode }) {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    if (!env.VITE_API_URL?.trim()) {
      throw new Error(
        'VITE_API_URL is required to build. Set it in .env.local, in the Vercel ' +
          'project settings, or as the GitHub Actions VITE_API_URL variable.'
      );
    }
  },
});

/**
 * Publish `dist/version.json` next to `index.html`.
 *
 * This file is how a bundled WebView (Capacitor APK / OTA bundle) can tell that
 * the deployment has moved on. It is written from the same identity that is
 * compiled into the JS bundle, so the comparison cannot drift.
 */
const versionManifestPlugin = (): Plugin => ({
  name: 'porokh-version-manifest',
  apply: 'build',
  closeBundle() {
    const outDir = path.resolve(process.cwd(), 'dist');
    const manifest = buildManifest();
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
      path.join(outDir, 'version.json'),
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    // eslint-disable-next-line no-console
    console.log(
      `[version-manifest] version=${manifest.version} buildId=${manifest.buildId}`
    );
  },
});

// package.json থেকে ভার্সন পড়ে নেওয়া হচ্ছে
const buildIdentity = resolveBuildIdentity();

export default defineConfig({
  plugins: [react(), requireApiUrlPlugin(), versionManifestPlugin()],
  define: {
    // অ্যাপের ভেতরে VITE_APP_VERSION হিসেবে ভার্সনটি ব্যবহার করা যাবে
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(buildIdentity.version),
    // Build identity compiled into the bundle (see src/features/app-update/buildInfo.ts).
    __POROKH_BUILD__: JSON.stringify(buildIdentity),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url))
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
  build: {
    // বড় ফাইলের ওয়ার্নিং লিমিট বাড়িয়ে দেওয়া হলো
    chunkSizeWarningLimit: 1000, 
    rollupOptions: {
      output: {
        manualChunks: {
          // React এর কোর লাইব্রেরিগুলো
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // ডেটা ফেচিং এবং ক্যাশিং
          'query-vendor': [
            '@tanstack/react-query', 
            '@tanstack/react-query-persist-client', 
            '@tanstack/query-sync-storage-persister'
          ],
          // ডেটাবেস ও অথেন্টিকেশন
          'firebase-vendor': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'supabase-vendor': ['@supabase/supabase-js'],
        }
      }
    }
  }
});

import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater';
import {
  OTA_CHANNEL,
  OTA_MANIFEST_BASE_URL,
  OTA_POINTER_PUBLIC_KEY,
  OTA_REQUIRE_SIGNATURE,
} from './config';
import { diagnosticErrorDetails, recordOtaDiagnostic } from './diagnostics';
import {
  blockedLatest,
  fetchChannelLatest,
  type ChannelLatestResult,
} from './githubManifest';
import type {
  DownloadProgress,
  OtaUpdaterAdapter,
  ProviderBundle,
  ProviderCurrent,
  ProviderLatest,
} from './types';

const toProviderBundle = (bundle: BundleInfo): ProviderBundle => ({
  id: bundle.id,
  version: bundle.version,
  checksum: bundle.checksum ?? '',
  status:
    bundle.status === 'success' ||
    bundle.status === 'error' ||
    bundle.status === 'pending' ||
    bundle.status === 'downloading'
      ? bundle.status
      : 'error',
  downloadedAt: bundle.downloaded || undefined,
  // The plugin reports the APK-baked copy with the fixed id `builtin`.
  builtin: bundle.id === 'builtin',
});

export type CapgoUpdaterAdapterOptions = {
  /** Channel this build follows. Defaults to the build-time channel. */
  channel?: string;
  /** Override for tests; defaults to the GitHub pointer reader. */
  latestFromPointer?: (channel: string) => Promise<ChannelLatestResult>;
};

/**
 * Thin plugin boundary. Every call is guarded by the native-platform check in
 * the controller; this class contains no activation policy of its own.
 *
 * The class no longer talks to Capgo: bundle discovery comes from the signed
 * channel pointer in the public distribution repository, and the channel is the
 * one this build was produced for. Download, activation, rollback and
 * `notifyAppReady` still go through the open-source plugin, which keeps owning
 * native decryption and checksum verification.
 */
export class CapgoUpdaterAdapter implements OtaUpdaterAdapter {
  private readonly channel: string;
  private readonly loadLatest: (channel: string) => Promise<ChannelLatestResult>;

  constructor(options: CapgoUpdaterAdapterOptions = {}) {
    this.channel = options.channel ?? OTA_CHANNEL;
    this.loadLatest =
      options.latestFromPointer ??
      ((channel) =>
        fetchChannelLatest({
          channel,
          // Honouring the documented override keeps a staging deployment from
          // silently reading pointers published for another environment.
          baseUrl: OTA_MANIFEST_BASE_URL,
          requireSignature: OTA_REQUIRE_SIGNATURE,
          publicKeyBase64: OTA_POINTER_PUBLIC_KEY,
        }));
  }

  async isAvailable(): Promise<boolean> {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('CapacitorUpdater')
    );
  }

  /**
   * Map a verified pointer into the provider contract the controller expects.
   *
   * Transport failures throw so the controller records a check failure and
   * backs off; a pointer that is signed wrong, for another channel or plainly
   * malformed blocks this release with the reason that describes it. Everything
   * else (native floor, schema, downgrade, signature of the *bundle*) is still
   * decided by the controller.
   */
  async getLatest(): Promise<ProviderLatest> {
    const result = await this.loadLatest(this.channel);
    if (result.ok) return result.latest;

    const blocked = blockedLatest(result);
    if (blocked) return blocked;

    throw new Error(
      `update pointer unavailable (${result.problem}${result.detail ? `: ${result.detail}` : ''})`
    );
  }

  async getBuiltinVersion(): Promise<string> {
    const result = await CapacitorUpdater.getBuiltinVersion();
    return result.version ?? '';
  }

  /**
   * The channel is decided by the build, not by a cloud service.
   *
   * `getChannel()`/`setChannel()` would validate against Capgo's backend, which
   * this distribution does not use, so the plugin is never asked.
   */
  async getChannel(): Promise<string | null> {
    return this.channel;
  }

  async current(): Promise<ProviderCurrent> {
    const result = await CapacitorUpdater.current();
    return {
      bundle: toProviderBundle(result.bundle),
      native: result.native,
    };
  }

  async list(): Promise<ProviderBundle[]> {
    const result = await CapacitorUpdater.list();
    return result.bundles.map(toProviderBundle);
  }

  async download(release: {
    url: string;
    version: string;
    checksum: string;
    sessionKey?: string;
  }): Promise<ProviderBundle> {
    recordOtaDiagnostic('info', 'native_download_call_started', {
      version: release.version,
      provider: 'CapacitorUpdater',
    });
    let failureHandle: { remove: () => Promise<void> } | null = null;
    try {
      try {
        failureHandle = await CapacitorUpdater.addListener(
          'downloadFailed',
          (event) => {
            if (event.version !== release.version) return;
            recordOtaDiagnostic('error', 'native_download_failed_event', {
              version: event.version,
            });
          }
        );
      } catch (error) {
        // A diagnostic listener must never prevent the actual update attempt.
        recordOtaDiagnostic(
          'warning',
          'native_download_listener_unavailable',
          diagnosticErrorDetails(error)
        );
      }

      const result = await CapacitorUpdater.download(release);
      recordOtaDiagnostic('info', 'native_download_call_resolved', {
        version: result.version,
        status: result.status,
        hasChecksum: Boolean(result.checksum),
      });
      return toProviderBundle(result);
    } catch (error) {
      recordOtaDiagnostic('error', 'native_download_call_rejected', {
        requestedVersion: release.version,
        provider: 'CapacitorUpdater',
        ...diagnosticErrorDetails(error),
      });
      throw error;
    } finally {
      if (failureHandle) {
        void failureHandle.remove().catch((error: unknown) => {
          recordOtaDiagnostic(
            'warning',
            'native_download_listener_remove_failed',
            diagnosticErrorDetails(error)
          );
        });
      }
    }
  }

  async deleteBundle(id: string): Promise<void> {
    await CapacitorUpdater.delete({ id });
  }

  async notifyAppReady(): Promise<void> {
    await CapacitorUpdater.notifyAppReady();
  }

  async setBundle(id: string): Promise<void> {
    await CapacitorUpdater.set({ id });
  }

  async resetToLastSuccessful(): Promise<void> {
    await CapacitorUpdater.reset({ toLastSuccessful: true });
  }

  /** Drop back to the bundle that ships inside the APK. Reloads immediately. */
  async resetToBuiltin(): Promise<void> {
    await CapacitorUpdater.reset();
  }

  async reload(): Promise<void> {
    await CapacitorUpdater.reload();
  }

  subscribeProgress(
    listener: (progress: DownloadProgress) => void
  ): () => void {
    let active = true;
    let handle: { remove: () => Promise<void> } | null = null;

    void CapacitorUpdater.addListener('download', (event) => {
      if (!active) return;
      listener({ percent: event.percent, version: event.bundle.version });
    }).then((registered) => {
      if (!active) {
        void registered.remove();
        return;
      }
      handle = registered;
    });

    return () => {
      active = false;
      if (handle) void handle.remove();
    };
  }
}

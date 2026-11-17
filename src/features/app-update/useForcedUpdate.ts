import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { currentBuild, type BuildInfo } from './buildInfo';
import {
  reloadFromNetwork,
  resolveReloadOutcome,
  stripReloadMarker,
  writePendingReload,
  type ReloadOutcome,
} from './cacheRecovery';
import { getExamActivities, isExamRoute } from './examActivity';
import { OTA_EXAM_ROUTE_PATTERNS } from './config';
import { fetchRemoteManifest } from './remoteManifest';
import {
  runForcedUpdate,
  runHardReload,
  type ForcedUpdateOutcome,
  type ForcedUpdateStage,
} from './forcedUpdate';
import { useOta } from './UpdateProvider';

export type ForcedUpdateState = {
  build: BuildInfo;
  native: boolean;
  running: boolean;
  stage: ForcedUpdateStage | null;
  progress: number;
  outcome: ForcedUpdateOutcome | null;
  reloadOutcome: ReloadOutcome | null;
  run: () => Promise<ForcedUpdateOutcome>;
  hardReload: () => Promise<ForcedUpdateOutcome>;
  reset: () => void;
  /** Version reported by the OTA provider, when one is active. */
  otaVersion: string | null;
  builtinVersion: string | null;
  canRestoreBuiltin: boolean;
  restoreBuiltin: () => Promise<void>;
};

const isOnline = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine !== false;

export const useForcedUpdate = (): ForcedUpdateState => {
  const ota = useOta();
  const location = useLocation();
  const build = useMemo(() => currentBuild(), []);
  const native = Capacitor.isNativePlatform();

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState<ForcedUpdateStage | null>(null);
  const [outcome, setOutcome] = useState<ForcedUpdateOutcome | null>(null);

  const [reloadOutcome, setReloadOutcome] = useState<ReloadOutcome | null>(() =>
    native ? null : resolveReloadOutcome(build)
  );

  // Drop the cache-busting query a hard reload adds, so the address bar stays clean.
  useEffect(() => {
    stripReloadMarker({ location: window.location, history: window.history });
  }, []);

  const run = useCallback(async (): Promise<ForcedUpdateOutcome> => {
    setRunning(true);
    setOutcome(null);
    setStage('checking');
    setReloadOutcome(null);

    try {
      // Resolve plugin availability from the controller itself: the provider's
      // snapshot may still be at its initial `disabled` value on a cold start,
      // and guessing "no OTA plugin" would wrongly tell the user to reinstall.
      await ota.initialize();
      const available = native && ota.getSnapshot().available;
      let nativeVersion = ota.getSnapshot().nativeVersion ?? null;
      if (native) {
        try {
          nativeVersion = (await App.getInfo()).version || nativeVersion;
        } catch {
          // Unknown native version cannot prove APK incompatibility.
        }
      }

      const result = await runForcedUpdate({
        build,
        nativeVersion,
        native,
        otaAvailable: available,
        ota: available ? ota : null,
        checkManifest: () => fetchRemoteManifest(),
        performReload: (pending) => {
          writePendingReload(pending);
          reloadFromNetwork({ location: window.location });
        },
        isExamBusy: () =>
          getExamActivities().length > 0 ||
          isExamRoute(location.pathname, OTA_EXAM_ROUTE_PATTERNS),
        isOnline,
        onStage: setStage,
      });

      setOutcome(result);
      return result;
    } finally {
      setRunning(false);
      setStage(null);
    }
  }, [build, location.pathname, native, ota]);

  const hardReload = useCallback(async (): Promise<ForcedUpdateOutcome> => {
    setRunning(true);
    setOutcome(null);
    setStage('reloading');
    setReloadOutcome(null);

    try {
      if (native) await ota.initialize();
      const available = native && ota.getSnapshot().available;
      const result = await runHardReload({
        build,
        native,
        otaAvailable: available,
        reloadNative: available ? () => ota.reloadCurrent() : undefined,
        isExamBusy: () =>
          getExamActivities().length > 0 ||
          isExamRoute(location.pathname, OTA_EXAM_ROUTE_PATTERNS),
        isOnline,
        performReload: (pending) => {
          writePendingReload(pending);
          reloadFromNetwork({ location: window.location });
        },
        performNativeReload: () => window.location.reload(),
      });
      setOutcome(result);
      return result;
    } finally {
      setRunning(false);
      setStage(null);
    }
  }, [build, location.pathname, native, ota]);

  const reset = useCallback(() => {
    setOutcome(null);
    setStage(null);
  }, []);

  const canRestoreBuiltin =
    native &&
    ota.available &&
    Boolean(ota.currentVersion) &&
    Boolean(ota.builtinVersion) &&
    ota.currentVersion !== ota.builtinVersion;

  const restoreBuiltin = useCallback(async () => {
    // Reloads the WebView onto the APK's own bundle. Exam data lives in
    // IndexedDB and is untouched by a bundle switch.
    await ota.restoreBuiltin();
  }, [ota]);

  return {
    build,
    native,
    running,
    stage,
    progress: ota.progress,
    outcome,
    reloadOutcome,
    run,
    hardReload,
    reset,
    otaVersion: ota.currentVersion,
    builtinVersion: ota.builtinVersion,
    canRestoreBuiltin,
    restoreBuiltin,
  };
};

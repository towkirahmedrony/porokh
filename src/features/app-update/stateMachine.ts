import type { OtaPhase } from './types';

/**
 * Legal OTA phase transitions. Kept intentionally small so tests can prove
 * that, for example, a download failure can never be reported as activated,
 * and a bundle must pass through `staged`/`activation_blocked` before
 * `activating`.
 */
const TRANSITIONS: Record<OtaPhase, readonly OtaPhase[]> = {
  disabled: ['disabled', 'idle'],
  idle: [
    'idle',
    'checking',
    'up_to_date',
    'available',
    'downloading',
    'staged',
    'activation_blocked',
    'activated',
    'recovery',
    'disabled',
  ],
  checking: ['checking', 'up_to_date', 'available', 'check_failed', 'idle', 'disabled'],
  up_to_date: [
    'up_to_date',
    'checking',
    'available',
    'downloading',
    'staged',
    'activation_blocked',
    'activated',
    'disabled',
  ],
  available: [
    'available',
    'up_to_date',
    'checking',
    'downloading',
    'rejected',
    'check_failed',
    'idle',
    'disabled',
  ],
  downloading: [
    'downloading',
    'up_to_date',
    'staged',
    'download_failed',
    'rejected',
    'idle',
    'disabled',
  ],
  staged: [
    'staged',
    'up_to_date',
    'activation_blocked',
    'activating',
    'checking',
    'activation_failed',
    'activated',
    'rejected',
    'disabled',
  ],
  activation_blocked: [
    'activation_blocked',
    'up_to_date',
    'staged',
    'activating',
    'checking',
    'activation_failed',
    'rejected',
    'disabled',
  ],
  activating: ['activating', 'activated', 'staged', 'activation_failed', 'recovery', 'disabled'],
  activated: ['activated', 'checking', 'up_to_date', 'staged', 'disabled'],
  check_failed: [
    'check_failed',
    'up_to_date',
    'available',
    'checking',
    'idle',
    'staged',
    'activation_blocked',
    'disabled',
  ],
  download_failed: [
    'download_failed',
    'up_to_date',
    'available',
    'checking',
    'downloading',
    'staged',
    'rejected',
    'disabled',
  ],
  rejected: [
    'rejected',
    'up_to_date',
    'available',
    'downloading',
    'checking',
    'idle',
    'staged',
    'disabled',
  ],
  activation_failed: [
    'activation_failed',
    'up_to_date',
    'available',
    'staged',
    'checking',
    'recovery',
    'idle',
    'disabled',
  ],
  recovery: [
    'recovery',
    'idle',
    'up_to_date',
    'available',
    'activated',
    'activation_failed',
    'check_failed',
    'disabled',
  ],
};

export const canTransitionOta = (from: OtaPhase, to: OtaPhase): boolean =>
  TRANSITIONS[from].includes(to);

export const assertOtaTransition = (from: OtaPhase, to: OtaPhase): void => {
  if (!canTransitionOta(from, to)) {
    throw new Error(`Invalid OTA phase transition: ${from} -> ${to}`);
  }
};

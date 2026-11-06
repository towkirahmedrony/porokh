import React from 'react';

interface SettingsSwitchProps {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
}

/**
 * Material 3 switch for settings rows.
 *
 * 52x32 track, thumb grows from 16 to 24 when on, primary fill when on and
 * outlined track when off. Native button with role="switch" so keyboard,
 * screen readers and the 48px row hit target stay correct.
 */
export const SettingsSwitch: React.FC<SettingsSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    aria-busy={busy || undefined}
    disabled={disabled || busy}
    onClick={onChange}
    className="relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors duration-200 after:absolute after:-inset-x-1 after:-inset-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card-bg disabled:cursor-not-allowed disabled:opacity-50 [&:not(:disabled)]:active:scale-95"
    style={{
      borderColor: checked ? 'transparent' : 'var(--border-color)',
      backgroundColor: checked ? 'var(--primary)' : 'var(--bg-surface-elevated)',
    }}
  >
    <span
      aria-hidden="true"
      className="absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200"
      style={{
        width: checked ? 24 : 16,
        height: checked ? 24 : 16,
        left: checked ? 24 : 6,
        backgroundColor: checked ? 'var(--primary-foreground)' : 'var(--text-secondary)',
      }}
    />
  </button>
);

export default SettingsSwitch;

import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  autoComplete: string;
  isVisible: boolean;
  disabled: boolean;
  required?: boolean;
  minLength?: number;
  errorId?: string;
  hasError?: boolean;
  toggleLabelWhenVisible: string;
  toggleLabelWhenHidden: string;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  rightAction?: React.ReactNode;
};

const INPUT_CLASSES =
  "w-full rounded-xl border border-input-border bg-input-bg px-4 py-3.5 pr-12 text-base text-text-primary transition-colors placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed disabled:opacity-70";

export function PasswordInput({
  id,
  label,
  value,
  placeholder,
  autoComplete,
  isVisible,
  disabled,
  required,
  minLength,
  errorId,
  hasError,
  toggleLabelWhenVisible,
  toggleLabelWhenHidden,
  onChange,
  onToggleVisibility,
  rightAction,
}: PasswordInputProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-text-primary">
          {label}
        </label>

        {rightAction}
      </div>

      <div className="relative">
        <input
          id={id}
          type={isVisible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={INPUT_CLASSES}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={Boolean(hasError)}
          aria-describedby={errorId}
        />

        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring disabled:cursor-not-allowed"
          aria-label={isVisible ? toggleLabelWhenVisible : toggleLabelWhenHidden}
          aria-pressed={isVisible}
          disabled={disabled}
        >
          {isVisible ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

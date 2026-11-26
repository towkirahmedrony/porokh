import type { LucideIcon } from 'lucide-react';
import { Check } from 'lucide-react';

interface GoalCardProps {
  label: string;
  hint: string;
  icon: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  /** Why the option cannot be chosen. Shown instead of the hint. */
  note?: string;
  onSelect?: () => void;
}

/**
 * One goal option. Selection is shown by border, tint and a check mark, so it
 * never depends on colour alone.
 */
export function GoalCard({
  label,
  hint,
  icon: Icon,
  selected,
  disabled = false,
  note,
  onSelect,
}: GoalCardProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-[72px] w-full items-center gap-3 rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 ${
        selected
          ? 'border-primary bg-primary/10'
          : 'border-border-color bg-surface hover:bg-surface-elevated'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
          selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'
        }`}
      >
        <Icon size={22} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-semibold leading-6 text-text-primary">
          {label}
        </span>
        <span className="mt-0.5 block text-[13px] leading-5 text-text-secondary">
          {note ?? hint}
        </span>
      </span>

      {selected ? (
        <Check size={20} className="shrink-0 text-primary" aria-hidden="true" />
      ) : null}
    </button>
  );
}

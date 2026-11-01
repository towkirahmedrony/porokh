/**
 * Home-grid colours are stored as hex values from the admin picker. Older rows
 * contain Tailwind class names such as `text-green-600`, which production
 * Tailwind may purge. This small table maps the palette we actually used
 * before, so those rows keep their intended colour until the data cleanup.
 */
const TAILWIND_HEX: Record<string, string> = {
  'slate-50': '#f8fafc',
  'slate-100': '#f1f5f9',
  'slate-500': '#64748b',
  'slate-600': '#475569',
  'slate-700': '#334155',
  'gray-50': '#f9fafb',
  'gray-100': '#f3f4f6',
  'gray-500': '#6b7280',
  'gray-600': '#4b5563',
  'gray-700': '#374151',
  'red-50': '#fef2f2',
  'red-100': '#fee2e2',
  'red-500': '#ef4444',
  'red-600': '#dc2626',
  'red-700': '#b91c1c',
  'orange-50': '#fff7ed',
  'orange-100': '#ffedd5',
  'orange-500': '#f97316',
  'orange-600': '#ea580c',
  'orange-700': '#c2410c',
  'amber-50': '#fffbeb',
  'amber-100': '#fef3c7',
  'amber-500': '#f59e0b',
  'amber-600': '#d97706',
  'amber-700': '#b45309',
  'yellow-50': '#fefce8',
  'yellow-100': '#fef9c3',
  'yellow-500': '#eab308',
  'yellow-600': '#ca8a04',
  'yellow-700': '#a16207',
  'lime-50': '#f7fee7',
  'lime-100': '#ecfccb',
  'lime-500': '#84cc16',
  'lime-600': '#65a30d',
  'lime-700': '#4d7c0f',
  'green-50': '#f0fdf4',
  'green-100': '#dcfce7',
  'green-500': '#22c55e',
  'green-600': '#16a34a',
  'green-700': '#15803d',
  'emerald-50': '#ecfdf5',
  'emerald-100': '#d1fae5',
  'emerald-500': '#10b981',
  'emerald-600': '#059669',
  'emerald-700': '#047857',
  'teal-50': '#f0fdfa',
  'teal-100': '#ccfbf1',
  'teal-500': '#14b8a6',
  'teal-600': '#0d9488',
  'teal-700': '#0f766e',
  'cyan-50': '#ecfeff',
  'cyan-100': '#cffafe',
  'cyan-500': '#06b6d4',
  'cyan-600': '#0891b2',
  'cyan-700': '#0e7490',
  'sky-50': '#f0f9ff',
  'sky-100': '#e0f2fe',
  'sky-500': '#0ea5e9',
  'sky-600': '#0284c7',
  'sky-700': '#0369a1',
  'blue-50': '#eff6ff',
  'blue-100': '#dbeafe',
  'blue-500': '#3b82f6',
  'blue-600': '#2563eb',
  'blue-700': '#1d4ed8',
  'indigo-50': '#eef2ff',
  'indigo-100': '#e0e7ff',
  'indigo-500': '#6366f1',
  'indigo-600': '#4f46e5',
  'indigo-700': '#4338ca',
  'violet-50': '#f5f3ff',
  'violet-100': '#ede9fe',
  'violet-500': '#8b5cf6',
  'violet-600': '#7c3aed',
  'violet-700': '#6d28d9',
  'purple-50': '#faf5ff',
  'purple-100': '#f3e8ff',
  'purple-500': '#a855f7',
  'purple-600': '#9333ea',
  'purple-700': '#7e22ce',
  'fuchsia-50': '#fdf4ff',
  'fuchsia-100': '#fae8ff',
  'fuchsia-500': '#d946ef',
  'fuchsia-600': '#c026d3',
  'fuchsia-700': '#a21caf',
  'pink-50': '#fdf2f8',
  'pink-100': '#fce7f3',
  'pink-500': '#ec4899',
  'pink-600': '#db2777',
  'pink-700': '#be185d',
  'rose-50': '#fff1f2',
  'rose-100': '#ffe4e6',
  'rose-500': '#f43f5e',
  'rose-600': '#e11d48',
  'rose-700': '#be123c',
  white: '#ffffff',
  black: '#000000',
};

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const TAILWIND_COLOR = /^(?:text|bg)-(.+)$/;

/**
 * Returns a renderable CSS colour. Empty/invalid values return `undefined`,
 * which lets the existing theme classes supply the default.
 */
export const resolveHomeColor = (value?: string | null): string | undefined => {
  const trimmed = (value ?? '').trim();

  if (!trimmed) return undefined;
  if (HEX_COLOR.test(trimmed)) return trimmed;

  const match = TAILWIND_COLOR.exec(trimmed);
  if (!match) return undefined;

  return TAILWIND_HEX[match[1].toLowerCase()];
};

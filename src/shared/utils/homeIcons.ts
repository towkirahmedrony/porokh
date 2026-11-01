import {
  Award,
  BarChart,
  Bell,
  BookOpen,
  Bookmark,
  Bot,
  Brain,
  Calendar,
  ClipboardCheck,
  FileText,
  Flame,
  Gift,
  GraduationCap,
  HelpCircle,
  Layers,
  Library,
  Megaphone,
  MessageCircle,
  Pencil,
  School,
  Sparkles,
  Star,
  Target,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Canonical Home-grid icon names. Only these names are chosen in the admin
 * picker; the resolver below still tolerates the mixed values already stored
 * in `home_grids.icon_name`.
 */
export const HOME_ICONS: Record<string, LucideIcon> = {
  'clipboard-check': ClipboardCheck,
  'graduation-cap': GraduationCap,
  'file-text': FileText,
  library: Library,
  'book-open': BookOpen,
  bot: Bot,
  trophy: Trophy,
  users: Users,
  school: School,
  calendar: Calendar,
  'bar-chart': BarChart,
  star: Star,
  flame: Flame,
  bell: Bell,
  megaphone: Megaphone,
  user: User,
  'message-circle': MessageCircle,
  sparkles: Sparkles,
  target: Target,
  award: Award,
  brain: Brain,
  pencil: Pencil,
  layers: Layers,
  bookmark: Bookmark,
  gift: Gift,
  'help-circle': HelpCircle,
};

export const HOME_ICON_NAMES = Object.keys(HOME_ICONS);

const FALLBACK_ICON = HelpCircle;

/**
 * Values that predate the registry. They are aliases, not canonical names, so
 * the admin picker never offers them.
 */
const LEGACY_ALIASES: Record<string, string> = {
  hat: 'graduation-cap',
  graduationcap: 'graduation-cap',
  bookopen: 'book-open',
  filequestion: 'file-text',
  filequestionmark: 'help-circle',
  bar_chart: 'bar-chart',
  barchart: 'bar-chart',
  messagecircle: 'message-circle',
  helpcircle: 'help-circle',
  clipboardcheck: 'clipboard-check',
};

/** Converts `GraduationCap` / `graduationCap` to `graduation-cap`. */
const toKebabCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

export const normalizeHomeIconName = (name?: string | null): string => {
  const trimmed = (name ?? '').trim();

  if (!trimmed) return '';

  const kebab = toKebabCase(trimmed);

  return LEGACY_ALIASES[kebab] ?? kebab;
};

export const isKnownHomeIcon = (name?: string | null): boolean => {
  const normalized = normalizeHomeIconName(name);
  return Boolean(normalized && HOME_ICONS[normalized]);
};

/**
 * Resolves a stored icon name to a statically imported Lucide component.
 * Unknown values get a neutral fallback and warn only in development, so a
 * bad admin value never breaks the Home screen.
 */
export const resolveHomeIcon = (name?: string | null): LucideIcon => {
  const normalized = normalizeHomeIconName(name);
  const icon = normalized ? HOME_ICONS[normalized] : undefined;

  if (icon) return icon;

  if (import.meta.env?.DEV) {
    console.warn(`[homeIcons] Unknown icon_name "${name ?? ''}", using fallback.`);
  }

  return FALLBACK_ICON;
};

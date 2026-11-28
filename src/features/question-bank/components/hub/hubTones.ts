/**
 * The tile tones on the question bank hub.
 *
 * The reference layout is a wall of coloured cards, but the colour has to come
 * from this app, not from another site. Every tone here is one of the app's own
 * semantic colours at a low alpha, so a tile is tinted rather than painted and
 * both themes keep their own base underneath. Five tones are enough for a grid
 * to read as varied without turning into a colour chart.
 */
export type HubTone = 'plain' | 'primary' | 'accent' | 'info' | 'success' | 'warning';

export interface HubToneStyle {
  /** The card surface: a soft tint plus the border that lifts on hover. */
  card: string;
  /** The decorative circles inside the card, one step lighter than the surface. */
  shape: string;
  /** A stronger tint for the small pill or badge inside the card. */
  chip: string;
}

export const HUB_TONES: Record<HubTone, HubToneStyle> = {
  /** The neutral card, for a tile that should not compete with a highlighted one. */
  plain: {
    card: 'border-card-border bg-card-bg hover:border-primary/35',
    shape: 'bg-primary/[0.06]',
    chip: 'bg-primary/[0.08]',
  },
  primary: {
    card: 'border-primary/20 bg-primary/[0.10] hover:border-primary/45',
    shape: 'bg-primary/[0.09]',
    chip: 'bg-primary/[0.14]',
  },
  accent: {
    card: 'border-accent/20 bg-accent/[0.10] hover:border-accent/45',
    shape: 'bg-accent/[0.09]',
    chip: 'bg-accent/[0.14]',
  },
  info: {
    card: 'border-info/20 bg-info/[0.10] hover:border-info/45',
    shape: 'bg-info/[0.09]',
    chip: 'bg-info/[0.14]',
  },
  success: {
    card: 'border-success/20 bg-success/[0.10] hover:border-success/45',
    shape: 'bg-success/[0.09]',
    chip: 'bg-success/[0.14]',
  },
  warning: {
    card: 'border-warning/25 bg-warning/[0.10] hover:border-warning/50',
    shape: 'bg-warning/[0.09]',
    chip: 'bg-warning/[0.16]',
  },
};

const TONE_ORDER: HubTone[] = ['primary', 'accent', 'info', 'success', 'warning'];

/**
 * The tone for a tile, derived from its own id or label.
 *
 * Deriving it instead of taking a position means a university keeps the same
 * colour on the hub and in the full list, and a subject keeps its colour when
 * the list around it is re-sorted. The hash only spreads ids over the five
 * tones; it carries no meaning, so nothing depends on which tone a row lands
 * on.
 */
export const hubToneFromKey = (key: string): HubTone => {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) {
    hash = ((hash << 5) + hash + key.charCodeAt(index)) >>> 0;
  }
  return TONE_ORDER[hash % TONE_ORDER.length];
};
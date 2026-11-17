import React from 'react';
import { Shield } from 'lucide-react';

type GroupShieldTileProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'tint' | 'gold' | 'solid';
  className?: string;
};

const CONTAINER_SIZES: Record<NonNullable<GroupShieldTileProps['size']>, string> = {
  sm: 'h-10 w-10 rounded-xl',
  md: 'h-12 w-12 rounded-xl',
  lg: 'h-14 w-14 rounded-2xl',
  xl: 'h-14 w-14 rounded-2xl',
};

const ICON_SIZES: Record<NonNullable<GroupShieldTileProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
  xl: 'h-6 w-6',
};

const TONES: Record<NonNullable<GroupShieldTileProps['tone']>, string> = {
  tint: 'bg-grp-primary-tint text-grp-primary',
  gold: 'bg-grp-gold-tint text-grp-gold-ink',
  solid: 'bg-grp-primary text-white',
};

export const GroupShieldTile: React.FC<GroupShieldTileProps> = ({
  size = 'sm',
  tone = 'tint',
  className = '',
}) => (
  <div
    className={`flex shrink-0 items-center justify-center ${CONTAINER_SIZES[size]} ${TONES[tone]} ${className}`}
    aria-hidden="true"
  >
    <Shield className={ICON_SIZES[size]} strokeWidth={2} />
  </div>
);

export default GroupShieldTile;

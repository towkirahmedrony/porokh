import React from 'react';
import { Shield } from 'lucide-react';

type GroupShieldTileProps = {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'tint' | 'gold' | 'solid';
  className?: string;
};

const CONTAINER_SIZES: Record<NonNullable<GroupShieldTileProps['size']>, string> = {
  sm: 'h-11 w-11 rounded-xl',
  md: 'h-14 w-14 rounded-2xl',
  lg: 'h-16 w-16 rounded-2xl',
  xl: 'h-[72px] w-[72px] rounded-2xl',
};

const ICON_SIZES: Record<NonNullable<GroupShieldTileProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
  lg: 'h-7 w-7',
  xl: 'h-8 w-8',
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

import React from 'react';

type GroupAvatarProps = {
  icon?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZES = {
  sm: 'w-10 h-10 text-xl',
  md: 'w-14 h-14 text-2xl',
  lg: 'w-20 h-20 text-4xl',
};

export const GroupAvatar: React.FC<GroupAvatarProps> = ({ icon, name, size = 'md' }) => {
  const emoji = (icon ?? '').trim();
  const initial = (name ?? '').trim().charAt(0).toUpperCase() || 'G';

  return (
    <div
      className={`${SIZES[size]} flex flex-shrink-0 items-center justify-center rounded-2xl border border-border-color bg-surface font-bold text-primary`}
      aria-hidden="true"
    >
      {emoji || initial}
    </div>
  );
};

export default GroupAvatar;

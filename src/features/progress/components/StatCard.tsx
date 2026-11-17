import React, { memo } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: LucideIcon;
}

export const StatCard: React.FC<StatCardProps> = memo(({ title, value, subtext, icon: Icon }) => (
  <div className="backdrop-blur-md rounded-2xl p-5 flex items-start justify-between relative overflow-hidden group transition-all shadow-sm bg-card-bg border border-card-border hover:border-border-color">
    <div className="z-10 relative">
      <p className="text-xs font-medium mb-1 uppercase tracking-wider text-text-secondary">
        {title}
      </p>
      <h3 className="text-2xl font-bold mb-1 text-text-primary">{value}</h3>
      <p className="text-xs font-medium text-text-secondary">{subtext}</p>
    </div>
    <div className="p-3 rounded-xl bg-surface-elevated">
      <Icon size={20} className="text-text-primary" />
    </div>
    {/* Decorative Glow */}
    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-30 group-hover:opacity-60 transition-opacity bg-accent" />
  </div>
));

StatCard.displayName = 'StatCard';

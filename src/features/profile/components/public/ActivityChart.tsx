import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ActivityChartProps {
  data: { day: string; you: number; them: number; }[];
  opponentName: string;
  isOwnProfile?: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-bg border border-card-border p-3 rounded-lg shadow-sm">
        <p className="text-text-secondary text-xs mb-2 font-['Noto_Sans_Bengali']">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-text-primary text-xs font-medium font-['Noto_Sans_Bengali']">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const ActivityChart: React.FC<ActivityChartProps> = ({ data, opponentName, isOwnProfile = false }) => {
  const { t } = useLanguage();
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      className="m-4 p-5 rounded-2xl shadow-lg border bg-card-bg border-card-border"
    >
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold font-['Noto_Sans_Bengali'] text-text-primary">
{isOwnProfile ? t('profile.myActivity') : t('profile.comparisonActivity')}
          </h3>
          <p className="text-xs font-['Noto_Sans_Bengali'] text-text-secondary">
{t('profile.last7Days')}
          </p>
        </div>
        
        <div className="flex gap-4 text-xs font-['Noto_Sans_Bengali'] font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-text-primary">{t('profile.you')}</span>
          </div>
          {!isOwnProfile && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-accent"></div>
              <span className="text-text-primary">{opponentName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="h-[200px] w-full mt-4 text-xs text-text-secondary">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorYouActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary, #3b82f6)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--primary, #3b82f6)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorThemActivity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent, #8b5cf6)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="var(--accent, #8b5cf6)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color, #e5e7eb)" opacity={0.5} />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 12, fontFamily: 'Hind Siliguri' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'currentColor', fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            {!isOwnProfile && (
              <Area type="monotone" dataKey="them" name={opponentName} stroke="var(--accent, #8b5cf6)" strokeWidth={3} fillOpacity={1} fill="url(#colorThemActivity)" />
            )}
            <Area type="monotone" dataKey="you" name={t('profile.you')} stroke="var(--primary, #3b82f6)" strokeWidth={3} fillOpacity={1} fill="url(#colorYouActivity)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ActivityChart;

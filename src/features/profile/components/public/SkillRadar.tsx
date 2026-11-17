import React, { memo } from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

interface SkillRadarProps {
  data: { subject: string; score: number; fullMark: number }[];
}

// TooltipProps-এর বদলে কাস্টম ইন্টারফেস ব্যবহার করুন
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card-bg border border-card-border p-3 rounded-lg shadow-sm">
        <p className="text-text-secondary text-xs mb-1 font-['Noto_Sans_Bengali']">{label}</p>
        {/* entry এবং index এর টাইপ নির্দিষ্ট করে দেওয়া হয়েছে */}
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-primary text-xs font-bold font-['Noto_Sans_Bengali']">
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const SkillRadar: React.FC<SkillRadarProps> = ({ data }) => {
  const { t } = useLanguage();
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      className="m-4 p-5 rounded-2xl shadow-lg border bg-card-bg border-card-border"
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold font-['Noto_Sans_Bengali'] text-text-primary">
          {t('profile.skills')} 🕸️
        </h3>
        <span className="text-xs font-medium font-['Noto_Sans_Bengali'] text-primary">
          {t('profile.topSubjects')}
        </span>
      </div>

      <div className="h-[250px] w-full flex items-center justify-center text-xs text-text-secondary">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="var(--border-color, #e5e7eb)" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'currentColor', fontSize: 11, fontWeight: '500', fontFamily: 'Hind Siliguri' }} 
            />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name={t('profile.score')}
              dataKey="score"
              stroke="var(--primary, #3b82f6)"
              strokeWidth={2}
              fill="var(--primary, #3b82f6)"
              fillOpacity={0.3}
            />
            <Tooltip content={<CustomTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default memo(SkillRadar);

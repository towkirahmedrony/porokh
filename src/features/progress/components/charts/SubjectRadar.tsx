import React from 'react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { RadarData } from '../../types/progress';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface SubjectRadarProps {
  data: RadarData[];
}

export const SubjectRadar: React.FC<SubjectRadarProps> = React.memo(({ data }) => {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-sm text-text-secondary">
        {t('progress.radarEmpty')}
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full relative text-text-primary">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="currentColor" strokeOpacity={0.2} />
          <PolarAngleAxis 
            dataKey="subject" 
            tick={{ fill: 'currentColor', fillOpacity: 0.6, fontSize: 12 }} 
          />
          <Radar
            name={t('progress.chartScore')}
            dataKey="A"
            stroke="currentColor"
            strokeWidth={2}
            fill="currentColor"
            fillOpacity={0.4}
          />
          <Tooltip 
            cursor={{ fill: 'currentColor', fillOpacity: 0.1 }}
            wrapperClassName="bg-card-bg border border-border-color rounded-lg overflow-hidden"
            contentStyle={{ 
              backgroundColor: 'transparent', 
              borderColor: 'transparent',
              color: 'inherit' 
            }}
            itemStyle={{ color: 'inherit' }}
          />
        </RadarChart>
      </ResponsiveContainer>
      
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <span className="text-[10px] font-bold opacity-50 text-text-primary">
          {t('progress.radarMastery')}
        </span>
      </div>
    </div>
  );
});

SubjectRadar.displayName = 'SubjectRadar';

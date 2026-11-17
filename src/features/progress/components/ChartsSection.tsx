import React from 'react';
import { BarChart2, Brain } from 'lucide-react';
import { PerformanceChart } from './charts/PerformanceChart';
import { SubjectRadar } from './charts/SubjectRadar';
import { ChartData, RadarData } from '../types/progress';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface ChartsSectionProps {
  performanceChart: ChartData[];
  skillMapping: RadarData[];
}

export const ChartsSection: React.FC<ChartsSectionProps> = ({ performanceChart, skillMapping }) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 backdrop-blur-sm rounded-2xl p-6 shadow-sm bg-card-bg border border-card-border">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2 text-text-primary">
              <BarChart2 size={18} className="text-accent" />
              {t('progress.chartTitle')}
            </h3>
            <p className="text-xs text-text-secondary">{t('progress.chartSubtitle')}</p>
          </div>
        </div>
        <PerformanceChart data={performanceChart} />
      </div>

      <div className="backdrop-blur-sm rounded-2xl p-6 flex flex-col shadow-sm bg-card-bg border border-card-border">
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2 text-text-primary">
          <Brain size={18} className="text-accent" />
          {t('progress.radarTitle')}
        </h3>
        <p className="text-xs mb-4 text-text-secondary">{t('progress.radarSubtitle')}</p>
        <div className="flex-1 flex items-center justify-center">
          <SubjectRadar data={skillMapping} />
        </div>
      </div>
    </div>
  );
};

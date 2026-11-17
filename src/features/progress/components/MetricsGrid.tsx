import React from 'react';
import { TrendingUp, Target, Zap, Crown } from 'lucide-react';
import { StatCard } from './StatCard';
import { MetricData } from '../types/progress';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface MetricsGridProps {
  metrics: MetricData;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ metrics }) => {
  const { language, t } = useLanguage();

  if (!metrics) return null;

  const totalExams = metrics.totalExams || 0;
  const hasExams = totalExams > 0;

  // A missing dataset is "unavailable" (—), not a genuine 0% average.
  const averageScoreText = hasExams
    ? `${localizeDigits(metrics.averageScore || 0, language)}%`
    : '—';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title={t('progress.metricAvgScore')}
        value={averageScoreText}
        subtext={
          hasExams
            ? t('progress.metricAvgScoreSub')
            : t('progress.metricNoExamsSub')
        }
        icon={TrendingUp}
      />
      <StatCard
        title={t('progress.metricTotalExams')}
        value={localizeDigits(totalExams, language)}
        subtext={t('progress.metricTotalExamsSub')}
        icon={Target}
      />
      <StatCard
        title={t('progress.metricStreak')}
        value={t('progress.metricStreakValue', {
          count: localizeDigits(metrics.streak || 0, language),
        })}
        subtext={t('progress.metricStreakSub')}
        icon={Zap}
      />
      <StatCard
        title={t('progress.metricRank')}
        value={localizeDigits(metrics.globalRank || 0, language)}
        subtext={t('progress.metricRankSub')}
        icon={Crown}
      />
    </div>
  );
};

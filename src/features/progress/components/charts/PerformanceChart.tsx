import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { ChartData } from '../../types/progress';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';

interface PerformanceChartProps {
  data: ChartData[];
}

interface CustomTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  const { language, t } = useLanguage();

  if (active && payload && payload.length) {
    return (
      <div className="p-3 rounded-lg shadow-xl bg-card-bg border border-border-color">
        <p className="text-xs mb-1 text-text-secondary">
          {label}
        </p>
        <p className="font-bold text-sm text-text-primary">
          {t('progress.chartScore')}:{' '}
          {localizeDigits(payload[0].value, language)}%
        </p>
      </div>
    );
  }
  return null;
};

export const PerformanceChart: React.FC<PerformanceChartProps> = React.memo(({ data }) => {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] w-full flex items-center justify-center text-sm text-text-secondary">
        {t('progress.chartEmpty')}
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full text-text-primary">
      {/* FIXED: Added minWidth={1} and minHeight={1} to prevent the Recharts 
        "width(-1) and height(-1)" development warning during initial render.
      */}
      <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="currentColor" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke="currentColor"
            strokeOpacity={0.15}
          />
          <XAxis 
            dataKey="name" 
            stroke="currentColor"
            strokeOpacity={0.5} 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="currentColor"
            strokeOpacity={0.5} 
            fontSize={12} 
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.4, strokeWidth: 1 }} 
          />
          <Area 
            type="monotone" 
            dataKey="score" 
            stroke="currentColor" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorScore)" 
            activeDot={{ r: 6, strokeWidth: 0, fill: 'currentColor' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

PerformanceChart.displayName = 'PerformanceChart';

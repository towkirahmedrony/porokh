import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { SectionCard, SectionHeading } from './Section';
import { formatPercent } from '../utils/progressView';
import type { ProgressSubjectStat } from '../types/progress';

interface SkillBarsProps {
  subjects: ProgressSubjectStat[];
}

const MAX_ROWS = 6;

/** Subject accuracy as horizontal bars; the numbers live in the report below. */
export const SkillBars: React.FC<SkillBarsProps> = ({ subjects }) => {
  const { language, t } = useLanguage();

  const rows = subjects.filter((subject) => subject.responses > 0).slice(0, MAX_ROWS);

  if (rows.length === 0) return null;

  return (
    <SectionCard className="p-4">
      <SectionHeading title={t('progress.skillTitle')} subtitle={t('progress.skillSubtitle')} />

      <ul className="mt-3 space-y-3">
        {rows.map((subject) => {
          const name =
            pickLang(language, subject.name_bn, subject.name_en) || subject.name_bn;
          const accuracy = Math.max(0, Math.min(100, subject.accuracy_pct ?? 0));

          return (
            <li key={subject.subject_id}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[13px] font-semibold leading-5 text-text-primary">
                  {name}
                </p>
                <p className="shrink-0 text-[13px] font-bold leading-5 text-text-primary">
                  {formatPercent(subject.accuracy_pct, language)}
                </p>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={subject.accuracy_pct ?? 0}
                aria-label={name}
                className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${accuracy}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { SectionCard, SectionHeading } from './Section';
import { formatCount, formatPercent } from '../utils/progressView';
import type { ProgressSubjectStat } from '../types/progress';

interface SubjectAnalysisProps {
  subjects: ProgressSubjectStat[];
}

const Counts: React.FC<{
  correct: number;
  wrong: number;
  skipped: number;
}> = ({ correct, wrong, skipped }) => {
  const { language, t } = useLanguage();

  const items = [
    { key: 'correct', label: t('progress.correct'), value: correct, dot: 'bg-success' },
    { key: 'wrong', label: t('progress.wrong'), value: wrong, dot: 'bg-danger' },
    { key: 'skipped', label: t('progress.skipped'), value: skipped, dot: 'bg-warning' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((item) => (
        <span
          key={item.key}
          className="inline-flex items-center gap-1.5 text-[11px] leading-4 text-text-secondary"
        >
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
          <span className="font-bold text-text-primary">{formatCount(item.value, language)}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
};

/**
 * Weakest subject first, and volume breaks the tie so a one-exam subject at
 * zero cannot outrank the subject most of the questions came from. A subject
 * without a computable accuracy sinks to the bottom.
 */
const weakestFirst = (a: ProgressSubjectStat, b: ProgressSubjectStat): number => {
  const left = a.accuracy_pct ?? Number.POSITIVE_INFINITY;
  const right = b.accuracy_pct ?? Number.POSITIVE_INFINITY;
  if (left !== right) return left < right ? -1 : 1;
  if (a.responses !== b.responses) return b.responses - a.responses;
  return a.name_bn.localeCompare(b.name_bn);
};

/**
 * One card for subject accuracy and the chapter breakdown behind it. Every
 * number comes from the same `subjects` payload, so the bar, the percentage and
 * the counts under a subject can never disagree. Rows open independently: two
 * subjects can be compared, and opening one never shifts the row you tapped.
 */
export const SubjectAnalysis: React.FC<SubjectAnalysisProps> = ({ subjects }) => {
  const { language, t } = useLanguage();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set());

  const rows = subjects.filter((subject) => subject.responses > 0).sort(weakestFirst);

  if (rows.length === 0) return null;

  const toggle = (subjectId: string): void => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId);
      else next.add(subjectId);
      return next;
    });
  };

  return (
    <SectionCard className="px-4 py-4">
      <SectionHeading title={t('progress.analysisTitle')} subtitle={t('progress.analysisSubtitle')} />

      <ul className="mt-1 divide-y divide-border-color">
        {rows.map((subject) => {
          const name = pickLang(language, subject.name_bn, subject.name_en) || subject.name_bn;
          const isOpen = openIds.has(subject.subject_id);
          const panelId = `progress-subject-${subject.subject_id}`;
          const accuracy = Math.max(0, Math.min(100, subject.accuracy_pct ?? 0));

          return (
            <li key={subject.subject_id}>
              <button
                type="button"
                onClick={() => toggle(subject.subject_id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full flex-col gap-1.5 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <span className="flex w-full items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-text-primary">
                    {name}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold leading-5 text-text-primary">
                    {formatPercent(subject.accuracy_pct, language)}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`h-4 w-4 shrink-0 text-text-secondary motion-safe:transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </span>

                <span
                  aria-hidden="true"
                  className="block h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${accuracy}%` }}
                  />
                </span>

                <span className="block text-[11px] leading-4 text-text-secondary">
                  {t('progress.subjectMeta', {
                    attempts: formatCount(subject.attempts, language),
                    responses: formatCount(subject.responses, language),
                  })}
                </span>
              </button>

              <div
                id={panelId}
                aria-hidden={!isOpen}
                className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="pb-3">
                    <Counts
                      correct={subject.correct}
                      wrong={subject.wrong}
                      skipped={subject.skipped}
                    />

                    {subject.chapters.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {subject.chapters.map((chapter, index) => {
                          const chapterName =
                            pickLang(language, chapter.name_bn, chapter.name_en) ||
                            t('progress.chapterFallback');
                          const chapterAccuracy = Math.max(
                            0,
                            Math.min(100, chapter.accuracy_pct ?? 0)
                          );

                          return (
                            <li
                              key={chapter.chapter_id ?? `chapter-${index}`}
                              className="flex items-center gap-3"
                            >
                              <p className="min-w-0 flex-1 truncate text-[12px] leading-5 text-text-secondary">
                                {chapterName}
                              </p>
                              <span
                                aria-hidden="true"
                                className="block h-1 w-16 shrink-0 overflow-hidden rounded-full bg-secondary"
                              >
                                <span
                                  className="block h-full rounded-full bg-primary"
                                  style={{ width: `${chapterAccuracy}%` }}
                                />
                              </span>
                              <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-text-primary">
                                {formatPercent(chapter.accuracy_pct, language)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};

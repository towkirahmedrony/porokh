import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { SectionCard, SectionHeading } from './Section';
import { formatCount, formatPercent } from '../utils/progressView';
import type { ProgressSubjectStat } from '../types/progress';

interface SubjectReportProps {
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
 * A mark-sheet: one ruled row per subject, and the chapter breakdown opens in
 * place. Expansion is real state, so it works the same with touch and keyboard.
 */
export const SubjectReport: React.FC<SubjectReportProps> = ({ subjects }) => {
  const { language, t } = useLanguage();
  const [openId, setOpenId] = useState<string | null>(null);

  if (subjects.length === 0) return null;

  return (
    <SectionCard className="px-4 py-4">
      <SectionHeading title={t('progress.subjectTitle')} subtitle={t('progress.subjectSubtitle')} />

      <ul className="mt-1 divide-y divide-border-color">
        {subjects.map((subject) => {
          const name = pickLang(language, subject.name_bn, subject.name_en) || subject.name_bn;
          const isOpen = openId === subject.subject_id;
          const panelId = `progress-subject-${subject.subject_id}`;

          return (
            <li key={subject.subject_id}>
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : subject.subject_id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex min-h-[56px] w-full items-center gap-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-5 text-text-primary">
                    {name}
                  </p>
                  <p className="text-[11px] leading-4 text-text-secondary">
                    {t('progress.subjectMeta', {
                      attempts: formatCount(subject.attempts, language),
                      responses: formatCount(subject.responses, language),
                    })}
                  </p>
                </div>

                <span className="shrink-0 text-[13px] font-bold leading-5 text-text-primary">
                  {formatPercent(subject.accuracy_pct, language)}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 text-text-secondary motion-safe:transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen ? (
                <div id={panelId} className="pb-3 pl-0">
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
                        const accuracy = Math.max(
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
                            <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${accuracy}%` }}
                              />
                            </div>
                            <span className="w-10 shrink-0 text-right text-[11px] font-semibold text-text-primary">
                              {formatPercent(chapter.accuracy_pct, language)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
};

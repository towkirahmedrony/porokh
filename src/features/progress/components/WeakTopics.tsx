import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { SectionCard, SectionHeading } from './Section';
import { buildTopicPracticeHref, formatCount, formatPercent } from '../utils/progressView';
import type { ProgressWeakTopic } from '../types/progress';

interface WeakTopicsProps {
  topics: ProgressWeakTopic[];
}

/**
 * Ranked by share of questions wrong or left unanswered, with the volume of
 * answers used to break ties so a single skipped question cannot sit on top.
 *
 * A topic with nothing wrong and everything skipped also scores 100% on that
 * rate, which reads as "100% weak" even though nothing was answered wrongly.
 * Those rows show how many questions were left instead of the percentage, so a
 * skipped topic and a wrong-answer topic are not told the same thing.
 */
export const WeakTopics: React.FC<WeakTopicsProps> = ({ topics }) => {
  const { language, t } = useLanguage();

  if (topics.length === 0) return null;

  return (
    <SectionCard className="p-4">
      <SectionHeading title={t('progress.weakTitle')} subtitle={t('progress.weakSubtitle')} />

      <ol className="mt-1 divide-y divide-border-color">
        {topics.map((topic, index) => {
          const topicName =
            pickLang(language, topic.topic_name_bn, topic.topic_name_en) ||
            topic.topic_name_bn;
          const subjectName =
            pickLang(language, topic.subject_name_bn, topic.subject_name_en) ||
            topic.subject_name_bn;
          const chapterName = pickLang(
            language,
            topic.chapter_name_bn,
            topic.chapter_name_en
          );

          return (
            <li key={topic.topic_id} className="flex items-start gap-3 py-3">
              <span
                aria-hidden="true"
                className="mt-0.5 w-4 shrink-0 text-[13px] font-bold leading-5 text-text-secondary"
              >
                {formatCount(index + 1, language)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-semibold leading-5 text-text-primary">
                  {topicName}
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-4 text-text-secondary">
                  {chapterName ? `${subjectName} · ${chapterName}` : subjectName}
                </p>
                {topic.wrong > 0 ? (
                  <p className="mt-0.5 text-[10px] leading-4 text-text-secondary">
                    {t('progress.weakMeta', {
                      wrong: formatCount(topic.wrong, language),
                      skipped: formatCount(topic.skipped, language),
                    })}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                {topic.wrong > 0 ? (
                  <span className="text-[13px] font-bold leading-5 text-text-primary">
                    {formatPercent(topic.error_rate_pct, language)}
                  </span>
                ) : (
                  <span className="inline-flex max-w-[104px] items-center gap-1.5 rounded-md bg-secondary px-2 py-0.5 text-right text-[11px] font-semibold leading-4 text-text-primary">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                    />
                    {t('progress.weakSkippedOnly', {
                      count: formatCount(topic.skipped, language),
                    })}
                  </span>
                )}
                <Link
                  to={buildTopicPracticeHref(topic.subject_id, topic.topic_id)}
                  aria-label={t('progress.weakPracticeAria', { topic: topicName })}
                  className="inline-flex h-11 items-center rounded-full bg-secondary px-3 text-[11px] font-bold text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  {t('progress.weakPractice')}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </SectionCard>
  );
};

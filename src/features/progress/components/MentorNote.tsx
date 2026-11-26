import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import { SectionCard } from './Section';
import { formatCount, formatPercent } from '../utils/progressView';
import type { ProgressMentor, ProgressWeakTopic } from '../types/progress';

interface MentorNoteProps {
  mentor: ProgressMentor;
  /** Used for the Bangla name of the weakest topic, which the mentor carries in Bengali. */
  topics: ProgressWeakTopic[];
}

/**
 * One sentence drawn from the weakest real topic, and one action that lands on
 * a working question-bank filter for it. No model, no invented advice.
 */
export const MentorNote: React.FC<MentorNoteProps> = ({ mentor, topics }) => {
  const { language, t } = useLanguage();

  const matchedTopic = topics.find((topic) => topic.topic_id === mentor.topic_id);
  const topicName =
    pickLang(language, matchedTopic?.topic_name_bn ?? mentor.topic_name_bn, matchedTopic?.topic_name_en) ||
    mentor.topic_name_bn ||
    '';
  const subjectName =
    pickLang(language, matchedTopic?.subject_name_bn ?? mentor.subject_name_bn, matchedTopic?.subject_name_en) ||
    mentor.subject_name_bn ||
    '';

  let message = t('progress.mentorGeneric');
  let action = t('progress.mentorActionBank');

  if (mentor.kind === 'weakest_topic' && topicName) {
    const skipped = matchedTopic?.skipped ?? 0;
    const responses = matchedTopic?.responses ?? 0;

    message = mentor.skipped_heavy
      ? t('progress.mentorSkipped', {
          topic: topicName,
          count: formatCount(skipped, language),
        })
      : t('progress.mentorWeakest', {
          topic: topicName,
          rate: formatPercent(mentor.error_rate_pct, language),
          count: formatCount(responses, language),
        });

    action = t('progress.mentorActionTopic', { topic: topicName });
  } else if (mentor.kind === 'weakest_subject' && subjectName) {
    message = t('progress.mentorSubject', {
      subject: subjectName,
      rate: formatPercent(mentor.accuracy_pct, language),
    });
    action = t('progress.mentorActionSubject', { subject: subjectName });
  } else if (mentor.kind === 'no_attempts') {
    message = t('progress.mentorNoAttempts');
    action = t('progress.mentorActionStart');
  }

  return (
    <SectionCard className="p-4">
      <p className="text-[11px] font-bold uppercase leading-4 tracking-wide text-text-secondary">
        {t('progress.mentorTitle')}
      </p>
      <p className="mt-1 text-[13px] leading-6 text-text-primary">{message}</p>

      <Link
        to={mentor.href}
        className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground transition-opacity hover:opacity-90 active:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      >
        {action}
      </Link>
    </SectionCard>
  );
};

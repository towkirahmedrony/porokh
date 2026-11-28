import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { hubUniversityPageHref } from '../../utils/questionBankHub';
import type { QuestionBankHubRow } from '../../types/questionBankHub';
import { HubLogoTile } from './HubLogoTile';
import { hubToneFromKey, type HubTone } from './hubTones';

/**
 * One university on the question bank, drawn as a logo card.
 *
 * It carries the same three facts as its admission counterpart: the logo (or
 * the institution's initials when the logo is missing), the name in the
 * student's language, and how many admission questions the row opens. The count
 * is the hub's own number, so the card never promises more than the list behind
 * it delivers.
 */
export function HubUniversityCard({
  row,
  logoUrl,
  tone,
}: {
  row: QuestionBankHubRow;
  logoUrl: string | null;
  /** Defaults to the row's own id, so a university keeps one colour. */
  tone?: HubTone;
}) {
  const { t, language } = useLanguage();
  const name =
    language === 'en'
      ? row.labelEn || row.labelBn
      : row.labelBn || row.labelEn || row.shortName || '';

  return (
    <HubLogoTile
      href={hubUniversityPageHref(row.id)}
      label={name}
      shortName={row.shortName}
      logoUrl={logoUrl}
      tone={tone ?? hubToneFromKey(row.id)}
      meta={t('questionBank.hub.questionMeta', {
        count: localizeDigits(row.count, language),
      })}
    />
  );
}
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import UniversityLogo from '@/features/admission/components/UniversityLogo';
import { hubUniversityPageHref } from '../../utils/questionBankHub';
import type { QuestionBankHubRow } from '../../types/questionBankHub';

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
}: {
  row: QuestionBankHubRow;
  logoUrl: string | null;
}) {
  const { t, language } = useLanguage();
  const name =
    language === 'en'
      ? row.labelEn || row.labelBn
      : row.labelBn || row.labelEn || row.shortName || '';

  return (
    <Link
      to={hubUniversityPageHref(row.id)}
      className="!no-underline [text-decoration-line:none!important] flex min-h-[152px] touch-manipulation select-none flex-col items-center justify-center rounded-[20px] border border-card-border bg-card-bg px-3 py-4 text-center transition-[transform,border-color] duration-150 hover:border-primary/40 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-reduce:transition-none"
    >
      <UniversityLogo
        logoUrl={logoUrl}
        name={name}
        shortName={row.shortName}
        className="h-14 w-14"
        imageClassName="h-9 w-9"
      />

      <h3 className="mt-2.5 line-clamp-2 font-['Noto_Sans_Bengali'] text-[12.5px] font-bold leading-snug text-text-primary">
        {name}
      </h3>

      {row.shortName && (
        <p className="mt-0.5 max-w-full truncate text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
          {row.shortName}
        </p>
      )}

      <p className="mt-1.5 max-w-full truncate text-[10px] font-medium text-text-secondary">
        {t('questionBank.hub.questionMeta', {
          count: localizeDigits(row.count, language),
        })}
      </p>
    </Link>
  );
}
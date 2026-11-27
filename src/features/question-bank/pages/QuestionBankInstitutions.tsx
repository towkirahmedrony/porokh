import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RefreshCw, Search } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { HubRow, HubRowList } from '../components/hub/HubRow';
import { useQuestionBankHub } from '../hooks/useQuestionBankHub';
import { findSection, hubInstitutionHref, hubUniversityPageHref } from '../utils/questionBankHub';
import type { QuestionBankHubRow } from '../types/questionBankHub';

/**
 * The full college or university list behind a hub row.
 *
 * Only institutions that hold questions are here, because the hub payload only
 * carries those: the 161 empty colleges never reach the screen. Searching is
 * local on purpose, since 35 rows are already in memory and a round trip per
 * keystroke would be slower than the filter.
 */
export default function QuestionBankInstitutions({
  kind,
}: {
  kind: 'colleges' | 'universities';
}) {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { payload, isPending, isError, refetch } = useQuestionBankHub(
    kind === 'colleges' ? 'hsc' : 'admission'
  );

  const rows = useMemo(() => {
    if (kind === 'colleges') {
      return findSection(payload, 'hsc_colleges')?.rows ?? [];
    }
    const varsity = payload.sections.find(
      (item) => item.kind === 'track' && item.track === 'varsity'
    );
    return varsity && varsity.kind === 'track' ? varsity.universities : [];
  }, [kind, payload]);

  const query = search.trim().toLowerCase();
  const visible: QuestionBankHubRow[] = query
    ? rows.filter((row) =>
        [row.labelBn, row.labelEn, row.shortName]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      )
    : rows;

  const handleBack = () => navigate('/question-bank' + (kind === 'universities' ? '?mode=admission' : ''));

  return (
    <div className="min-h-full bg-app pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleBack}
            aria-label={t('questionBank.hub.back')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-text-secondary transition-colors active:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <h1 className="text-[17px] font-extrabold text-text-primary">
            {kind === 'colleges'
              ? t('questionBank.hub.allColleges', {
                  count: localizeDigits(rows.length, language),
                })
              : t('questionBank.hub.allUniversities', {
                  count: localizeDigits(rows.length, language),
                })}
          </h1>
        </div>

        <label className="mt-2 flex h-11 items-center gap-2 rounded-2xl border border-border-color bg-surface px-3.5 focus-within:ring-2 focus-within:ring-focus-ring">
          <Search className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
          <span className="sr-only">
            {kind === 'colleges'
              ? t('questionBank.hub.searchColleges')
              : t('questionBank.hub.searchUniversities')}
          </span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('questionBank.hub.searchInstitutions')}
            className="h-full w-full bg-transparent text-[13px] font-medium text-text-primary placeholder:text-text-secondary focus:outline-none"
          />
        </label>

        {isPending ? (
          <div className="mt-3 h-44 animate-pulse rounded-2xl border border-card-border bg-card-bg" />
        ) : isError ? (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-border-color bg-card-bg px-4 py-6 text-center"
          >
            <p className="text-[13px] font-semibold text-text-primary">
              {t('questionBank.hub.loadError')}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 text-[12px] font-bold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              {t('questionBank.tryAgain')}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            {visible.length === 0 ? (
              <div className="rounded-2xl border border-border-color bg-card-bg px-4 py-8 text-center">
                <p className="text-[13px] font-semibold text-text-primary">
                  {t('questionBank.hub.noResults')}
                </p>
              </div>
            ) : (
              <HubRowList>
                {visible.map((row) => (
                  <HubRow
                    key={row.id}
                    label={row.labelBn}
                    count={row.count}
                    href={
                      kind === 'colleges'
                        ? hubInstitutionHref(row.id)
                        : hubUniversityPageHref(row.id)
                    }
                  />
                ))}
              </HubRowList>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

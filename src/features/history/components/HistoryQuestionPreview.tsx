import React, { memo, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import QuestionText from '@/shared/components/content/QuestionText';
import MathDisplay from '@/shared/components/content/MathDisplay';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';
import type { QuestionOption, ReviewQuestion } from '../types/history';

interface Props {
  question: ReviewQuestion | null;
  selectedOptionId?: string | null;
  showCorrectAnswer?: boolean;
}

const parseIfJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const readBodyText = (
  value: unknown,
  language: 'bn' | 'en'
): string => {
  const parsed = parseIfJson(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed;
  if (typeof parsed !== 'object') return String(parsed);

  const record = parsed as Record<string, unknown>;
  const preferred = pickLang(
    language,
    typeof record.text_bn === 'string' ? record.text_bn : null,
    typeof record.text_en === 'string' ? record.text_en : null
  );
  const fallbacks = [record.text, record.bn, record.en, record.content]
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '');

  return preferred || fallbacks[0] || '';
};

const readExplanationText = (
  value: unknown,
  language: 'bn' | 'en'
): string => {
  const parsed = parseIfJson(value);
  if (!parsed) return '';
  if (typeof parsed === 'string') return parsed.trim();
  if (typeof parsed !== 'object') return String(parsed);

  const record = parsed as Record<string, unknown>;
  return (
    pickLang(
      language,
      typeof record.bn === 'string' ? record.bn : null,
      typeof record.en === 'string' ? record.en : null
    ) ||
    (typeof record.text_bn === 'string' ? record.text_bn : '') ||
    (typeof record.text_en === 'string' ? record.text_en : '')
  ).trim();
};

const readOptionText = (option: QuestionOption, language: 'bn' | 'en'): string =>
  pickLang(language, option.text_bn, option.text_en) ||
  (typeof option.bn === 'string' ? option.bn : '') ||
  (typeof option.text === 'string' ? option.text : '') ||
  (typeof option.en === 'string' ? option.en : '');

const isCorrectOption = (option: QuestionOption): boolean =>
  option.isCorrect === true ||
  option.is_correct === true ||
  option.correct === true ||
  option.answer === true ||
  String(option.isCorrect).toLowerCase() === 'true' ||
  String(option.is_correct).toLowerCase() === 'true';

const normalizeId = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

export const HistoryQuestionPreview: React.FC<Props> = memo(
  ({ question, selectedOptionId, showCorrectAnswer = true }) => {
    const { language, t } = useLanguage();
    const [showExplanation, setShowExplanation] = useState(false);

    const bodyText = useMemo(
      () => readBodyText(question?.body, language),
      [question?.body, language]
    );
    const explanationText = useMemo(
      () => readExplanationText(question?.explanation, language),
      [question?.explanation, language]
    );
    const options = useMemo(
      () => (Array.isArray(question?.options) ? question?.options ?? [] : []),
      [question?.options]
    );

    const selectedId = normalizeId(selectedOptionId);
    const hasSelectedOption = selectedId !== '';
    const hasCorrectOption = options.some(isCorrectOption);
    const imageUrl =
      question?.image_url ||
      (() => {
        const body = parseIfJson(question?.body);
        return body && typeof body === 'object'
          ? (body as Record<string, unknown>).image_url
          : null;
      })() ||
      question?.media_library?.file_url ||
      null;

    if (!question) {
      return (
        <p className="text-sm text-text-secondary">
          {t('history.questionMissing')}
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-text-primary text-[15px] leading-relaxed">
          {bodyText ? (
            <QuestionText text={bodyText} />
          ) : (
            <p className="text-sm text-text-secondary">
              {t('history.questionMissing')}
            </p>
          )}
          {typeof imageUrl === 'string' && imageUrl && (
            <img
              src={imageUrl}
              alt={t('exam.questionImageAlt')}
              loading="lazy"
              className="mt-3 max-h-56 w-auto rounded-xl border border-border-color bg-surface-elevated object-contain"
            />
          )}
        </div>

        {options.length > 0 && (
          <div className="space-y-2" role="list">
            {options.map((option, index) => {
              const optionId = normalizeId(option.id);
              const isSelected =
                hasSelectedOption && optionId !== '' && optionId === selectedId;
              const isCorrect = showCorrectAnswer && isCorrectOption(option);

              let containerClasses =
                'border-border-color bg-surface-elevated text-text-primary';
              if (isCorrect) {
                containerClasses =
                  'border-emerald-500/50 bg-emerald-500/10 text-emerald-700';
              } else if (isSelected) {
                containerClasses =
                  'border-red-500/50 bg-red-500/10 text-red-700';
              }

              return (
                <div
                  key={`${optionId || index}`}
                  role="listitem"
                  className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${containerClasses}`}
                >
                  <div className="flex-1">
                    <span className="mr-1.5 font-semibold opacity-70">
                      {index + 1}.
                    </span>
                    <MathDisplay content={readOptionText(option, language)} />
                    {typeof option.image_url === 'string' && option.image_url && (
                      <img
                        src={option.image_url}
                        alt=""
                        loading="lazy"
                        className="mt-2 max-h-40 rounded-lg border border-border-color"
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {isCorrect && (
                      <CheckCircle2 size={17} className="text-emerald-600" aria-hidden="true" />
                    )}
                    {isSelected && !isCorrect && (
                      <XCircle size={17} className="text-red-600" aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasSelectedOption && (
          <p className="text-xs text-text-secondary">
            {t('analysis.yourAnswer')}:{' '}
            <span className="font-semibold text-text-primary">
              {options.find((option) => normalizeId(option.id) === selectedId)
                ? readOptionText(
                    options.find((option) => normalizeId(option.id) === selectedId)!,
                    language
                  )
                : selectedOptionId}
            </span>
          </p>
        )}

        {hasSelectedOption && hasCorrectOption && showCorrectAnswer && (
          <p className="text-xs text-text-secondary">
            {t('history.mistakeCorrectAnswer')}:{' '}
            <span className="font-semibold text-emerald-700">
              {readOptionText(options.find(isCorrectOption)!, language)}
            </span>
          </p>
        )}

        {showCorrectAnswer && explanationText && (
          <div className="border-t border-border-color pt-3">
            <button
              type="button"
              onClick={() => setShowExplanation((value) => !value)}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-bold text-text-secondary transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring sm:justify-start"
            >
              {showExplanation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              {showExplanation
                ? t('analysis.hideExplanation')
                : t('analysis.showExplanation')}
            </button>
            {showExplanation && (
              <div className="mt-2 rounded-xl border border-border-color bg-surface-elevated p-4 text-sm leading-relaxed text-text-secondary">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-text-primary">
                  {t('analysis.explanation')}
                </p>
                <MathDisplay content={explanationText} className="whitespace-pre-line" />
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

HistoryQuestionPreview.displayName = 'HistoryQuestionPreview';

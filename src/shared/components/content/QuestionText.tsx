import React, { memo, useMemo } from 'react';
import MathDisplay from './MathDisplay';
import { parseQuestion } from '@/shared/utils/questionFormat';

interface QuestionTextProps {
  text?: string | null;
}

const QuestionText: React.FC<QuestionTextProps> = memo(({ text }) => {
  const q = useMemo(() => parseQuestion(text || ''), [text]);

  if (!text) return null;

  if (q.statements.length === 0) {
    return <MathDisplay content={text} className="whitespace-pre-line" />;
  }

  return (
    <div className="space-y-3">
      {q.stem && <MathDisplay content={q.stem} />}

      <ol className="space-y-2">
        {q.statements.map((s) => (
          <li
            key={s.label}
            className="flex items-start gap-2.5 rounded-lg border border-border-color bg-surface-elevated px-3 py-2"
          >
            <span className="shrink-0 min-w-[1.75rem] text-center text-xs font-bold font-mono px-1.5 py-0.5 mt-0.5 rounded bg-badge-bg text-badge-text">
              {s.label}
            </span>
            <div className="flex-1 min-w-0">
              <MathDisplay content={s.text} />
            </div>
          </li>
        ))}
      </ol>

      {q.tail && (
        <div className="font-semibold pt-1">
          <MathDisplay content={q.tail} />
        </div>
      )}
    </div>
  );
});

QuestionText.displayName = 'QuestionText';

export default QuestionText;

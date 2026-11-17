import React, { memo, useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { clsx } from 'clsx';
import DOMPurify from 'dompurify';

interface MathDisplayProps {
  content?: string | null;
  block?: boolean; // Kept for backward compatibility
  className?: string;
}

const MathDisplay: React.FC<MathDisplayProps> = memo(({ 
  content, 
  block = false, 
  className 
}) => {
  // Memoize the parsing logic to prevent re-calculation on every render
  const parts = useMemo(() => {
    if (!content) return [];
    
    // If explicitly marked as block from props, we don't need to split
    if (block) return [content];
    
    // Splits string by $$...$$ or $...$ delimiters.
    // Using [\s\S] instead of dot (.) to match multiline equations safely
    const regex = /(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g;
    return content.split(regex).filter(Boolean); // Remove empty strings
  }, [content, block]);

  if (!content) return null;

  return (
    <div 
      className={clsx("text-base leading-relaxed inline-block w-full", className)}
      style={{ color: 'inherit' }}
    >
      {block ? (
        // Backward compatibility: If block prop is true, treat entire content as block math
        <BlockMath math={content.replace(/\$/g, '')} />
      ) : (
        <span>
          {parts.map((part, index) => {
            if (part.startsWith('$$') && part.endsWith('$$')) {
              // Remove the $$ delimiters for Katex BlockMath
              const mathContent = part.slice(2, -2);
              return <BlockMath key={`block-${index}`} math={mathContent} />;
            } else if (part.startsWith('$') && part.endsWith('$')) {
              // Remove the $ delimiters for Katex InlineMath
              const mathContent = part.slice(1, -1);
              return <InlineMath key={`inline-${index}`} math={mathContent} />;
            }
            
            // Regular text or HTML (Sanitized to prevent XSS attacks)
            const sanitizedHTML = DOMPurify.sanitize(part);
            return <span key={`text-${index}`} dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />;
          })}
        </span>
      )}
    </div>
  );
});

MathDisplay.displayName = 'MathDisplay';

export default MathDisplay;

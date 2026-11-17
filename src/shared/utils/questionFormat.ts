export type Lang = 'bn' | 'en';

const unescapeJsonString = (s: string): string => {
  try {
    return JSON.parse(`"${s}"`);
  } catch {
    return s.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
};

// {"bn":"..","en":".."} অবজেক্ট বা JSON স্ট্রিং থেকে নির্দিষ্ট ভাষার টেক্সট বের করে
export function localize(value: unknown, lang: Lang = 'bn'): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    const other: Lang = lang === 'bn' ? 'en' : 'bn';
    const pick = [o[lang], o[other], o.text].find(
      (v) => typeof v === 'string' && v.trim() !== ''
    );
    return typeof pick === 'string' ? pick : '';
  }

  if (typeof value !== 'string') return String(value);

  const s = value.trim();
  if (s.startsWith('{') && s.endsWith('}')) {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') {
        return localize(parsed, lang) || value;
      }
    } catch {
      const re = new RegExp('"' + lang + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
      const m = s.match(re);
      if (m) return unescapeJsonString(m[1]);
    }
  }
  return value;
}

export interface ParsedStatement {
  label: string;
  text: string;
}

export interface ParsedQuestion {
  stem: string;
  statements: ParsedStatement[];
  tail: string;
}

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'];
const TAIL_PATTERNS = [
  /(নিচের[^?？]*[?？])\s*$/,
  /(Which of the following[^?]*\?)\s*$/i,
];

// "... i. aaa ii. bbb iii. ccc নিচের কোনটি সঠিক?" কে ভেঙে আলাদা করে
export function parseQuestion(raw: string): ParsedQuestion {
  const text = (raw || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?p>/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const marks: { label: string; start: number; end: number }[] = [];
  let pos = 0;
  for (const label of ROMAN) {
    const re = new RegExp('(^|\\s)' + label + '\\.\\s+', 'g');
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) break;
    marks.push({ label, start: m.index, end: m.index + m[0].length });
    pos = m.index + m[0].length;
  }

  if (marks.length < 2) return { stem: text, statements: [], tail: '' };

  const stem = text.slice(0, marks[0].start).trim();
  const statements: ParsedStatement[] = marks.map((mk, i) => ({
    label: mk.label,
    text: text.slice(mk.end, marks[i + 1]?.start ?? text.length).trim(),
  }));

  let tail = '';
  const last = statements[statements.length - 1];
  for (const p of TAIL_PATTERNS) {
    const m = last.text.match(p);
    if (m && m.index !== undefined && m.index > 0) {
      tail = m[1].trim();
      last.text = last.text.slice(0, m.index).trim();
      break;
    }
  }

  return { stem, statements, tail };
}

import type { ReviewQuestion } from './history';

/** The two tabs the explorer owns. Both share the same list and facet shape. */
export type ExplorerSource = 'mistakes' | 'bookmarks';

export type ExplorerSort = 'recent' | 'most_wrong' | 'subject';

export interface ExplorerFilters {
  subject?: string;
  chapter?: string;
  topic?: string;
  institution?: string;
  exam_year?: string;
  status?: 'wrong' | 'skipped';
  has_note?: boolean;
  q?: string;
}

export interface FacetOption {
  id: string;
  parent_id: string | null;
  label_bn: string | null;
  label_en: string | null;
  count: number;
}

export type FacetMap = {
  subject?: FacetOption[];
  chapter?: FacetOption[];
  topic?: FacetOption[];
  institution?: FacetOption[];
  exam_year?: FacetOption[];
  status?: FacetOption[];
};

export interface ExplorerLabel {
  id: string;
  name_bn: string | null;
  name_en: string | null;
}

export interface ExplorerSourceRef {
  institution_id: string | null;
  institution_name_bn: string | null;
  institution_name_en: string | null;
  institution_short_name: string | null;
  exam_name: string | null;
  exam_year: string | null;
}

export interface ExplorerItem {
  id: string;
  item_id: string | null;
  question_id: string;
  status: 'wrong' | 'skipped' | 'bookmarked' | null;
  selected_option: string | null;
  occurred_at: string | null;
  note: string | null;
  wrong_times: number;
  last_wrong_at: string | null;
  subject: ExplorerLabel | null;
  chapter: ExplorerLabel | null;
  topic: ExplorerLabel | null;
  source: ExplorerSourceRef | null;
  questions: ReviewQuestion | null;
}

export interface ExplorerPage {
  items: ExplorerItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface DismissedMistake {
  question_id: string;
  dismissed_at: string | null;
  subject_id: string | null;
  subject_name_bn: string | null;
  subject_name_en: string | null;
  body: unknown;
}

/** Counted facets for the filter sheet, plus the live result count. */
export interface ExplorerFacetResponse {
  facets: FacetMap;
  counts: Record<string, number>;
}

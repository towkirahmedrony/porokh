export interface Subject {
  id: string;
  name_bn: string;
  name_en: string;
  icon_url?: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

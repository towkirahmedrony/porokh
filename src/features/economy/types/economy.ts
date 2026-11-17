export interface MarketplaceItem {
  id: string;
  title: string;
  title_en?: string | null;
  description: string;
  description_en?: string | null;
  price_coins: number;
  icon_url?: string;
  features: string[] | { bn?: string[]; en?: string[] };
  features_en?: string[] | { bn?: string[]; en?: string[] } | null;
  is_active: boolean;
  item_type: 'premium_feature' | 'exam_pass' | 'profile_badge';
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  new_balance: number;
}

import React, { useState } from 'react';
import { useEconomy } from '../hooks/useEconomy';
import { MarketplaceItem } from '../types/economy';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

const getFeatures = (item: MarketplaceItem, language: string): string[] => {
  const values = (source: unknown, lang: string): string[] => {
    if (Array.isArray(source)) return source.map(String);
    if (source && typeof source === 'object') {
      const localized = source as { bn?: unknown; en?: unknown };
      const preferred = lang === 'en' ? localized.en : localized.bn;
      const fallback = lang === 'en' ? localized.bn : localized.en;
      const list = Array.isArray(preferred) && preferred.length ? preferred : fallback;
      return Array.isArray(list) ? list.map(String) : [];
    }
    return [];
  };
  const english = values(item.features_en, 'en');
  const selected = language === 'en' && english.length ? english : values(item.features, language);
  return selected.length ? selected : values(item.features_en, language);
};

const Marketplace: React.FC = () => {
  const { language, t } = useLanguage();
  const { 
    coinBalance, 
    isCoinsLoading, 
    marketplaceItems, 
    isItemsLoading, 
    purchaseMutation 
  } = useEconomy();
  
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  const handlePurchase = (item: MarketplaceItem) => {
    if (coinBalance < item.price_coins) {
      setPurchaseError(t('marketplace.insufficientCoins'));
      return;
    }
    
    if (confirm(t('marketplace.confirmPurchase', { price: item.price_coins, title: item.title }))) {
      setPurchaseError(null);
      purchaseMutation.mutate(item.id, {
        onSuccess: (data: unknown) => {
          const responseData = data as { message?: string };
          alert(responseData.message || t('marketplace.purchaseSuccess'));
        },
        onError: (error: unknown) => {
          const err = error as { response?: { data?: { message?: string } } };
          setPurchaseError(err.response?.data?.message || t('marketplace.purchaseFailed'));
        }
      });
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 bg-app text-text-primary">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary font-['Noto_Sans_Bengali']">
            {t('marketplace.title')}
          </h1>
          <p className="mt-2 text-sm text-text-secondary font-['Noto_Sans_Bengali']">
            {t('marketplace.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3 bg-surface-elevated border border-border-color px-6 py-3 rounded-2xl">
          <div className="p-2 bg-accent text-primary-foreground rounded-full shadow-lg">
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest font-['Noto_Sans_Bengali']">{t('marketplace.totalCoins')}</p>
            <p className="text-2xl font-bold text-text-primary">
              {isCoinsLoading ? '...' : coinBalance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {purchaseError && (
        <div className="mb-6 p-4 rounded-xl bg-surface-elevated border border-border-color text-text-primary text-sm font-['Noto_Sans_Bengali']">
          ⚠️ {purchaseError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isItemsLoading ? (
          [1, 2, 3].map(i => <div key={i} className="h-64 rounded-2xl bg-surface animate-pulse border border-border-color" />)
        ) : marketplaceItems.length === 0 ? (
          <div className="col-span-full text-center py-10 text-text-secondary font-['Noto_Sans_Bengali']">
            {t('marketplace.empty')}
          </div>
        ) : (
          marketplaceItems.map((item: MarketplaceItem) => (
            <div key={item.id} className="rounded-2xl bg-card-bg border border-card-border p-6 flex flex-col justify-between hover:ring-1 hover:ring-focus-ring transition-all">
              <div>
                <h3 className="text-xl font-bold mb-2 text-text-primary font-['Noto_Sans_Bengali']">{pickLang(language, item.title, item.title_en)}</h3>
                <p className="text-sm mb-4 text-text-secondary font-['Noto_Sans_Bengali']">{pickLang(language, item.description, item.description_en)}</p>
                <ul className="space-y-2 mb-6">
                  {getFeatures(item, language).map((f, i) => (
                    <li key={i} className="text-xs text-text-secondary flex items-center gap-2 font-['Noto_Sans_Bengali']">
                      ✅ {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-between items-center border-t border-border-color pt-4">
                <span className="text-lg font-bold text-text-primary">🪙 {item.price_coins}</span>
                <button 
                  onClick={() => handlePurchase(item)}
                  disabled={purchaseMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition-opacity font-['Noto_Sans_Bengali'] disabled:opacity-50"
                >
                  {purchaseMutation.isPending ? t('marketplace.processing') : t('marketplace.buy')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Marketplace;

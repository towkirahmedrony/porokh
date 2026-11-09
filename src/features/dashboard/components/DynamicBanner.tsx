import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { pickLang } from '@/shared/i18n/localize';

interface Banner {
  id: string;
  title: string | null;
  title_bn?: string | null;
  title_en?: string | null;
  image_url: string | null;
  action_link: string | null;
  target_rules: any;
  description?: string | null;
  description_bn?: string | null;
  description_en?: string | null;
  button_text?: string | null;
  button_text_bn?: string | null;
  button_text_en?: string | null;
}

interface DynamicBannerProps {
  banners: Banner[] | null;
  isLoading: boolean;
}

const DynamicBanner: React.FC<DynamicBannerProps> = ({ banners, isLoading }) => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [banners]);

  // Keep the active slide in range when banners load late or disappear, so the
  // parent can mount this component once instead of remounting it per list size.
  useEffect(() => {
    const total = banners?.length ?? 0;
    setCurrentIndex((prev) => (prev < total ? prev : 0));
  }, [banners]);

  if (isLoading) {
    return (
      <section className="mt-3 overflow-hidden">
        <div className="w-full rounded-[20px] border border-card-border bg-card-bg px-3 py-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 rounded-[16px] bg-surface-elevated" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded-md bg-surface-elevated" />
              <div className="h-3 w-1/2 rounded-md bg-surface-elevated" />
            </div>
            <div className="h-8 w-16 shrink-0 rounded-full bg-surface-elevated" />
          </div>
        </div>
      </section>
    );
  }

  if (!banners || banners.length === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    } else if (isRightSwipe) {
      setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1));
    }
  };

  return (
    <section className="mt-3 overflow-hidden">
      <div 
        className="relative flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {banners.map((banner) => (
          <div key={banner.id} className="w-full shrink-0 px-0.5">
            <button
              type="button"
              onClick={() => navigate(banner.action_link || '/')}
              className="w-full rounded-[20px] border border-card-border bg-card-bg px-3 py-3 text-left shadow-sm active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[16px] bg-badge-bg text-badge-text">
                  {banner.image_url ? (
                    <img src={banner.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Crown className="h-6 w-6" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="font-['Noto_Sans_Bengali'] text-base font-bold leading-tight text-text-primary">
                    {pickLang(language, banner.title_bn || banner.title, banner.title_en)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 font-['Noto_Sans_Bengali'] text-xs leading-snug text-text-secondary">
                    {pickLang(
                      language,
                      banner.target_rules?.description_bn || banner.description_bn || banner.description,
                      banner.target_rules?.description_en || banner.description_en,
                    ) ||
                      t('home.bannerFallbackDescription')}
                  </p>
                </div>

                <div className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
                  {pickLang(
                    language,
                    banner.target_rules?.button_text_bn || banner.button_text_bn || banner.button_text,
                    banner.target_rules?.button_text_en || banner.button_text_en,
                  ) ||
                    t('home.bannerFallbackButton')}
                </div>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="mt-2.5 flex justify-center gap-1.5">
          {banners.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setCurrentIndex(idx)}
              aria-label={t('home.bannerSlide', { index: idx + 1 })}
              aria-current={idx === currentIndex}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-4 bg-primary' : 'w-1.5 bg-secondary'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default DynamicBanner;

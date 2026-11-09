import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

export interface AdmissionBreadcrumbItem {
  label: string;
  to?: string;
}

interface AdmissionBreadcrumbProps {
  items: AdmissionBreadcrumbItem[];
}

export const AdmissionBreadcrumb: React.FC<AdmissionBreadcrumbProps> = ({
  items,
}) => {
  const { t } = useLanguage();

  return (
  <nav aria-label={t('admission.breadcrumb')} className="mb-4 w-full overflow-x-auto no-scrollbar">
    <ol className="flex min-w-max items-center gap-1.5 text-xs sm:text-sm">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRight
                className="h-3.5 w-3.5 shrink-0 text-text-secondary"
                aria-hidden="true"
              />
            )}

            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="!no-underline [text-decoration-line:none!important] rounded-md px-1 py-0.5 text-text-secondary transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={
                  isLast
                    ? "font-semibold text-text-primary font-['Noto_Sans_Bengali']"
                    : "text-text-secondary font-['Noto_Sans_Bengali']"
                }
              >
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
  );
};

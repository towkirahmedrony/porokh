import React from 'react';
import { Cookie } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import cookieEn from '@/assets/content/legal/cookie-en.md?raw';
import cookieBn from '@/assets/content/legal/cookie-bn.md?raw';

const CookiePolicy: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<Cookie size={28} strokeWidth={2} />}
      title={{
        bn: 'কুকি পলিসি',
        en: 'Cookie Policy'
      }}
      description={{
        bn: 'পরোখ কীভাবে কুকিজ ব্যবহার করে আপনার ডেটা এবং ব্রাউজিং অভিজ্ঞতা সুরক্ষিত রাখে, তা জানুন।',
        en: 'Learn how Porokh uses cookies to protect your data and secure your browsing experience.'
      }}
      lastUpdated={{
        bn: 'সর্বশেষ আপডেট: মার্চ ২০২৬',
        en: 'Last updated: March 2026'
      }}
      content={{
        bn: cookieBn,
        en: cookieEn
      }}
    />
  );
};

export default CookiePolicy;

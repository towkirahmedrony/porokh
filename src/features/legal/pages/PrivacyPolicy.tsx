import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import privacyEn from '@/assets/content/legal/privacy-en.md?raw';
import privacyBn from '@/assets/content/legal/privacy-bn.md?raw';

const PrivacyPolicy: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<ShieldCheck size={28} strokeWidth={2} />}
      title={{
        bn: 'প্রাইভেসি পলিসি',
        en: 'Privacy Policy'
      }}
      description={{
        bn: 'জানুন কীভাবে পরোখ আপনার ডাটা এবং গোপনীয়তা সুরক্ষিত রাখে।',
        en: 'Learn how Porokh protects your data and privacy.'
      }}
      lastUpdated={{
        bn: 'সর্বশেষ আপডেট: মার্চ ২০২৬',
        en: 'Last updated: March 2026'
      }}
      content={{
        bn: privacyBn,
        en: privacyEn
      }}
    />
  );
};

export default PrivacyPolicy;

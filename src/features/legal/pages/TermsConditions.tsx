import React from 'react';
import { FileText } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import termsEn from '@/assets/content/legal/terms-en.md?raw';
import termsBn from '@/assets/content/legal/terms-bn.md?raw';

const TermsConditions: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<FileText size={28} strokeWidth={2} />}
      title={{
        bn: 'শর্তাবলি',
        en: 'Terms & Conditions'
      }}
      description={{
        bn: 'পরোখ ব্যবহার করার আগে অনুগ্রহ করে শর্তাবলি পড়ে নিন।',
        en: 'Please read these terms carefully before using Porokh.'
      }}
      lastUpdated={{
        bn: 'কার্যকর: মার্চ ২০২৬',
        en: 'Effective Date: March 2026'
      }}
      content={{
        bn: termsBn,
        en: termsEn
      }}
    />
  );
};

export default TermsConditions;

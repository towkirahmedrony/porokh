import React from 'react';
import { HelpCircle } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import faqEn from '@/assets/content/legal/faq-en.md?raw';
import faqBn from '@/assets/content/legal/faq-bn.md?raw';

const FAQ: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<HelpCircle size={28} strokeWidth={2} />}
      title={{
        bn: 'সচরাচর জিজ্ঞাসিত প্রশ্ন (FAQ)',
        en: 'Frequently Asked Questions'
      }}
      description={{
        bn: 'পরোখ এবং আমাদের সার্ভিস সম্পর্কিত সাধারণ প্রশ্নগুলোর উত্তর খুঁজুন।',
        en: 'Find answers to common questions about Porokh and our services.'
      }}
      lastUpdated={{
        bn: 'সর্বশেষ আপডেট: মার্চ ২০২৬',
        en: 'Last updated: March 2026'
      }}
      content={{
        bn: faqBn,
        en: faqEn
      }}
    />
  );
};

export default FAQ;

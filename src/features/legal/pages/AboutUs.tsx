import React from 'react';
import { Info } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import aboutEn from '@/assets/content/legal/about-en.md?raw';
import aboutBn from '@/assets/content/legal/about-bn.md?raw';

const AboutUs: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<Info size={28} strokeWidth={2} />}
      title={{
        bn: 'আমাদের সম্পর্কে',
        en: 'About Us'
      }}
      description={{
        bn: 'পরোখের লক্ষ্য, উদ্দেশ্য এবং এর পেছনের নিবেদিত প্রাণ টিম সম্পর্কে বিস্তারিত জানুন।',
        en: "Learn more about Porokh's mission, vision, and the dedicated team behind the platform."
      }}
      lastUpdated={{
        bn: 'সর্বশেষ আপডেট: মার্চ ২০২৬',
        en: 'Last updated: March 2026'
      }}
      content={{
        bn: aboutBn,
        en: aboutEn
      }}
    />
  );
};

export default AboutUs;

import React from 'react';
import { UserX } from 'lucide-react';
import { LegalPageLayout } from '@/shared/components/layout/LegalPageLayout';

import dataDeletionEn from '@/assets/content/legal/data-deletion-en.md?raw';
import dataDeletionBn from '@/assets/content/legal/data-deletion-bn.md?raw';

const DataDeletion: React.FC = () => {
  return (
    <LegalPageLayout
      icon={<UserX size={28} strokeWidth={2} />}
      title={{
        bn: 'ডেটা মুছে ফেলার নির্দেশিকা',
        en: 'Data Deletion Instructions'
      }}
      description={{
        bn: 'পরোখ প্ল্যাটফর্ম থেকে আপনার অ্যাকাউন্ট এবং ব্যক্তিগত ডেটা কীভাবে স্থায়ীভাবে মুছে ফেলবেন, তার বিস্তারিত নির্দেশিকা।',
        en: 'Detailed instructions on how to permanently delete your account and personal data from the Porokh platform.'
      }}
      lastUpdated={{
        bn: 'সর্বশেষ আপডেট: মার্চ ২০২৬',
        en: 'Last updated: March 2026'
      }}
      content={{
        bn: dataDeletionBn,
        en: dataDeletionEn
      }}
    />
  );
};

export default DataDeletion;

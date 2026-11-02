import type { AppLanguage } from '@/shared/i18n/messages';

/**
 * Copy for the public marketing site.
 *
 * These pages live outside the authenticated app shell, so their copy sits next
 * to them instead of in the app-wide `messages.ts` dictionary. The active
 * language is still read from `LanguageProvider`, so switching the language
 * anywhere in the product updates this site too.
 */

export interface PublicChrome {
  nav: {
    home: string;
    about: string;
    faq: string;
    contact: string;
    login: string;
    register: string;
    dashboard: string;
    menu: string;
    closeMenu: string;
    languageLabel: string;
    skipToContent: string;
  };
  footer: {
    blurb: string;
    platformTitle: string;
    legalTitle: string;
    supportTitle: string;
    home: string;
    about: string;
    faq: string;
    contact: string;
    privacy: string;
    terms: string;
    cookies: string;
    dataDeletion: string;
    email: string;
    facebook: string;
    rights: string;
  };
}

export interface LandingCopy {
  hero: {
    eyebrow: string;
    title: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    note: string;
  };
  preview: {
    label: string;
    question: string;
    options: string[];
    footer: string;
  };
  facts: { label: string; value: string }[];
  factsTitle: string;
  features: {
    title: string;
    intro: string;
    items: { title: string; body: string }[];
  };
  exams: {
    title: string;
    intro: string;
    items: { title: string; body: string }[];
    cta: string;
  };
  steps: {
    title: string;
    intro: string;
    items: { title: string; body: string }[];
  };
  why: { title: string; intro: string; items: string[] };
  faq: {
    title: string;
    intro: string;
    items: { question: string; answer: string }[];
    cta: string;
  };
  finalCta: {
    title: string;
    body: string;
    primary: string;
    secondary: string;
  };
}

export const PUBLIC_CHROME: Record<AppLanguage, PublicChrome> = {
  bn: {
    nav: {
      home: 'হোম',
      about: 'আমাদের সম্পর্কে',
      faq: 'সাধারণ প্রশ্ন',
      contact: 'যোগাযোগ',
      login: 'লগ ইন',
      register: 'অ্যাকাউন্ট খুলুন',
      dashboard: 'ড্যাশবোর্ড',
      menu: 'মেনু',
      closeMenu: 'মেনু বন্ধ করুন',
      languageLabel: 'ভাষা নির্বাচন করুন',
      skipToContent: 'মূল কনটেন্টে যান',
    },
    footer: {
      blurb:
        'Porokh (পরোখ) — বাংলাদেশের SSC, HSC ও ভর্তি পরীক্ষার্থীদের জন্য অনলাইন পরীক্ষা প্রস্তুতি প্ল্যাটফর্ম।',
      platformTitle: 'প্ল্যাটফর্ম',
      legalTitle: 'নীতিমালা',
      supportTitle: 'সহায়তা',
      home: 'হোম',
      about: 'আমাদের সম্পর্কে',
      faq: 'সাধারণ প্রশ্ন',
      contact: 'যোগাযোগ করুন',
      privacy: 'প্রাইভেসি পলিসি',
      terms: 'শর্তাবলি',
      cookies: 'কুকি পলিসি',
      dataDeletion: 'ডেটা মুছে ফেলা',
      email: 'ইমেইল করুন',
      facebook: 'ফেসবুক পেজ',
      rights: 'সর্বস্বত্ব সংরক্ষিত।',
    },
  },
  en: {
    nav: {
      home: 'Home',
      about: 'About',
      faq: 'FAQ',
      contact: 'Contact',
      login: 'Log in',
      register: 'Create account',
      dashboard: 'Dashboard',
      menu: 'Menu',
      closeMenu: 'Close menu',
      languageLabel: 'Choose language',
      skipToContent: 'Skip to main content',
    },
    footer: {
      blurb:
        'Porokh (পরোখ) is an online exam preparation platform for SSC, HSC and university admission candidates in Bangladesh.',
      platformTitle: 'Platform',
      legalTitle: 'Policies',
      supportTitle: 'Support',
      home: 'Home',
      about: 'About',
      faq: 'FAQ',
      contact: 'Contact us',
      privacy: 'Privacy Policy',
      terms: 'Terms & Conditions',
      cookies: 'Cookie Policy',
      dataDeletion: 'Data Deletion',
      email: 'Email us',
      facebook: 'Facebook page',
      rights: 'All rights reserved.',
    },
  },
};

export const LANDING_COPY: Record<AppLanguage, LandingCopy> = {
  bn: {
    hero: {
      eyebrow: 'বাংলাদেশের শিক্ষার্থীদের জন্য',
      title:
        'Porokh (পরোখ) — SSC, HSC ও ভর্তি পরীক্ষার প্রস্তুতি এক জায়গায়',
      body:
        'অধ্যায়ভিত্তিক MCQ অনুশীলন, পূর্ণাঙ্গ মডেল টেস্ট, প্রশ্নব্যাংক আর অগ্রগতির বিশ্লেষণ—বাংলাদেশের স্কুল, কলেজ ও ভর্তিচ্ছু শিক্ষার্থীদের জন্য একটি অনলাইন পরীক্ষা প্রস্তুতি প্ল্যাটফর্ম।',
      primaryCta: 'বিনামূল্যে শুরু করুন',
      secondaryCta: 'কীভাবে কাজ করে',
      note: 'বাংলা ও ইংরেজি · মোবাইল ও ডেস্কটপ · SSC, HSC, বোর্ড ও ভর্তি পরীক্ষা',
    },
    preview: {
      label: 'নমুনা প্রশ্ন',
      question: 'কোনটি পদার্থবিজ্ঞানের মৌলিক রাশি?',
      options: ['বল', 'ভর', 'ত্বরণ', 'চাপ'],
      footer: 'উত্তর জমা দিলেই স্কোর ও সঠিক উত্তর',
    },
    factsTitle: 'এক নজরে',
    facts: [
      { label: 'কী', value: 'অনলাইন পরীক্ষা প্রস্তুতি প্ল্যাটফর্ম' },
      { label: 'কার জন্য', value: 'SSC, HSC ও ভর্তিচ্ছু শিক্ষার্থী' },
      { label: 'ভাষা', value: 'বাংলা ও ইংরেজি' },
    ],
    features: {
      title: 'যা যা করা যায়',
      intro: 'প্রতিদিনের প্রস্তুতির জন্য যেসব দরকার, সব এক জায়গায়।',
      items: [
        {
          title: 'অধ্যায়ভিত্তিক MCQ অনুশীলন',
          body:
            'বিষয় ও অধ্যায় বেছে MCQ সমাধান করুন। প্রতিটি উত্তর জমা দেওয়ার পর স্কোর ও সঠিক উত্তর দেখতে পাবেন।',
        },
        {
          title: 'মডেল টেস্ট',
          body:
            'নির্দিষ্ট সময়ের মধ্যে পূর্ণাঙ্গ মডেল টেস্ট দিন—মেডিকেল, ইঞ্জিনিয়ারিং ও ভার্সিটি ক্যাটাগরিতে।',
        },
        {
          title: 'প্রশ্নব্যাংক',
          body:
            'প্রশ্নব্যাংক থেকে প্রশ্ন বেছে অনুশীলন করুন, উত্তর ও ব্যাখ্যা দেখে বিষয়টি বুঝে নিন।',
        },
        {
          title: 'ভর্তি পরীক্ষার প্রস্তুতি',
          body:
            'বিশ্ববিদ্যালয় ও ইউনিট অনুযায়ী ভর্তি পরীক্ষার মডেল টেস্ট ও বিগত বছরের প্রশ্ন অনুশীলন করুন।',
        },
        {
          title: 'অগ্রগতির বিশ্লেষণ',
          body:
            'প্রতিটি পরীক্ষার ফলাফল, বিষয়ভিত্তিক দুর্বলতা আর সময়ের সাথে অগ্রগতির গ্রাফ দেখুন।',
        },
        {
          title: 'লিডারবোর্ড ও স্ট্রিক',
          body:
            'প্রতিদিন অনুশীলনের স্ট্রিক ধরে রাখুন এবং XP দিয়ে লিডারবোর্ডে নিজের অবস্থান দেখুন।',
        },
      ],
    },
    exams: {
      title: 'কোন কোন পরীক্ষার প্রস্তুতি',
      intro: 'আপনার লক্ষ্য অনুযায়ী প্রস্তুতি বেছে নিন।',
      items: [
        {
          title: 'মডেল টেস্ট',
          body: 'বিষয়ভিত্তিক পূর্ণাঙ্গ মডেল টেস্ট, স্কোর ও ফলাফল বিশ্লেষণসহ।',
        },
        {
          title: 'বোর্ড পরীক্ষা',
          body:
            'SSC ও HSC বোর্ড পরীক্ষার প্রস্তুতির জন্য বিষয়ভিত্তিক প্রশ্ন অনুশীলন।',
        },
        {
          title: 'ভর্তি পরীক্ষা',
          body: 'বিশ্ববিদ্যালয় ও ইউনিটভিত্তিক ভর্তি প্রস্তুতি ও বিগত বছরের প্রশ্ন।',
        },
      ],
      cta: 'শুরু করতে অ্যাকাউন্ট খুলুন',
    },
    steps: {
      title: 'কীভাবে কাজ করে',
      intro: 'তিন ধাপে প্রথম অনুশীলন শুরু করুন।',
      items: [
        {
          title: 'অ্যাকাউন্ট খুলুন',
          body:
            'ইমেইল দিয়ে বিনামূল্যে অ্যাকাউন্ট খুলুন, তারপর ক্লাস ও গ্রুপ বেছে নিন।',
        },
        {
          title: 'পরীক্ষা বেছে নিন',
          body:
            'মডেল টেস্ট, বোর্ড প্রশ্ন কিংবা ভর্তি পরীক্ষা—আপনার লক্ষ্য অনুযায়ী প্রস্তুতি বেছে নিন।',
        },
        {
          title: 'অনুশীলন ও অগ্রগতি',
          body:
            'পরীক্ষা দিন, ফলাফল দেখুন, ভুল প্রশ্নগুলো আবার অনুশীলন করুন আর অগ্রগতি ট্র্যাক করুন।',
        },
      ],
    },
    why: {
      title: 'কেন Porokh',
      intro: 'প্রস্তুতিকে গোছানো রাখার জন্য যেসব বিষয় গুরুত্বপূর্ণ।',
      items: [
        'নিজের সময়ে নিজের গতিতে অনুশীলন—মোবাইল হোক বা ডেস্কটপ।',
        'প্রতিটি পরীক্ষার পরে ফলাফল এবং দুর্বল বিষয়ের তালিকা।',
        'ইন্টারনেট দুর্বল হলেও অফলাইনে পরীক্ষা দেওয়ার সুবিধা।',
        'বাংলা ও ইংরেজি—দুই ভাষাতেই ব্যবহার করা যায়।',
      ],
    },
    faq: {
      title: 'সচরাচর জিজ্ঞাসিত প্রশ্ন',
      intro: 'শুরু করার আগে যা জানা দরকার।',
      items: [
        {
          question: 'Porokh (পরোখ) কী?',
          answer:
            'Porokh (পরোখ) হলো বাংলাদেশের শিক্ষার্থীদের জন্য একটি অনলাইন পরীক্ষা প্রস্তুতি প্ল্যাটফর্ম। এখানে SSC, HSC, বোর্ড ও ভর্তি পরীক্ষার জন্য MCQ অনুশীলন, মডেল টেস্ট ও প্রশ্নব্যাংক পাওয়া যায়।',
        },
        {
          question: 'শুরু করতে কি টাকা লাগে?',
          answer:
            'না। বিনামূল্যে অ্যাকাউন্ট খুলে অনুশীলন শুরু করা যায়। কিছু অতিরিক্ত সুবিধা প্রিমিয়াম প্ল্যানে পাওয়া যায়।',
        },
        {
          question: 'মোবাইলে ব্যবহার করা যাবে?',
          answer:
            'হ্যাঁ। Porokh মোবাইল ব্রাউজারে কাজ করে এবং Android অ্যাপ হিসেবেও ব্যবহার করা যায়।',
        },
      ],
      cta: 'সব প্রশ্নের উত্তর দেখুন',
    },
    finalCta: {
      title: 'আজই প্রস্তুতি শুরু করুন',
      body: 'বিনামূল্যে অ্যাকাউন্ট খুলে প্রথম পরীক্ষাটি দিন—কোনো ঝামেলা ছাড়াই।',
      primary: 'অ্যাকাউন্ট খুলুন',
      secondary: 'লগ ইন করুন',
    },
  },
  en: {
    hero: {
      eyebrow: 'Built for students in Bangladesh',
      title:
        'Porokh (পরোখ) — SSC, HSC and admission exam practice in one place',
      body:
        'Chapter-wise MCQ practice, timed model tests, question banks and progress analysis, in one exam preparation platform for school, college and admission candidates in Bangladesh.',
      primaryCta: 'Start for free',
      secondaryCta: 'See how it works',
      note: 'Bangla and English · Mobile and desktop · SSC, HSC, board and admission',
    },
    preview: {
      label: 'Sample question',
      question: 'Which of these is a fundamental quantity in physics?',
      options: ['Force', 'Mass', 'Acceleration', 'Pressure'],
      footer: 'Submit an answer to see your score and the correct option',
    },
    factsTitle: 'At a glance',
    facts: [
      { label: 'What', value: 'Online exam preparation platform' },
      { label: 'Who for', value: 'SSC, HSC and admission candidates' },
      { label: 'Languages', value: 'Bangla and English' },
    ],
    features: {
      title: 'What you can do',
      intro: 'Everything a daily study routine needs, in one place.',
      items: [
        {
          title: 'Chapter-wise MCQ practice',
          body:
            'Pick a subject and chapter, then solve MCQs. After submitting you see your score and the correct answer.',
        },
        {
          title: 'Model tests',
          body:
            'Take full model tests against the clock, with medical, engineering and university categories.',
        },
        {
          title: 'Question bank',
          body:
            'Practise from the question bank and read the answer and explanation for each question.',
        },
        {
          title: 'Admission preparation',
          body:
            'Prepare for university and unit-based admission tests with model tests and previous questions.',
        },
        {
          title: 'Progress analysis',
          body:
            'See the result of every exam, the subjects you are weak in, and how your scores move over time.',
        },
        {
          title: 'Leaderboard and streak',
          body:
            'Keep a daily practice streak and see where you stand on the XP leaderboard.',
        },
      ],
    },
    exams: {
      title: 'Exams you can prepare for',
      intro: 'Choose the preparation that matches your goal.',
      items: [
        {
          title: 'Model tests',
          body: 'Full subject-wise model tests with scoring and result analysis.',
        },
        {
          title: 'Board exams',
          body: 'Subject-wise practice for SSC and HSC board examinations.',
        },
        {
          title: 'Admission tests',
          body:
            'University and unit-based admission preparation with previous questions.',
        },
      ],
      cta: 'Create an account to start',
    },
    steps: {
      title: 'How it works',
      intro: 'Three steps to your first practice session.',
      items: [
        {
          title: 'Create an account',
          body:
            'Sign up free with your email, then choose your class and group.',
        },
        {
          title: 'Pick an exam',
          body:
            'Choose a model test, a board question set or admission preparation that matches your goal.',
        },
        {
          title: 'Practise and track',
          body:
            'Take the exam, review the result, re-practise the questions you missed and follow your progress.',
        },
      ],
    },
    why: {
      title: 'Why Porokh',
      intro: 'What keeps preparation organised instead of scattered.',
      items: [
        'Practise at your own pace, on a phone or on a desktop.',
        'Every exam ends with a result and a list of weak topics.',
        'Exams keep working when the connection is poor.',
        'Available in both Bangla and English.',
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      intro: 'What students ask before starting.',
      items: [
        {
          question: 'What is Porokh?',
          answer:
            'Porokh (পরোখ) is an online exam preparation platform for students in Bangladesh. It offers MCQ practice, model tests and question banks for SSC, HSC, board and university admission examinations.',
        },
        {
          question: 'Does it cost anything to start?',
          answer:
            'No. You can create a free account and start practising. Some extra features are part of premium plans.',
        },
        {
          question: 'Can I use it on a phone?',
          answer:
            'Yes. Porokh works in a mobile browser and is also available as an Android app.',
        },
      ],
      cta: 'Read all questions',
    },
    finalCta: {
      title: 'Start preparing today',
      body: 'Create a free account and take your first exam, with nothing to set up.',
      primary: 'Create account',
      secondary: 'Log in',
    },
  },
};

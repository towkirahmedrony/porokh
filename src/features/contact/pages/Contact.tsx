import React, { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SUPPORT_CONFIG } from '@/shared/constants/supportConfig';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { localizeDigits } from '@/shared/i18n/messages';
import { buildApiUrl } from '@/shared/lib/apiConfig';

type Language = 'bn' | 'en';

interface ContactFormData {
  name: string;
  email: string;
  message: string;
  website: string;
}

interface ContactPayload {
  name: string;
  email: string;
  message: string;
  website?: string;
  submittedAfterMs: number;
}

type FieldErrors = Partial<Record<keyof Pick<ContactFormData, 'name' | 'email' | 'message'>, string>>;

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 80;
const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;
const MIN_SUBMIT_TIME_MS = 2500;
const CONTACT_REQUEST_TIMEOUT_MS = 15000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const TEXTS = {
  bn: {
    title: 'আমাদের সাথে যোগাযোগ করুন',
    subtitle: 'কীভাবে পরোখ আপনাকে সাহায্য করতে পারে তা জানান।',
    nameLabel: 'আপনার নাম',
    namePlaceholder: 'যেমন: রহিম',
    emailLabel: 'ইমেইল অ্যাড্রেস',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: 'আপনার মেসেজ',
    messagePlaceholder: 'কী বিষয়ে জানতে চান, বিস্তারিত লিখুন...',
    submitBtn: 'মেসেজ পাঠান',
    submittingBtn: 'পাঠানো হচ্ছে...',
    successMsg: 'আপনার মেসেজ সফলভাবে পাঠানো হয়েছে!',
    errorMsg: 'দুঃখিত, মেসেজ পাঠানো যায়নি। একটু পরে আবার চেষ্টা করুন।',
    configErrorMsg: 'Contact service এখন কনফিগার করা নেই।',
    directContact: 'অথবা সরাসরি যোগাযোগ করুন',
    emailBtn: 'ইমেইল করুন',
    fbBtn: 'ফেসবুক পেজ',
    languageSwitchLabel: 'ভাষা নির্বাচন করুন',
    requiredName: 'নাম লিখুন।',
    invalidName: `নাম ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} অক্ষরের মধ্যে হতে হবে।`,
    requiredEmail: 'ইমেইল অ্যাড্রেস লিখুন।',
    invalidEmail: 'সঠিক ইমেইল অ্যাড্রেস লিখুন।',
    requiredMessage: 'মেসেজ লিখুন।',
    invalidMessage: `মেসেজ ${MIN_MESSAGE_LENGTH}-${MAX_MESSAGE_LENGTH} অক্ষরের মধ্যে হতে হবে।`,
    spamWarning: 'অনুগ্রহ করে ফর্মটি স্বাভাবিকভাবে পূরণ করে আবার চেষ্টা করুন।'
  },
  en: {
    title: 'Contact Us',
    subtitle: 'Let us know how Porokh can help you.',
    nameLabel: 'Your Name',
    namePlaceholder: 'e.g., Rahim',
    emailLabel: 'Email Address',
    emailPlaceholder: 'your.email@example.com',
    messageLabel: 'Your Message',
    messagePlaceholder: 'Write your message in detail...',
    submitBtn: 'Send Message',
    submittingBtn: 'Sending...',
    successMsg: 'Your message has been sent successfully!',
    errorMsg: 'Sorry, your message could not be sent. Please try again later.',
    configErrorMsg: 'Contact service is not configured.',
    directContact: 'Or contact us directly',
    emailBtn: 'Email Us',
    fbBtn: 'Facebook Page',
    languageSwitchLabel: 'Choose language',
    requiredName: 'Please enter your name.',
    invalidName: `Name must be between ${MIN_NAME_LENGTH}-${MAX_NAME_LENGTH} characters.`,
    requiredEmail: 'Please enter your email address.',
    invalidEmail: 'Please enter a valid email address.',
    requiredMessage: 'Please enter your message.',
    invalidMessage: `Message must be between ${MIN_MESSAGE_LENGTH}-${MAX_MESSAGE_LENGTH} characters.`,
    spamWarning: 'Please fill out the form normally and try again.'
  }
} as const;

const getContactApiUrl = () => buildApiUrl('/contact');

const parseErrorMessage = (error: unknown, language: Language) => {
  const t = TEXTS[language];

  if (error instanceof Error && error.message === 'CONTACT_API_NOT_CONFIGURED') {
    return t.configErrorMsg;
  }

  return t.errorMsg;
};

const validateForm = (data: ContactFormData, language: Language): FieldErrors => {
  const t = TEXTS[language];
  const errors: FieldErrors = {};

  const name = data.name.trim();
  const email = data.email.trim();
  const message = data.message.trim();

  if (!name) {
    errors.name = t.requiredName;
  } else if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) {
    errors.name = t.invalidName;
  }

  if (!email) {
    errors.email = t.requiredEmail;
  } else if (!EMAIL_PATTERN.test(email)) {
    errors.email = t.invalidEmail;
  }

  if (!message) {
    errors.message = t.requiredMessage;
  } else if (message.length < MIN_MESSAGE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
    errors.message = t.invalidMessage;
  }

  return errors;
};

const getNormalizedPayload = (data: ContactFormData, submittedAfterMs: number): ContactPayload => ({
  name: data.name.trim(),
  email: data.email.trim().toLowerCase(),
  message: data.message.trim(),
  website: data.website.trim(),
  submittedAfterMs
});

const submitContactMessage = async (payload: ContactPayload): Promise<unknown> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CONTACT_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(getContactApiUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get('content-type');
    const responseBody = contentType?.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const message =
        typeof responseBody?.message === 'string' && responseBody.message.trim()
          ? responseBody.message
          : 'CONTACT_SUBMISSION_FAILED';

      throw new Error(message);
    }

    return responseBody;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const Contact = () => {
  // Single authoritative language state shared with the rest of the app.
  const { language, setLanguage } = useLanguage();
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    message: '',
    website: ''
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formWarning, setFormWarning] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const formStartedAtRef = useRef(Date.now());
  const successTimerRef = useRef<number | null>(null);

  const t = TEXTS[language];

  const errorMessage = useMemo(
    () => (formWarning ? formWarning : null),
    [formWarning]
  );

  const submitMutation = useMutation({
    mutationFn: submitContactMessage,
    onSuccess: () => {
      setFormData({
        name: '',
        email: '',
        message: '',
        website: ''
      });
      setFieldErrors({});
      setFormWarning('');
      setShowSuccess(true);
      formStartedAtRef.current = Date.now();

      if (successTimerRef.current) {
        window.clearTimeout(successTimerRef.current);
      }

      successTimerRef.current = window.setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    },
    onError: () => {
      setShowSuccess(false);
    }
  });

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    setFieldErrors(validateForm(formData, nextLanguage));
    setFormWarning('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

    setShowSuccess(false);
    setFormWarning('');

    if (name === 'name' || name === 'email' || name === 'message') {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const nextErrors = validateForm(formData, language);
    setFieldErrors(nextErrors);
    setFormWarning('');

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    const submittedAfterMs = Date.now() - formStartedAtRef.current;

    if (formData.website.trim() || submittedAfterMs < MIN_SUBMIT_TIME_MS) {
      setFormWarning(t.spamWarning);
      return;
    }

    submitMutation.mutate(getNormalizedPayload(formData, submittedAfterMs));
  };

  const mutationErrorMessage =
    submitMutation.isError && submitMutation.error
      ? parseErrorMessage(submitMutation.error, language)
      : null;

  const visibleErrorMessage = errorMessage || mutationErrorMessage;
  const isSubmitting = submitMutation.isPending;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex flex-col items-center transition-colors duration-300 bg-app text-text-primary">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6 bg-surface-elevated text-primary">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold mb-2">{t.title}</h1>
        <p className="text-text-secondary">{t.subtitle}</p>
      </div>

      <div className="max-w-md w-full rounded-xl shadow-sm overflow-hidden bg-card-bg border border-card-border">
        <div className="flex justify-end p-4 bg-surface border-b border-border-color">
          <div
            className="flex rounded-lg p-1 bg-surface-elevated gap-1"
            role="group"
            aria-label={t.languageSwitchLabel}
          >
            {(['bn', 'en'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => handleLanguageChange(lang)}
                aria-pressed={language === lang}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                  language === lang
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-text-secondary hover:bg-surface'
                }`}
              >
                {lang === 'bn' ? 'বাংলা' : 'English'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-busy={isSubmitting}>
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1 text-text-primary">
                {t.nameLabel}
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                minLength={MIN_NAME_LENGTH}
                maxLength={MAX_NAME_LENGTH}
                value={formData.name}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'contact-name-error' : undefined}
                autoComplete="name"
                className="w-full px-4 py-2.5 rounded-lg outline-none transition-all bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring"
                placeholder={t.namePlaceholder}
              />
              {fieldErrors.name && (
                <p id="contact-name-error" className="mt-1 text-xs text-accent">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1 text-text-primary">
                {t.emailLabel}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'contact-email-error' : undefined}
                autoComplete="email"
                inputMode="email"
                className="w-full px-4 py-2.5 rounded-lg outline-none transition-all bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring"
                placeholder={t.emailPlaceholder}
              />
              {fieldErrors.email && (
                <p id="contact-email-error" className="mt-1 text-xs text-accent">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium mb-1 text-text-primary">
                {t.messageLabel}
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={4}
                minLength={MIN_MESSAGE_LENGTH}
                maxLength={MAX_MESSAGE_LENGTH}
                value={formData.message}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.message)}
                aria-describedby={fieldErrors.message ? 'contact-message-error contact-message-count' : 'contact-message-count'}
                className="w-full px-4 py-2.5 rounded-lg outline-none transition-all resize-none bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring"
                placeholder={t.messagePlaceholder}
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                {fieldErrors.message ? (
                  <p id="contact-message-error" className="text-xs text-accent">
                    {fieldErrors.message}
                  </p>
                ) : (
                  <span />
                )}
                <p id="contact-message-count" className="text-xs text-text-secondary">
                  {localizeDigits(formData.message.trim().length, language)}/{localizeDigits(MAX_MESSAGE_LENGTH, language)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-disabled={isSubmitting}
              className="w-full py-3 rounded-lg font-bold disabled:opacity-50 flex justify-center items-center gap-2 transition-all active:scale-[0.98] bg-primary text-primary-foreground hover:opacity-90"
            >
              {isSubmitting && (
                <span
                  className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
              )}
              {isSubmitting ? t.submittingBtn : t.submitBtn}
            </button>

            {showSuccess && (
              <div
                className="p-3 rounded-lg text-sm text-center font-medium bg-badge-bg text-badge-text border border-border-color"
                role="status"
              >
                {t.successMsg}
              </div>
            )}

            {visibleErrorMessage && (
              <div
                className="p-3 rounded-lg text-sm text-center font-medium bg-surface-elevated text-accent border border-border-color"
                role="alert"
              >
                {visibleErrorMessage}
              </div>
            )}
          </form>
        </div>
      </div>

      <div className="mt-10 text-center">
        <p className="text-sm mb-4 text-text-secondary">{t.directContact}</p>
        <div className="flex justify-center gap-4">
          <a
            href={`mailto:${SUPPORT_CONFIG.EMAIL}`}
            className="p-2 rounded-full transition-all border border-border-color bg-surface hover:bg-surface-elevated hover:scale-105 text-text-primary"
            aria-label={t.emailBtn}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </a>

          <a
            href={SUPPORT_CONFIG.FACEBOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full transition-all border border-border-color bg-surface hover:bg-surface-elevated hover:scale-105 text-text-primary"
            aria-label={t.fbBtn}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};

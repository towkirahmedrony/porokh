import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Flame,
  GraduationCap,
  Landmark,
  Timer,
} from 'lucide-react';

import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { LANDING_COPY } from '../content';

const FEATURE_ICONS = [
  BookOpen,
  Timer,
  ClipboardList,
  GraduationCap,
  BarChart3,
  Flame,
] as const;

const EXAM_ICONS = [Timer, Landmark, GraduationCap] as const;

const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-app';

const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface px-5 py-3 text-sm font-bold text-text-primary transition-colors hover:bg-surface-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

const sectionTitle =
  "text-2xl font-bold leading-snug text-text-primary sm:text-3xl";

const LandingPage: React.FC = () => {
  const { language } = useLanguage();
  const copy = LANDING_COPY[language];

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border-color">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-accent/10 blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-badge-bg px-3 py-1.5 text-xs font-bold text-badge-text">
              <GraduationCap size={14} aria-hidden="true" />
              {copy.hero.eyebrow}
            </p>

            <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-text-primary sm:text-4xl lg:text-[2.75rem]">
              {copy.hero.title}
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-text-secondary">
              {copy.hero.body}
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth/register" className={primaryButton}>
                {copy.hero.primaryCta}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <a href="#how-it-works" className={secondaryButton}>
                {copy.hero.secondaryCta}
              </a>
            </div>

            <p className="mt-5 text-xs leading-6 text-text-secondary">
              {copy.hero.note}
            </p>
          </div>

          {/* Product illustration: a sample question card, drawn with markup so
              the hero has no image weight. */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-card-border bg-card-bg p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-surface-elevated px-2.5 py-1 text-[11px] font-bold text-text-secondary">
                  {copy.preview.label}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] font-bold text-text-secondary"
                  aria-hidden="true"
                >
                  <Timer size={13} />
                  12:00
                </span>
              </div>

              <p className="mt-4 text-base font-bold leading-7 text-text-primary">
                {copy.preview.question}
              </p>

              <ul className="mt-4 space-y-2">
                {copy.preview.options.map((option, index) => (
                  <li
                    key={option}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                      index === 1
                        ? 'border-primary bg-badge-bg text-badge-text'
                        : 'border-border-color bg-surface text-text-primary'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        index === 1
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-surface-elevated text-text-secondary'
                      }`}
                      aria-hidden="true"
                    >
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option}
                    {index === 1 && (
                      <CheckCircle2
                        size={16}
                        className="ml-auto text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div className="h-full w-2/3 rounded-full bg-primary" />
              </div>
              <p className="mt-2 text-[11px] text-text-secondary">
                {copy.preview.footer}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What Porokh is, stated plainly for readers and answer engines */}
      <section aria-labelledby="facts-title" className="border-b border-border-color bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <h2
            id="facts-title"
            className="text-xs font-bold uppercase tracking-wider text-text-secondary"
          >
            {copy.factsTitle}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {copy.facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-card-border bg-card-bg px-4 py-3"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  {fact.label}
                </dt>
                <dd className="mt-1 text-sm font-bold leading-6 text-text-primary">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        aria-labelledby="features-title"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16"
      >
        <h2 id="features-title" className={sectionTitle}>
          {copy.features.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          {copy.features.intro}
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {copy.features.items.map((item, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <li
                key={item.title}
                className="rounded-2xl border border-card-border bg-card-bg p-5 transition-colors hover:border-primary/40"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-badge-bg text-primary">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-3 text-base font-bold text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                  {item.body}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Exams */}
      <section
        id="exams"
        aria-labelledby="exams-title"
        className="border-y border-border-color bg-surface"
      >
        <div className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16">
          <h2 id="exams-title" className={sectionTitle}>
            {copy.exams.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {copy.exams.intro}
          </p>

          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {copy.exams.items.map((item, index) => {
              const Icon = EXAM_ICONS[index];
              return (
                <li
                  key={item.title}
                  className="flex flex-col rounded-2xl border border-card-border bg-card-bg p-5"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated text-primary">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3 className="mt-3 text-base font-bold text-text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ul>

          <Link
            to="/auth/register"
            className={`${primaryButton} mt-8 w-full sm:w-auto`}
          >
            {copy.exams.cta}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        aria-labelledby="steps-title"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16"
      >
        <h2 id="steps-title" className={sectionTitle}>
          {copy.steps.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
          {copy.steps.intro}
        </p>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {copy.steps.items.map((item, index) => (
            <li
              key={item.title}
              className="relative overflow-hidden rounded-2xl border border-card-border bg-card-bg p-5"
            >
              <span
                aria-hidden="true"
                className="absolute right-3 top-1 text-5xl font-extrabold text-primary/10"
              >
                {index + 1}
              </span>
              <p className="text-sm font-bold text-primary">
                {index + 1}
              </p>
              <h3 className="mt-1 text-base font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-1.5 text-sm leading-6 text-text-secondary">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Why */}
      <section className="border-y border-border-color bg-surface">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className={sectionTitle}>{copy.why.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">
            {copy.why.intro}
          </p>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {copy.why.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-card-border bg-card-bg p-4 text-sm leading-6 text-text-primary"
              >
                <CheckCircle2
                  size={18}
                  className="mt-0.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ preview */}
      <section
        id="faq"
        aria-labelledby="faq-title"
        className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-12 sm:px-6 sm:py-16"
      >
        <h2 id="faq-title" className={sectionTitle}>
          {copy.faq.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {copy.faq.intro}
        </p>

        <div className="mt-6 divide-y divide-border-color overflow-hidden rounded-2xl border border-card-border bg-card-bg">
          {copy.faq.items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-sm font-bold text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring">
                {item.question}
                <ArrowRight
                  size={16}
                  className="shrink-0 text-text-secondary transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
              </summary>
              <p className="px-5 pb-4 text-sm leading-6 text-text-secondary">
                {item.answer}
              </p>
            </details>
          ))}
        </div>

        <Link
          to="/faq"
          className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          {copy.faq.cta}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-14 sm:px-6">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground sm:px-10">
          <h2 className="text-2xl font-extrabold leading-snug sm:text-3xl">
            {copy.finalCta.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6">
            {copy.finalCta.body}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/auth/register"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 py-3 text-sm font-bold text-primary transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            >
              {copy.finalCta.primary}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link
              to="/auth/login"
              className="inline-flex items-center justify-center rounded-xl border border-primary-foreground/60 px-5 py-3 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-foreground/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
            >
              {copy.finalCta.secondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;

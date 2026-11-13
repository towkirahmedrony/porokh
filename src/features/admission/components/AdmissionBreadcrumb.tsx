import React from 'react';

export interface AdmissionBreadcrumbItem {
  label: string;
  to?: string;
}

interface AdmissionBreadcrumbProps {
  items: AdmissionBreadcrumbItem[];
}

export const AdmissionBreadcrumb: React.FC<AdmissionBreadcrumbProps> = () => {
  // The app no longer shows the upper location tracker. Keep this shared
  // component as a no-op so every existing admission screen removes it
  // consistently without duplicating route/layout changes across pages.
  return null;
};

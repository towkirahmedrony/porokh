import React from 'react';
import { useLanguage } from '@/shared/i18n/LanguageProvider';

interface SelectOption {
  label: string;
  value: string;
}

interface FormSelectGroupProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: SelectOption[];
  disabled?: boolean;
}

const FormSelectGroup: React.FC<FormSelectGroupProps> = React.memo(({
  label, name, value, onChange, options, disabled 
}) => {
  const { t } = useLanguage();
  return (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium" style={{ color: 'color-mix(in srgb, var(--dyn-text) 70%, transparent)' }}>
      {label}
    </label>
    <select 
      name={name} 
      value={value} 
      onChange={onChange}
      disabled={disabled}
      className="w-full rounded-xl p-3.5 text-sm focus:ring-2 focus:outline-none transition-all focus:ring-[var(--dyn-primary)] disabled:opacity-50 appearance-none"
      style={{ 
        backgroundColor: 'color-mix(in srgb, var(--dyn-text) 3%, transparent)',
        border: '1px solid color-mix(in srgb, var(--dyn-text) 15%, transparent)',
        color: 'var(--dyn-text)'
      }}
    >
      <option value="" style={{ color: '#000' }}>{t('common.select')}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} style={{ color: '#000' }}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
  );
});

FormSelectGroup.displayName = 'FormSelectGroup';
export default FormSelectGroup;

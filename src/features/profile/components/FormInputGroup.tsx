import React from 'react';

interface FormInputGroupProps {
  label: string;
  name: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  isTextArea?: boolean;
  type?: string;
}

const FormInputGroup: React.FC<FormInputGroupProps> = React.memo(({ 
  label, name, value, onChange, placeholder, disabled, icon, isTextArea, type 
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-text-secondary">
      {label}
    </label>
    <div className="relative">
      {isTextArea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={3}
          className="w-full rounded-xl p-3 text-sm focus:outline-none transition-all disabled:opacity-50 bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring"
        />
      ) : (
        <input 
          type={type || "text"} 
          name={name} 
          value={value} 
          onChange={onChange} 
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-xl p-3.5 text-sm focus:outline-none disabled:opacity-50 transition-all bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring"
        />
      )}
      {icon && <span className="absolute right-4 top-3.5 text-lg text-text-secondary">{icon}</span>}
    </div>
  </div>
));

FormInputGroup.displayName = 'FormInputGroup';
export default FormInputGroup;

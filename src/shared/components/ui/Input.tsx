import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input: React.FC<InputProps> = ({ className = '', ...props }) => {
  return (
    <input 
      className={`w-full px-4 py-2 rounded-lg transition-all focus:outline-none bg-input-bg border border-input-border text-text-primary focus:ring-2 focus:ring-focus-ring ${className}`}
      {...props} 
    />
  );
};

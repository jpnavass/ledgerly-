import React, { useState, useEffect } from 'react';
import { eurosToCents, centsToEuros } from '@/lib/money';

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string;
  centsValue: number;
  onCentsChange: (cents: number) => void;
  error?: string;
}

export function NumberInput({
  label,
  centsValue,
  onCentsChange,
  error,
  id,
  className = '',
  disabled,
  ...props
}: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState(() => (centsValue / 100).toFixed(2).replace('.', ','));

  useEffect(() => {
    setDisplayValue((centsValue / 100).toFixed(2).replace('.', ','));
  }, [centsValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayValue(raw);
    const parsed = eurosToCents(raw);
    onCentsChange(parsed);
  };

  const handleBlur = () => {
    setDisplayValue((centsValue / 100).toFixed(2).replace('.', ','));
  };

  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold text-[var(--text-secondary)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        className={`input text-right tabular-nums ${error ? 'border-[var(--danger-fg)]' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger-fg)] mt-1">{error}</p>}
    </div>
  );
}

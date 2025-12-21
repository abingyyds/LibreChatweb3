import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Spinner, Button } from '@librechat/client';
import type { TZkpLoginUser, TStartupConfig } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';

type TZkpLoginFormProps = {
  onSubmit: (data: TZkpLoginUser) => void;
  startupConfig: TStartupConfig;
  isSubmitting?: boolean;
};

const ZkpLoginForm: React.FC<TZkpLoginFormProps> = ({ onSubmit, startupConfig, isSubmitting }) => {
  const localize = useLocalize();
  const [zkpError, setZkpError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TZkpLoginUser>();

  if (!startupConfig) {
    return null;
  }

  const renderError = (fieldName: string) => {
    const errorMessage = errors[fieldName]?.message;
    return errorMessage ? (
      <span role="alert" className="mt-1 text-sm text-red-600 dark:text-red-500">
        {String(errorMessage)}
      </span>
    ) : null;
  };

  const handleFormSubmit = (data: TZkpLoginUser) => {
    setZkpError(null);
    onSubmit(data);
  };

  return (
    <form
      className="mt-6"
      aria-label="ZKP Login form"
      method="POST"
      onSubmit={handleSubmit(handleFormSubmit)}
    >
      <div className="mb-4">
        <div className="relative">
          <textarea
            id="zkpCode"
            aria-label="ZKP Code"
            {...register('zkpCode', {
              required: 'ZKP Code is required',
              validate: (value) => {
                if (typeof value !== 'string') {
                  return true;
                }
                const trimmed = value.trim();
                // Check if it's valid JSON format
                if (trimmed.startsWith('{')) {
                  try {
                    const parsed = JSON.parse(trimmed);
                    if (!parsed.a || !parsed.b || !parsed.c || !parsed.input) {
                      return 'Invalid ZKP Code format';
                    }
                    return true;
                  } catch {
                    return 'Invalid JSON format';
                  }
                }
                // Check if it's comma-separated format (9 values)
                const cleanStr = trimmed.replace(/[\u200B-\u200D\uFEFF]/g, '');
                const parts = cleanStr.split(/\s*,\s*/).map((p) => p.trim());
                if (parts.length !== 9) {
                  return 'ZKP Code must have exactly 9 comma-separated values';
                }
                return true;
              },
            })}
            aria-invalid={!!errors.zkpCode}
            rows={4}
            className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-6 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
            placeholder=" "
          />
          <label
            htmlFor="zkpCode"
            className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-6 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-600 dark:peer-focus:text-green-500 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4"
          >
            ZKP Code
          </label>
        </div>
        {renderError('zkpCode')}
        {zkpError && (
          <span role="alert" className="mt-1 text-sm text-red-600 dark:text-red-500">
            {zkpError}
          </span>
        )}
        <p className="mt-2 text-xs text-text-secondary">
          Enter your ZKP proof code. Supports JSON format or 9 comma-separated values.
        </p>
      </div>

      <div className="mt-6">
        <Button
          aria-label="Login with ZKP"
          data-testid="zkp-login-button"
          type="submit"
          disabled={isSubmitting}
          variant="submit"
          className="h-12 w-full rounded-2xl"
        >
          {isSubmitting ? <Spinner /> : 'Login with ZKP'}
        </Button>
      </div>
    </form>
  );
};

export default ZkpLoginForm;

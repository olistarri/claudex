import { memo, type ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Lock, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Layout } from '@/components/layout';
import { Button, FieldMessage, Input, Label } from '@/components/ui';
import { useResetPasswordMutation } from '@/hooks/queries';
import { isValidPassword } from '@/utils/validation';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

type ResetPasswordFormErrors = Partial<Record<keyof ResetPasswordFormData, string>>;

interface ResetPasswordPageLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const ResetPasswordPageLayout = memo(function ResetPasswordPageLayout({
  title,
  subtitle,
  children,
}: ResetPasswordPageLayoutProps) {
  return (
    <Layout isAuthPage={true}>
      <div className="flex h-full flex-col bg-surface-secondary dark:bg-surface-dark-secondary">
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <div className="relative z-10 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="space-y-2 text-center">
                <h2 className="animate-fadeIn text-3xl font-bold text-text-primary dark:text-text-dark-primary">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-text-secondary dark:text-text-dark-secondary">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="relative rounded-xl border border-border bg-surface-tertiary p-6 shadow-2xl backdrop-blur-xl dark:border-border-dark dark:bg-surface-dark-tertiary">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

const validateForm = (values: ResetPasswordFormData): ResetPasswordFormErrors | null => {
  const errors: ResetPasswordFormErrors = {};

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(values.password)) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (values.password !== values.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return Object.keys(errors).length ? errors : null;
};

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [values, setValues] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<ResetPasswordFormErrors | null>(null);
  const [visibleFields, setVisibleFields] = useState<Record<keyof ResetPasswordFormData, boolean>>({
    password: false,
    confirmPassword: false,
  });
  const [token, setToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const resetPasswordMutation = useResetPasswordMutation();

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setTokenError('Invalid or missing reset token');
      return;
    }
    setToken(tokenParam);
  }, [searchParams]);

  const handleChange = useCallback(
    (name: keyof ResetPasswordFormData, value: string) => {
      setValues((prev) => ({ ...prev, [name]: value }));
      setErrors((prev) => {
        if (!prev?.[name]) {
          return prev;
        }

        const rest = { ...prev };
        delete rest[name];
        return Object.keys(rest).length ? rest : null;
      });
      resetPasswordMutation.reset();
    },
    [resetPasswordMutation],
  );

  const toggleFieldVisibility = useCallback((field: keyof ResetPasswordFormData) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!token) {
        setTokenError('Invalid or missing reset token');
        return;
      }

      const validationErrors = validateForm(values);
      if (validationErrors) {
        setErrors(validationErrors);
        return;
      }

      setErrors(null);
      const attemptValues = { ...values };

      resetPasswordMutation.mutate({
        token,
        password: attemptValues.password,
      });
    },
    [resetPasswordMutation, token, values],
  );

  const fieldConfigs = useMemo(
    () => [
      {
        name: 'password' as const,
        label: 'New Password',
        placeholder: 'Enter new password (min. 8 characters)',
      },
      {
        name: 'confirmPassword' as const,
        label: 'Confirm Password',
        placeholder: 'Confirm your new password',
      },
    ],
    [],
  );

  const isSubmitting = resetPasswordMutation.isPending;

  if (!token && !tokenError) {
    return (
      <ResetPasswordPageLayout title="Loading..." subtitle="Validating reset token">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
        </div>
      </ResetPasswordPageLayout>
    );
  }

  if (resetPasswordMutation.isSuccess) {
    return (
      <ResetPasswordPageLayout title="Password Reset" subtitle="Your password has been updated">
        <div className="space-y-4 text-center">
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 backdrop-blur-sm">
            <CheckCircle className="mx-auto mb-2 h-8 w-8 text-blue-400" />
            <p className="text-sm font-medium text-blue-400">
              Password has been reset successfully!
            </p>
          </div>

          <p className="text-sm text-text-secondary dark:text-text-dark-secondary">
            You can now log in with your new password.
          </p>

          <div className="space-y-3 pt-4">
            <Button
              onClick={() => navigate('/login')}
              variant="unstyled"
              className="group relative flex w-full transform items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-blue-700 hover:to-blue-800 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-surface-secondary active:scale-[0.98] dark:focus:ring-offset-black"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </ResetPasswordPageLayout>
    );
  }

  const title = 'Reset Password';
  const subtitle = 'Enter your new password';

  return (
    <ResetPasswordPageLayout title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {(tokenError || resetPasswordMutation.error) && (
          <div className="animate-fadeIn rounded-xl border border-error-500/20 bg-error-500/10 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-error-400">
              {tokenError || resetPasswordMutation.error?.message}
            </p>
            {(tokenError?.includes('token') ||
              resetPasswordMutation.error?.message?.includes('token')) && (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-error-300 hover:text-error-200"
                  onClick={() => navigate('/forgot-password')}
                >
                  Request a new reset link
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {fieldConfigs.map(({ name, label, placeholder }) => (
            <div key={name} className="space-y-2">
              <Label className="text-sm text-text-secondary dark:text-text-dark-secondary">
                <Lock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {label}
              </Label>
              <div className="relative">
                <Input
                  type={visibleFields[name] ? 'text' : 'password'}
                  value={values[name]}
                  onChange={(e) => handleChange(name, e.target.value)}
                  placeholder={placeholder}
                  autoComplete="new-password"
                  hasError={Boolean(errors?.[name])}
                  className="pr-10"
                />
                <Button
                  type="button"
                  onClick={() => toggleFieldVisibility(name)}
                  variant="ghost"
                  size="icon"
                  className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 text-text-tertiary hover:text-text-secondary dark:hover:text-text-dark-secondary"
                >
                  {visibleFields[name] ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <FieldMessage variant="error">{errors?.[name]}</FieldMessage>
            </div>
          ))}
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          className="mt-6 w-full transform shadow-lg hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
          isLoading={isSubmitting}
          loadingText="Resetting..."
          loadingIcon={<Loader2 className="h-4 w-4 animate-spin" />}
          disabled={!token || isSubmitting}
        >
          <span
            className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden="true"
          />
          <Lock className="h-4 w-4" />
          <span>Reset Password</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </form>

      <div className="pt-4 text-center">
        <Button
          type="button"
          variant="link"
          className="flex items-center justify-center gap-1 text-sm"
          onClick={() => navigate('/login')}
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Sign in
        </Button>
      </div>
    </ResetPasswordPageLayout>
  );
}

import { memo, type ReactNode, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, Mail, User, Lock, Zap, type LucideIcon } from 'lucide-react';
import { Layout } from '@/components/layout';
import { Button, FieldMessage, Input, Label } from '@/components/ui';
import { useSignupMutation } from '@/hooks/queries';
import { isValidEmail, isValidUsername, isValidPassword } from '@/utils/validation';
import { useAuthStore } from '@/store';
import { authService } from '@/services/authService';

interface SignupFormData {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

type SignupFormErrors = Partial<Record<keyof SignupFormData, string>>;

interface SignupPageLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

const SignupPageLayout = memo(function SignupPageLayout({
  title,
  subtitle,
  children,
}: SignupPageLayoutProps) {
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

const validateForm = (values: SignupFormData): SignupFormErrors | null => {
  const errors: SignupFormErrors = {};

  if (!values.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(values.email)) {
    errors.email = 'Invalid email address';
  }

  if (!values.username) {
    errors.username = 'Username is required';
  } else if (!isValidUsername(values.username)) {
    errors.username =
      'Username must be 3-30 characters, contain only letters, numbers, and underscores, and cannot start or end with underscore';
  }

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (!isValidPassword(values.password)) {
    errors.password = 'Password must be at least 8 characters';
  }

  if (!values.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (values.confirmPassword !== values.password) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return Object.keys(errors).length ? errors : null;
};

export function SignupPage() {
  const navigate = useNavigate();
  const setAuthenticated = useAuthStore((state) => state.setAuthenticated);
  const [values, setValues] = useState<SignupFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<SignupFormErrors | null>(null);

  const signupMutation = useSignupMutation({
    onSuccess: (user) => {
      const needsVerification = user.email_verification_required && !user.is_verified;
      if (!needsVerification && authService.isAuthenticated()) {
        setAuthenticated(true);
        navigate('/');
      } else {
        navigate(`/verify-email?email=${encodeURIComponent(user.email)}`);
      }
    },
  });

  const handleChange = useCallback((name: keyof SignupFormData, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev?.[name]) {
        return prev;
      }

      const rest = { ...prev };
      delete rest[name];
      return Object.keys(rest).length ? rest : null;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const validationErrors = validateForm(values);
      if (validationErrors) {
        setErrors(validationErrors);
        return;
      }

      setErrors(null);
      const attemptValues = { ...values };
      const signupData: Omit<SignupFormData, 'confirmPassword'> = {
        email: attemptValues.email,
        username: attemptValues.username,
        password: attemptValues.password,
      };
      signupMutation.mutate(signupData);
    },
    [signupMutation, values],
  );

  const title = 'Join Claudex';
  const subtitle = 'Create your claudex account';

  const isSubmitting = signupMutation.isPending;
  const error = signupMutation.error?.message;

  const fieldConfigs = useMemo<
    Array<{
      name: keyof SignupFormData;
      label: string;
      placeholder: string;
      type: 'email' | 'text' | 'password';
      icon: LucideIcon;
      helperText?: string;
    }>
  >(
    () => [
      {
        name: 'email',
        label: 'Email address',
        placeholder: 'name@example.com',
        type: 'email',
        icon: Mail,
      },
      {
        name: 'username',
        label: 'Username',
        placeholder: 'your_username',
        type: 'text',
        icon: User,
        helperText:
          '3-30 characters. Letters, numbers, and underscores only. Cannot start or end with an underscore.',
      },
      {
        name: 'password',
        label: 'Password',
        placeholder: 'Enter your password',
        type: 'password',
        icon: Lock,
      },
      {
        name: 'confirmPassword',
        label: 'Confirm Password',
        placeholder: 'Confirm your password',
        type: 'password',
        icon: Lock,
      },
    ],
    [],
  );

  return (
    <SignupPageLayout title={title} subtitle={subtitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="animate-fadeIn rounded-xl border border-error-500/20 bg-error-500/10 p-4 backdrop-blur-sm">
            <p className="text-sm font-medium text-error-400">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {fieldConfigs.map(({ name, label, placeholder, type, icon: Icon, helperText }) => (
            <div key={name} className="space-y-2">
              <Label className="text-sm text-text-secondary dark:text-text-dark-secondary">
                <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {label}
              </Label>
              <Input
                type={type}
                value={values[name]}
                onChange={(e) => handleChange(name, e.target.value)}
                placeholder={placeholder}
                autoComplete={
                  name === 'email'
                    ? 'email'
                    : name === 'username'
                      ? 'username'
                      : name === 'password'
                        ? 'new-password'
                        : 'new-password'
                }
                hasError={Boolean(errors?.[name])}
              />
              <FieldMessage>{helperText}</FieldMessage>
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
          loadingText="Creating account..."
          loadingIcon={<Loader2 className="h-4 w-4 animate-spin" />}
        >
          <span
            className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden="true"
          />
          <Zap className="h-4 w-4 transition-transform duration-200 group-hover:rotate-12" />
          <span>Get Started</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
        </Button>
      </form>

      <div className="pt-4 text-center">
        <Button type="button" variant="link" className="text-sm" onClick={() => navigate('/login')}>
          Already have an account? Sign in
        </Button>
      </div>
    </SignupPageLayout>
  );
}

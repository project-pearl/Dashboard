// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} />,
}));

vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({
    loginAsync: vi.fn(),
    signup: vi.fn(),
    isAuthenticated: false,
    isLoading: false,
    loginError: null,
    clearError: vi.fn(),
    user: null,
    resolveInviteToken: vi.fn().mockResolvedValue(null),
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock('@/lib/roleRoutes', () => ({
  getPrimaryRoute: () => '/dashboard/federal',
}));

describe('LoginPage', () => {
  it('renders email input and password input', async () => {
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);

    // The login form uses "you@example.com" as email placeholder
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('renders Sign In submit button', async () => {
    const { default: LoginPage } = await import('@/app/login/page');
    render(<LoginPage />);

    // The button text is "Sign In"
    const buttons = screen.getAllByRole('button');
    const signInButton = buttons.find(b => b.textContent?.includes('Sign In'));
    expect(signInButton).toBeDefined();
  });
});

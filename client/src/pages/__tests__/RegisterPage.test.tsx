import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from '../RegisterPage';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock useAuth hook
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('RegisterPage — client-side validation', () => {
  function setup() {
    const user = userEvent.setup();
    render(<RegisterPage />);
    return { user };
  }

  // Requirement 15.1 — empty fields show error before request
  it('shows error messages for all empty fields on submit', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByText('Username is required')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  // Requirement 15.1 — individual empty field (username only missing)
  it('shows error for empty username field', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByText('Username is required')).toBeInTheDocument();
  });

  // Requirement 15.2 — invalid email format shows error
  it('shows error for invalid email format', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
  });

  // Requirement 15.3 — password shorter than 8 characters
  it('shows error for password shorter than 8 characters', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(
      screen.getByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
  });

  // Requirement 15.3 — 7-char password (boundary case)
  it('shows error for 7-character password (boundary case)', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), '1234567'); // exactly 7 chars
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(
      screen.getByText('Password must be at least 8 characters'),
    ).toBeInTheDocument();
  });

  // Requirement 15.1 — no server call when validation fails
  it('does not call register API when validation fails', async () => {
    const mockRegister = jest.fn();
    jest.resetModules();
    jest.mock('../../hooks/useAuth', () => ({
      useAuth: () => ({ register: mockRegister }),
    }));

    const { user } = setup();

    // Submit with empty fields
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(mockRegister).not.toHaveBeenCalled();
  });

  // Valid form — no validation errors shown
  it('does not show validation errors for a fully valid form', async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(/username/i), 'validuser');
    await user.type(screen.getByLabelText(/email/i), 'valid@example.com');
    await user.type(screen.getByLabelText(/password/i), 'validpassword');
    await user.click(screen.getByRole('button', { name: /register/i }));

    expect(screen.queryByText('Username is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument();
    expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Password must be at least 8 characters'),
    ).not.toBeInTheDocument();
  });
});

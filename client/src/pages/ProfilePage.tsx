import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as userApi from '../api/user.api';
import { User } from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditFields {
  username: string;
  email: string;
}

interface FieldErrors {
  username?: string;
  email?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEditForm(fields: EditFields): FieldErrors {
  const errors: FieldErrors = {};

  if (!fields.username.trim()) {
    errors.username = 'Username is required';
  }
  if (!fields.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = 'Invalid email format';
  }

  return errors;
}

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authUser) {
      navigate('/login', { replace: true });
    }
  }, [authUser, navigate]);

  // Full profile loaded from API (includes email + createdAt)
  const [profile, setProfile] = useState<User | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit form state
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<EditFields>({ username: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load profile on mount
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    userApi
      .getProfile()
      .then((data) => {
        if (!cancelled) {
          setProfile(data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load profile';
          if (message.includes('401') || message.includes('UNAUTHORIZED') || message.includes('SESSION_EXPIRED')) {
            logout();
          } else {
            setLoadError(message);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, logout]);

  // Populate edit fields when entering edit mode
  function handleEditClick() {
    if (!profile) return;
    setEditFields({ username: profile.username, email: profile.email });
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFieldErrors({});
    setFormError(null);
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setEditFields((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    setFormError(null);
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side validation before any network call (Requirement 15.1, 15.2)
    const errors = validateEditForm(editFields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const updated = await userApi.updateProfile({
        username: editFields.username.trim(),
        email: editFields.email.trim(),
      });
      setProfile(updated);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Update failed';

      // Map backend error codes to field-level errors (Requirement 15.4)
      if (message.includes('Username is already taken') || message.includes('USERNAME_TAKEN')) {
        setFieldErrors({ username: 'Username is already taken' });
      } else if (message.includes('Email is already in use') || message.includes('EMAIL_TAKEN')) {
        setFieldErrors({ email: 'Email is already in use' });
      } else if (message.includes('Invalid email format')) {
        setFieldErrors({ email: 'Invalid email format' });
      } else if (
        message.includes('SESSION_EXPIRED') ||
        message.includes('UNAUTHORIZED')
      ) {
        logout();
      } else {
        setFormError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render states ──────────────────────────────────────────────────────────

  if (!authUser) return null; // Redirect in progress

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.loadingText}>Loading profile…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.formError} role="alert">
            {loadError}
          </div>
          <button style={styles.buttonSecondary} onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  // ─── View Mode ──────────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>My Profile</h1>

        {successMessage && (
          <div style={styles.successBanner} role="status">
            {successMessage}
          </div>
        )}

        {!isEditing ? (
          /* ── Read-only view (Requirement 3.1) ─────────────────────────────── */
          <>
            <dl style={styles.dataList}>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Username</dt>
                <dd style={styles.dataValue}>{profile.username}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Email</dt>
                <dd style={styles.dataValue}>{profile.email}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Member since</dt>
                <dd style={styles.dataValue}>{formatDate(profile.createdAt)}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Role</dt>
                <dd style={{ ...styles.dataValue, textTransform: 'capitalize' }}>
                  {profile.role}
                </dd>
              </div>
            </dl>

            <button style={styles.button} onClick={handleEditClick}>
              Edit profile
            </button>
          </>
        ) : (
          /* ── Edit form (Requirements 3.2, 15.1, 15.2) ─────────────────────── */
          <form onSubmit={handleEditSubmit} noValidate>
            {formError && (
              <div style={styles.formError} role="alert">
                {formError}
              </div>
            )}

            {/* Username */}
            <div style={styles.field}>
              <label htmlFor="username" style={styles.label}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={editFields.username}
                onChange={handleEditChange}
                style={{
                  ...styles.input,
                  ...(fieldErrors.username ? styles.inputError : {}),
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.username && (
                <span style={styles.fieldError} role="alert">
                  {fieldErrors.username}
                </span>
              )}
            </div>

            {/* Email */}
            <div style={styles.field}>
              <label htmlFor="email" style={styles.label}>
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={editFields.email}
                onChange={handleEditChange}
                style={{
                  ...styles.input,
                  ...(fieldErrors.email ? styles.inputError : {}),
                }}
                disabled={isSubmitting}
              />
              {fieldErrors.email && (
                <span style={styles.fieldError} role="alert">
                  {fieldErrors.email}
                </span>
              )}
            </div>

            <div style={styles.actions}>
              <button type="submit" style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={handleCancelEdit}
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    padding: '3rem 1rem',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    padding: '2rem',
    width: '100%',
    maxWidth: '480px',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.5rem',
    fontWeight: 600,
  },
  loadingText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '4px',
    color: '#16a34a',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    padding: '0.75rem',
  },
  formError: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '4px',
    color: '#dc2626',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.75rem',
  },
  dataList: {
    margin: '0 0 1.5rem',
    padding: 0,
    listStyle: 'none',
  },
  dataRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f3f4f6',
    padding: '0.75rem 0',
  },
  dataLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: 500,
    margin: 0,
  },
  dataValue: {
    fontSize: '0.95rem',
    color: '#111827',
    margin: 0,
    fontWeight: 400,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
  },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '1rem',
    padding: '0.5rem 0.75rem',
    outline: 'none',
  },
  inputError: {
    borderColor: '#dc2626',
  },
  fieldError: {
    color: '#dc2626',
    fontSize: '0.8rem',
    marginTop: '0.25rem',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.5rem',
  },
  button: {
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
    padding: '0.6rem 1.25rem',
    flex: 1,
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 500,
    padding: '0.6rem 1.25rem',
    flex: 1,
  },
};

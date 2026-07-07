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
    errors.username = 'El nombre de usuario es requerido';
  }
  if (!fields.email.trim()) {
    errors.email = 'El correo electrónico es requerido';
  } else if (!EMAIL_RE.test(fields.email.trim())) {
    errors.email = 'Formato de correo inválido';
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
          const message = err instanceof Error ? err.message : 'Error al cargar el perfil';
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
      const message = err instanceof Error ? err.message : 'Error al actualizar';

      if (message.includes('Username is already taken') || message.includes('USERNAME_TAKEN')) {
        setFieldErrors({ username: 'Ese nombre de usuario ya está en uso' });
      } else if (message.includes('Email is already in use') || message.includes('EMAIL_TAKEN')) {
        setFieldErrors({ email: 'Ese correo ya está en uso' });
      } else if (message.includes('Invalid email format')) {
        setFieldErrors({ email: 'Formato de correo inválido' });
      } else if (message.includes('SESSION_EXPIRED') || message.includes('UNAUTHORIZED')) {
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
          <p style={styles.loadingText}>Cargando perfil…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.formError} role="alert">{loadError}</div>
          <button style={styles.buttonSecondary} onClick={() => window.location.reload()}>
            Reintentar
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
        <h1 style={styles.title}>👤 Mi Perfil</h1>

        {successMessage && (
          <div style={styles.successBanner} role="status">
            ✓ {successMessage}
          </div>
        )}

        {!isEditing ? (
          <>
            <dl style={styles.dataList}>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Nombre de usuario</dt>
                <dd style={styles.dataValue}>{profile.username}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Correo electrónico</dt>
                <dd style={styles.dataValue}>{profile.email}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Miembro desde</dt>
                <dd style={styles.dataValue}>{formatDate(profile.createdAt)}</dd>
              </div>
              <div style={styles.dataRow}>
                <dt style={styles.dataLabel}>Rol</dt>
                <dd style={{ ...styles.dataValue, textTransform: 'capitalize' }}>
                  {profile.role === 'admin' ? '⚙️ Administrador' : '🎓 Estudiante'}
                </dd>
              </div>
            </dl>

            <button style={styles.button} onClick={handleEditClick}>
              ✏️ Editar perfil
            </button>
          </>
        ) : (
          <form onSubmit={handleEditSubmit} noValidate>
            {formError && (
              <div style={styles.formError} role="alert">
                {formError}
              </div>
            )}

            <div style={styles.field}>
              <label htmlFor="username" style={styles.label}>Nombre de usuario</label>
              <input id="username" name="username" type="text" autoComplete="username"
                value={editFields.username} onChange={handleEditChange}
                style={{ ...styles.input, ...(fieldErrors.username ? styles.inputError : {}) }}
                disabled={isSubmitting} />
              {fieldErrors.username && <span style={styles.fieldError} role="alert">{fieldErrors.username}</span>}
            </div>

            <div style={styles.field}>
              <label htmlFor="email" style={styles.label}>Correo electrónico</label>
              <input id="email" name="email" type="email" autoComplete="email"
                value={editFields.email} onChange={handleEditChange}
                style={{ ...styles.input, ...(fieldErrors.email ? styles.inputError : {}) }}
                disabled={isSubmitting} />
              {fieldErrors.email && <span style={styles.fieldError} role="alert">{fieldErrors.email}</span>}
            </div>

            <div style={styles.actions}>
              <button type="submit" style={styles.button} disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : '💾 Guardar cambios'}
              </button>
              <button type="button" style={styles.buttonSecondary} onClick={handleCancelEdit} disabled={isSubmitting}>
                Cancelar
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
    backgroundColor: '#f8faff',
    padding: '3rem 1rem',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(99,102,241,0.1)',
    border: '1px solid #e0e7ff',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '480px',
  },
  title: {
    margin: '0 0 1.75rem',
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#1e1b4b',
  },
  loadingText: {
    color: '#9ca3af',
    textAlign: 'center',
  },
  successBanner: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '6px',
    color: '#15803d',
    fontSize: '0.875rem',
    marginBottom: '1.25rem',
    padding: '0.75rem 1rem',
    fontWeight: 500,
  },
  formError: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '0.875rem',
    marginBottom: '1rem',
    padding: '0.75rem 1rem',
  },
  dataList: {
    margin: '0 0 1.75rem',
    padding: 0,
    listStyle: 'none',
  },
  dataRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #f3f4f6',
    padding: '0.85rem 0',
  },
  dataLabel: {
    fontSize: '0.875rem',
    color: '#6b7280',
    fontWeight: 600,
    margin: 0,
  },
  dataValue: {
    fontSize: '0.95rem',
    color: '#1e1b4b',
    margin: 0,
    fontWeight: 500,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '0.35rem',
    color: '#374151',
  },
  input: {
    backgroundColor: '#f9fafb',
    border: '1.5px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.95rem',
    padding: '0.6rem 0.85rem',
    outline: 'none',
    color: '#111827',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  fieldError: {
    color: '#ef4444',
    fontSize: '0.8rem',
    marginTop: '0.3rem',
  },
  actions: {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  button: {
    background: 'linear-gradient(90deg, #4f46e5, #7c3aed)',
    border: 'none',
    borderRadius: '6px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 700,
    padding: '0.65rem 1.25rem',
    flex: 1,
    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    border: '1.5px solid #d1d5db',
    borderRadius: '6px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
    padding: '0.65rem 1.25rem',
    flex: 1,
  },
};

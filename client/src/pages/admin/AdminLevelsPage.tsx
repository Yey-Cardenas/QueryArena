import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import * as adminApi from '../../api/admin.api';
import { Level } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'edit';

interface ModalState {
  mode: ModalMode;
  level?: Level; // present when mode === 'edit'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminLevelsPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated (Requirement 4.6)
  useEffect(() => {
    if (!authUser) {
      navigate('/login', { replace: true });
    }
  }, [authUser, navigate]);

  // ─── State ────────────────────────────────────────────────────────────────

  const [levels, setLevels] = useState<Level[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-row delete errors: keyed by level id
  const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({});

  // Modal state
  const [modal, setModal] = useState<ModalState | null>(null);
  const [nameValue, setNameValue] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load levels on mount ─────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    adminApi
      .listLevels()
      .then((data) => {
        if (!cancelled) setLevels(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load levels';
          setLoadError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  // ─── Modal helpers ────────────────────────────────────────────────────────

  function openCreateModal() {
    setModal({ mode: 'create' });
    setNameValue('');
    setNameError(null);
    setFormError(null);
  }

  function openEditModal(level: Level) {
    setModal({ mode: 'edit', level });
    setNameValue(level.name);
    setNameError(null);
    setFormError(null);
  }

  function closeModal() {
    setModal(null);
    setNameValue('');
    setNameError(null);
    setFormError(null);
  }

  // ─── Validation ───────────────────────────────────────────────────────────

  function validateName(value: string, currentId?: number): string | null {
    const trimmed = value.trim();
    if (!trimmed) return 'Name is required';

    const duplicate = levels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== currentId,
    );
    if (duplicate) return 'A level with this name already exists';

    return null;
  }

  // ─── Submit handler ───────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!modal) return;

    const error = validateName(nameValue, modal.level?.id);
    if (error) {
      setNameError(error);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setNameError(null);

    try {
      if (modal.mode === 'create') {
        const created = await adminApi.createLevel({ name: nameValue.trim() });
        setLevels((prev) => [...prev, created]);
      } else if (modal.mode === 'edit' && modal.level) {
        const updated = await adminApi.updateLevel(modal.level.id, { name: nameValue.trim() });
        setLevels((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      }
      closeModal();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Operation failed';
      setFormError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Delete handler ───────────────────────────────────────────────────────

  async function handleDelete(level: Level) {
    // Clear any prior error for this row
    setDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[level.id];
      return next;
    });

    try {
      await adminApi.deleteLevel(level.id);
      setLevels((prev) => prev.filter((l) => l.id !== level.id));
    } catch (err: unknown) {
      let message = 'Failed to delete level';
      if (err instanceof Error) {
        if (
          err.message.includes('HAS_ASSOCIATED_EXERCISES') ||
          err.message.includes('409') ||
          err.message.includes('associated')
        ) {
          message = 'Cannot delete: level has associated exercises';
        } else {
          message = err.message;
        }
      }
      setDeleteErrors((prev) => ({ ...prev, [level.id]: message }));
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!authUser) return null; // Redirect in progress

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Difficulty Levels</h1>
          <button type="button" style={styles.primaryButton} onClick={openCreateModal}>
            + Create level
          </button>
        </div>

        {/* Load state */}
        {isLoading ? (
          <p style={styles.statusText}>Loading levels…</p>
        ) : loadError ? (
          <div style={styles.errorBanner} role="alert">
            {loadError}
          </div>
        ) : levels.length === 0 ? (
          <p style={styles.statusText}>No levels found. Create one to get started.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Difficulty levels">
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Created At</th>
                  <th style={{ ...styles.th, ...styles.thActions }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <>
                    <tr key={level.id} style={styles.tr}>
                      <td style={styles.td}>{level.id}</td>
                      <td style={styles.td}>{level.name}</td>
                      <td style={styles.td}>{formatDate(level.createdAt)}</td>
                      <td style={{ ...styles.td, ...styles.tdActions }}>
                        <button
                          type="button"
                          style={styles.editButton}
                          onClick={() => openEditModal(level)}
                          aria-label={`Edit level ${level.name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.deleteButton}
                          onClick={() => handleDelete(level)}
                          aria-label={`Delete level ${level.name}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {deleteErrors[level.id] && (
                      <tr key={`${level.id}-error`}>
                        <td colSpan={4} style={styles.rowError} role="alert">
                          {deleteErrors[level.id]}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div
          style={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={modal.mode === 'create' ? 'Create level' : 'Edit level'}
          onClick={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {modal.mode === 'create' ? 'Create level' : 'Edit level'}
            </h2>

            {formError && (
              <div style={styles.formError} role="alert">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.field}>
                <label htmlFor="level-name" style={styles.label}>
                  Name
                </label>
                <input
                  id="level-name"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={nameValue}
                  onChange={(e) => {
                    setNameValue(e.target.value);
                    setNameError(null);
                    setFormError(null);
                  }}
                  style={{
                    ...styles.input,
                    ...(nameError ? styles.inputError : {}),
                  }}
                  disabled={isSubmitting}
                  aria-describedby={nameError ? 'level-name-error' : undefined}
                />
                {nameError && (
                  <span id="level-name-error" style={styles.fieldError}>
                    {nameError}
                  </span>
                )}
              </div>

              <div style={styles.modalActions}>
                <button
                  type="button"
                  style={styles.cancelButton}
                  onClick={closeModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting
                    ? modal.mode === 'create'
                      ? 'Creating…'
                      : 'Saving…'
                    : modal.mode === 'create'
                      ? 'Create'
                      : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    padding: '3rem 1rem',
  },
  inner: {
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  title: {
    margin: 0,
    fontSize: '1.75rem',
    fontWeight: 600,
    color: '#111827',
  },
  statusText: {
    color: '#6b7280',
    textAlign: 'center',
    padding: '2rem 0',
  },
  errorBanner: {
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '0.9rem',
    padding: '0.75rem 1rem',
  },
  tableWrapper: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
  },
  th: {
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.05em',
    padding: '0.75rem 1rem',
    textAlign: 'left',
    textTransform: 'uppercase',
  },
  thActions: {
    textAlign: 'right',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    color: '#111827',
    fontSize: '0.95rem',
    padding: '0.85rem 1rem',
    verticalAlign: 'middle',
  },
  tdActions: {
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
  },
  rowError: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '0.85rem',
    padding: '0.5rem 1rem',
    textAlign: 'right',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: 500,
    padding: '0.5rem 1rem',
  },
  editButton: {
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.3rem 0.75rem',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.3rem 0.75rem',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.9rem',
    padding: '0.5rem 1rem',
  },
  // Modal
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'fixed',
    right: 0,
    top: 0,
    zIndex: 50,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
    padding: '2rem',
    width: '100%',
    maxWidth: '400px',
  },
  modalTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    margin: '0 0 1.25rem',
    color: '#111827',
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
  field: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '1.25rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
    color: '#374151',
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
  modalActions: {
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'flex-end',
  },
};

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import * as adminApi from '../../api/admin.api';
import { Category } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalState {
  open: boolean;
  mode: 'create' | 'edit';
  category: Category | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // ─── Auth guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) {
      navigate('/login', { replace: true });
    }
  }, [authUser, navigate]);

  // ─── State ────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-row delete errors: keyed by category id
  const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({});

  // Modal state
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', category: null });
  const [nameInput, setNameInput] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load categories ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    adminApi
      .listCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load categories');
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
    setModal({ open: true, mode: 'create', category: null });
    setNameInput('');
    setNameError(null);
    setSubmitError(null);
  }

  function openEditModal(category: Category) {
    setModal({ open: true, mode: 'edit', category });
    setNameInput(category.name);
    setNameError(null);
    setSubmitError(null);
  }

  function closeModal() {
    setModal({ open: false, mode: 'create', category: null });
    setNameInput('');
    setNameError(null);
    setSubmitError(null);
  }

  // ─── Form submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setNameError(null);
    setSubmitError(null);

    try {
      if (modal.mode === 'create') {
        const created = await adminApi.createCategory({ name: trimmed });
        setCategories((prev) => [...prev, created]);
      } else if (modal.mode === 'edit' && modal.category) {
        const updated = await adminApi.updateCategory(modal.category.id, { name: trimmed });
        setCategories((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      }
      closeModal();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(category: Category) {
    // Clear any previous error for this row
    setDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[category.id];
      return next;
    });

    try {
      await adminApi.deleteCategory(category.id);
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const isAssociated =
        message.includes('HAS_ASSOCIATED_EXERCISES') || message.includes('409');
      setDeleteErrors((prev) => ({
        ...prev,
        [category.id]: isAssociated
          ? 'Cannot delete: category has associated exercises'
          : message || 'Failed to delete category',
      }));
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!authUser) return null;

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Categories</h1>
          <button type="button" style={styles.primaryButton} onClick={openCreateModal}>
            Create category
          </button>
        </div>

        {/* Load error */}
        {loadError && (
          <div style={styles.errorBanner} role="alert">
            {loadError}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <p style={styles.statusText}>Loading categories…</p>
        ) : categories.length === 0 && !loadError ? (
          <p style={styles.statusText}>No categories found. Create one to get started.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Categories table">
              <thead>
                <tr>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Name</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <>
                    <tr key={cat.id} style={styles.tr}>
                      <td style={styles.td}>{cat.id}</td>
                      <td style={styles.td}>{cat.name}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <button
                          type="button"
                          style={styles.editButton}
                          onClick={() => openEditModal(cat)}
                          aria-label={`Edit category ${cat.name}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.deleteButton}
                          onClick={() => handleDelete(cat)}
                          aria-label={`Delete category ${cat.name}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {deleteErrors[cat.id] && (
                      <tr key={`${cat.id}-err`}>
                        <td colSpan={3} style={styles.rowError} role="alert">
                          {deleteErrors[cat.id]}
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
      {modal.open && (
        <div
          style={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label={modal.mode === 'create' ? 'Create category' : 'Edit category'}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {modal.mode === 'create' ? 'Create category' : 'Edit category'}
            </h2>

            {submitError && (
              <div style={styles.formError} role="alert">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.field}>
                <label htmlFor="category-name" style={styles.label}>
                  Name
                </label>
                <input
                  id="category-name"
                  type="text"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  style={{
                    ...styles.input,
                    ...(nameError ? styles.inputError : {}),
                  }}
                  disabled={isSubmitting}
                  autoFocus
                />
                {nameError && (
                  <span style={styles.fieldError} role="alert">
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
    marginBottom: '1rem',
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
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    color: '#111827',
    fontSize: '0.9rem',
    padding: '0.75rem 1rem',
    verticalAlign: 'middle',
  },
  rowError: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    fontSize: '0.8rem',
    padding: '0.4rem 1rem 0.6rem',
    borderBottom: '1px solid #f3f4f6',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '4px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 500,
    padding: '0.5rem 1rem',
  },
  editButton: {
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginRight: '0.5rem',
    padding: '0.3rem 0.75rem',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.8rem',
    padding: '0.3rem 0.75rem',
  },
  // ── Modal
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
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
  },
  modalTitle: {
    margin: '0 0 1.25rem',
    fontSize: '1.25rem',
    fontWeight: 600,
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
    marginBottom: '1rem',
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
    outline: 'none',
    padding: '0.5rem 0.75rem',
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
    marginTop: '1.5rem',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    color: '#374151',
    cursor: 'pointer',
    fontSize: '0.875rem',
    padding: '0.5rem 1rem',
  },
};

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import * as adminApi from '../../api/admin.api';
import type { CreateExercisePayload, UpdateExercisePayload } from '../../api/admin.api';
import { ExerciseDetail, Level, Category } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type ModalMode = 'create' | 'edit';

interface ModalState {
  open: boolean;
  mode: ModalMode;
  exercise: ExerciseDetail | null;
}

interface FormFields {
  title: string;
  description: string;
  expectedSolution: string;
  score: string;
  levelId: string;
  categoryId: string;
  isActive: boolean;
}

interface FormErrors {
  title?: string;
  description?: string;
  expectedSolution?: string;
  score?: string;
  levelId?: string;
  categoryId?: string;
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

const emptyForm: FormFields = {
  title: '',
  description: '',
  expectedSolution: '',
  score: '10',
  levelId: '',
  categoryId: '',
  isActive: true,
};

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm(fields: FormFields): FormErrors {
  const errors: FormErrors = {};

  if (!fields.title.trim()) {
    errors.title = 'Title is required';
  }
  if (!fields.description.trim()) {
    errors.description = 'Description is required';
  }
  if (!fields.expectedSolution.trim()) {
    errors.expectedSolution = 'Expected solution is required';
  }
  const scoreNum = Number(fields.score);
  if (!fields.score.trim() || isNaN(scoreNum) || scoreNum <= 0 || !Number.isInteger(scoreNum)) {
    errors.score = 'Score must be a positive integer';
  }
  if (!fields.levelId) {
    errors.levelId = 'Level is required';
  }
  if (!fields.categoryId) {
    errors.categoryId = 'Category is required';
  }

  return errors;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminExercisesPage() {
  const { user: authUser } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authUser) {
      navigate('/login', { replace: true });
    }
  }, [authUser, navigate]);

  // ─── State ────────────────────────────────────────────────────────────────

  const [exercises, setExercises] = useState<ExerciseDetail[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-row delete errors keyed by exercise id
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  // Modal
  const [modal, setModal] = useState<ModalState>({ open: false, mode: 'create', exercise: null });
  const [fields, setFields] = useState<FormFields>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Load data on mount ───────────────────────────────────────────────────

  useEffect(() => {
    if (!authUser) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    Promise.all([
      adminApi.listExercisesAdmin(),
      adminApi.listLevels(),
      adminApi.listCategories(),
    ])
      .then(([exs, lvls, cats]) => {
        if (!cancelled) {
          setExercises(exs);
          setLevels(lvls);
          setCategories(cats);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load exercises');
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
    setModal({ open: true, mode: 'create', exercise: null });
    setFields(emptyForm);
    setFieldErrors({});
    setSubmitError(null);
  }

  function openEditModal(exercise: ExerciseDetail) {
    setModal({ open: true, mode: 'edit', exercise });
    setFields({
      title: exercise.title,
      description: exercise.description,
      expectedSolution: exercise.expectedSolution ?? '',
      score: String(exercise.score),
      levelId: String(exercise.level.id),
      categoryId: String(exercise.category.id),
      isActive: exercise.isActive,
    });
    setFieldErrors({});
    setSubmitError(null);
  }

  function closeModal() {
    setModal({ open: false, mode: 'create', exercise: null });
    setFields(emptyForm);
    setFieldErrors({});
    setSubmitError(null);
  }

  // ─── Field change ─────────────────────────────────────────────────────────

  function handleFieldChange(key: keyof FormFields, value: string | boolean) {
    setFields((prev) => ({ ...prev, [key]: value }));
    // Clear the error for this field as the user edits
    if (key in fieldErrors) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key as keyof FormErrors];
        return next;
      });
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    const errors = validateForm(fields);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setSubmitError(null);

    try {
      if (modal.mode === 'create') {
        const payload: CreateExercisePayload = {
          title: fields.title.trim(),
          description: fields.description.trim(),
          expectedSolution: fields.expectedSolution.trim(),
          score: Number(fields.score),
          levelId: Number(fields.levelId),
          categoryId: Number(fields.categoryId),
        };
        await adminApi.createExercise(payload);
        // Reload the full list so level/category names are populated correctly
        const updated = await adminApi.listExercisesAdmin();
        setExercises(updated);
      } else if (modal.mode === 'edit' && modal.exercise) {
        const payload: UpdateExercisePayload = {
          title: fields.title.trim(),
          description: fields.description.trim(),
          expectedSolution: fields.expectedSolution.trim(),
          score: Number(fields.score),
          levelId: Number(fields.levelId),
          categoryId: Number(fields.categoryId),
          isActive: fields.isActive,
        };
        const updated = await adminApi.updateExercise(modal.exercise.id, payload);
        setExercises((prev) => prev.map((ex) => (ex.id === updated.id ? updated : ex)));
      }
      closeModal();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async function handleDelete(exercise: ExerciseDetail) {
    setDeleteErrors((prev) => {
      const next = { ...prev };
      delete next[exercise.id];
      return next;
    });

    try {
      await adminApi.deleteExercise(exercise.id);
      setExercises((prev) => prev.filter((ex) => ex.id !== exercise.id));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const hasAttempts =
        message.includes('HAS_ASSOCIATED_ATTEMPTS') || message.includes('409');
      setDeleteErrors((prev) => ({
        ...prev,
        [exercise.id]: hasAttempts
          ? 'Cannot delete: exercise has associated attempts'
          : message || 'Failed to delete exercise',
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
          <h1 style={styles.title}>Exercises</h1>
          <button type="button" style={styles.primaryButton} onClick={openCreateModal}>
            + Create exercise
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
          <p style={styles.statusText}>Loading exercises…</p>
        ) : exercises.length === 0 && !loadError ? (
          <p style={styles.statusText}>No exercises found. Create one to get started.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Exercises table">
              <thead>
                <tr>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Level</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>Score</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Created At</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {exercises.map((exercise) => (
                  <>
                    <tr key={exercise.id} style={styles.tr}>
                      <td style={styles.td}>{exercise.title}</td>
                      <td style={styles.td}>{exercise.level.name}</td>
                      <td style={styles.td}>{exercise.category.name}</td>
                      <td style={styles.td}>{exercise.score}</td>
                      <td style={styles.td}>
                        <span
                          style={
                            exercise.isActive ? styles.badgeActive : styles.badgeInactive
                          }
                        >
                          {exercise.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={styles.td}>{formatDate(exercise.createdAt)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          style={styles.editButton}
                          onClick={() => openEditModal(exercise)}
                          aria-label={`Edit exercise ${exercise.title}`}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          style={styles.deleteButton}
                          onClick={() => handleDelete(exercise)}
                          aria-label={`Delete exercise ${exercise.title}`}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    {deleteErrors[exercise.id] && (
                      <tr key={`${exercise.id}-err`}>
                        <td colSpan={7} style={styles.rowError} role="alert">
                          {deleteErrors[exercise.id]}
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
          aria-label={modal.mode === 'create' ? 'Create exercise' : 'Edit exercise'}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {modal.mode === 'create' ? 'Create exercise' : 'Edit exercise'}
            </h2>

            {submitError && (
              <div style={styles.formError} role="alert">
                {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Title */}
              <div style={styles.field}>
                <label htmlFor="ex-title" style={styles.label}>
                  Title <span style={styles.required}>*</span>
                </label>
                <input
                  id="ex-title"
                  type="text"
                  autoComplete="off"
                  autoFocus
                  value={fields.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  style={{ ...styles.input, ...(fieldErrors.title ? styles.inputError : {}) }}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.title ? 'ex-title-error' : undefined}
                />
                {fieldErrors.title && (
                  <span id="ex-title-error" style={styles.fieldError}>
                    {fieldErrors.title}
                  </span>
                )}
              </div>

              {/* Description */}
              <div style={styles.field}>
                <label htmlFor="ex-description" style={styles.label}>
                  Description / Statement <span style={styles.required}>*</span>
                </label>
                <textarea
                  id="ex-description"
                  rows={4}
                  value={fields.description}
                  onChange={(e) => handleFieldChange('description', e.target.value)}
                  style={{
                    ...styles.input,
                    resize: 'vertical',
                    ...(fieldErrors.description ? styles.inputError : {}),
                  }}
                  disabled={isSubmitting}
                  aria-describedby={fieldErrors.description ? 'ex-description-error' : undefined}
                />
                {fieldErrors.description && (
                  <span id="ex-description-error" style={styles.fieldError}>
                    {fieldErrors.description}
                  </span>
                )}
              </div>

              {/* Expected solution */}
              <div style={styles.field}>
                <label htmlFor="ex-solution" style={styles.label}>
                  Expected SQL Solution <span style={styles.required}>*</span>
                </label>
                <textarea
                  id="ex-solution"
                  rows={4}
                  value={fields.expectedSolution}
                  onChange={(e) => handleFieldChange('expectedSolution', e.target.value)}
                  style={{
                    ...styles.input,
                    fontFamily: 'monospace',
                    resize: 'vertical',
                    ...(fieldErrors.expectedSolution ? styles.inputError : {}),
                  }}
                  disabled={isSubmitting}
                  aria-describedby={
                    fieldErrors.expectedSolution ? 'ex-solution-error' : undefined
                  }
                />
                {fieldErrors.expectedSolution && (
                  <span id="ex-solution-error" style={styles.fieldError}>
                    {fieldErrors.expectedSolution}
                  </span>
                )}
              </div>

              {/* Score + Level + Category in a row */}
              <div style={styles.rowFields}>
                {/* Score */}
                <div style={{ ...styles.field, flex: '0 0 90px' }}>
                  <label htmlFor="ex-score" style={styles.label}>
                    Score <span style={styles.required}>*</span>
                  </label>
                  <input
                    id="ex-score"
                    type="number"
                    min={1}
                    step={1}
                    value={fields.score}
                    onChange={(e) => handleFieldChange('score', e.target.value)}
                    style={{ ...styles.input, ...(fieldErrors.score ? styles.inputError : {}) }}
                    disabled={isSubmitting}
                    aria-describedby={fieldErrors.score ? 'ex-score-error' : undefined}
                  />
                  {fieldErrors.score && (
                    <span id="ex-score-error" style={styles.fieldError}>
                      {fieldErrors.score}
                    </span>
                  )}
                </div>

                {/* Level */}
                <div style={{ ...styles.field, flex: 1 }}>
                  <label htmlFor="ex-level" style={styles.label}>
                    Level <span style={styles.required}>*</span>
                  </label>
                  <select
                    id="ex-level"
                    value={fields.levelId}
                    onChange={(e) => handleFieldChange('levelId', e.target.value)}
                    style={{ ...styles.input, ...(fieldErrors.levelId ? styles.inputError : {}) }}
                    disabled={isSubmitting}
                    aria-describedby={fieldErrors.levelId ? 'ex-level-error' : undefined}
                  >
                    <option value="">Select level</option>
                    {levels.map((l) => (
                      <option key={l.id} value={String(l.id)}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.levelId && (
                    <span id="ex-level-error" style={styles.fieldError}>
                      {fieldErrors.levelId}
                    </span>
                  )}
                </div>

                {/* Category */}
                <div style={{ ...styles.field, flex: 1 }}>
                  <label htmlFor="ex-category" style={styles.label}>
                    Category <span style={styles.required}>*</span>
                  </label>
                  <select
                    id="ex-category"
                    value={fields.categoryId}
                    onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                    style={{
                      ...styles.input,
                      ...(fieldErrors.categoryId ? styles.inputError : {}),
                    }}
                    disabled={isSubmitting}
                    aria-describedby={fieldErrors.categoryId ? 'ex-category-error' : undefined}
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.categoryId && (
                    <span id="ex-category-error" style={styles.fieldError}>
                      {fieldErrors.categoryId}
                    </span>
                  )}
                </div>
              </div>

              {/* Active toggle (edit only) */}
              {modal.mode === 'edit' && (
                <div style={styles.checkboxField}>
                  <input
                    id="ex-active"
                    type="checkbox"
                    checked={fields.isActive}
                    onChange={(e) => handleFieldChange('isActive', e.target.checked)}
                    disabled={isSubmitting}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <label htmlFor="ex-active" style={styles.label}>
                    Active (visible to students)
                  </label>
                </div>
              )}

              {/* Actions */}
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
    maxWidth: '1100px',
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
    overflow: 'auto',
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    minWidth: '700px',
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
    whiteSpace: 'nowrap',
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
  badgeActive: {
    backgroundColor: '#d1fae5',
    borderRadius: '9999px',
    color: '#065f46',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.15rem 0.6rem',
  },
  badgeInactive: {
    backgroundColor: '#f3f4f6',
    borderRadius: '9999px',
    color: '#6b7280',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.15rem 0.6rem',
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
    alignItems: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    overflowY: 'auto',
    paddingBlock: '2rem',
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
    maxWidth: '640px',
    alignSelf: 'flex-start',
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
  rowFields: {
    display: 'flex',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  checkboxField: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    marginBottom: '0.25rem',
    color: '#374151',
  },
  required: {
    color: '#dc2626',
    marginLeft: '2px',
  },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: '4px',
    fontSize: '0.95rem',
    outline: 'none',
    padding: '0.5rem 0.75rem',
    width: '100%',
    boxSizing: 'border-box',
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

import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
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
      setNameError('El nombre es requerido');
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
      setSubmitError(err instanceof Error ? err.message : 'Error en la operación');
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
      const isAssociated = message.includes('HAS_ASSOCIATED_EXERCISES') || message.includes('409');
      setDeleteErrors((prev) => ({
        ...prev,
        [category.id]: isAssociated
          ? 'No se puede eliminar: la categoría tiene ejercicios asociados'
          : message || 'Error al eliminar la categoría',
      }));
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!authUser) return null;

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Encabezado */}
        <div style={styles.header}>
          <h1 style={styles.title}>🏷️ Categorías</h1>
          <button type="button" style={styles.primaryButton} onClick={openCreateModal}>
            + Crear categoría
          </button>
        </div>

        {loadError && <div style={styles.errorBanner} role="alert">{loadError}</div>}

        {isLoading ? (
          <p style={styles.statusText}>Cargando categorías…</p>
        ) : categories.length === 0 && !loadError ? (
          <p style={styles.statusText}>No hay categorías. Crea una para comenzar.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Tabla de categorías">
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <React.Fragment key={cat.id}>
                    <tr style={styles.tr}>
                      <td style={styles.td}>{cat.id}</td>
                      <td style={styles.td}>{cat.name}</td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <button type="button" style={styles.editButton} onClick={() => openEditModal(cat)}
                          aria-label={`Editar categoría ${cat.name}`}>Editar</button>
                        <button type="button" style={styles.deleteButton} onClick={() => handleDelete(cat)}
                          aria-label={`Eliminar categoría ${cat.name}`}>Eliminar</button>
                      </td>
                    </tr>
                    {deleteErrors[cat.id] && (
                      <tr>
                        <td colSpan={3} style={styles.rowError} role="alert">
                          {deleteErrors[cat.id]}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal.open && (
        <div style={styles.overlay} role="dialog" aria-modal="true"
          aria-label={modal.mode === 'create' ? 'Crear categoría' : 'Editar categoría'}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {modal.mode === 'create' ? '+ Crear categoría' : '✏️ Editar categoría'}
            </h2>
            {submitError && <div style={styles.formError} role="alert">{submitError}</div>}
            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.field}>
                <label htmlFor="category-name" style={styles.label}>Nombre</label>
                <input id="category-name" type="text" value={nameInput}
                  onChange={(e) => { setNameInput(e.target.value); if (nameError) setNameError(null); }}
                  style={{ ...styles.input, ...(nameError ? styles.inputError : {}) }}
                  disabled={isSubmitting} autoFocus />
                {nameError && <span style={styles.fieldError} role="alert">{nameError}</span>}
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelButton} onClick={closeModal} disabled={isSubmitting}>
                  Cancelar
                </button>
                <button type="submit" style={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting
                    ? (modal.mode === 'create' ? 'Creando…' : 'Guardando…')
                    : (modal.mode === 'create' ? 'Crear' : 'Guardar')}
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
  container:    { minHeight: '100vh', backgroundColor: '#f8faff', padding: '3rem 1rem' },
  inner:        { maxWidth: '800px', margin: '0 auto' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  title:        { margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b' },
  statusText:   { color: '#9ca3af', textAlign: 'center', padding: '2rem 0' },
  errorBanner:  { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.9rem', padding: '0.75rem 1rem', marginBottom: '1rem' },
  tableWrapper: { backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(99,102,241,0.07)' },
  table:        { borderCollapse: 'collapse', width: '100%' },
  thead:        { background: 'linear-gradient(90deg, #ede9fe, #e0e7ff)' },
  th:           { color: '#4f46e5', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.75rem 1rem', textAlign: 'left', textTransform: 'uppercase', borderBottom: '2px solid #e0e7ff' },
  tr:           { borderBottom: '1px solid #f3f4f6' },
  td:           { color: '#111827', fontSize: '0.9rem', padding: '0.75rem 1rem', verticalAlign: 'middle' },
  rowError:     { backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.8rem', padding: '0.4rem 1rem 0.6rem', borderBottom: '1px solid #f3f4f6' },
  primaryButton:{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, padding: '0.5rem 1rem', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' },
  editButton:   { backgroundColor: '#fff', border: '1.5px solid #c4b5fd', borderRadius: '4px', color: '#4f46e5', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, marginRight: '0.5rem', padding: '0.3rem 0.75rem' },
  deleteButton: { backgroundColor: '#fff', border: '1.5px solid #fca5a5', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.75rem' },
  overlay:      { alignItems: 'center', backgroundColor: 'rgba(30,27,75,0.5)', bottom: 0, display: 'flex', justifyContent: 'center', left: 0, position: 'fixed', right: 0, top: 0, zIndex: 1000 },
  modalCard:    { backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(99,102,241,0.2)', padding: '2rem', width: '100%', maxWidth: '420px', border: '1px solid #e0e7ff' },
  modalTitle:   { margin: '0 0 1.25rem', fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' },
  formError:    { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem' },
  field:        { display: 'flex', flexDirection: 'column', marginBottom: '1rem' },
  label:        { fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem', color: '#374151' },
  input:        { backgroundColor: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', outline: 'none', padding: '0.55rem 0.75rem', color: '#111827' },
  inputError:   { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  fieldError:   { color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' },
  modalActions: { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' },
  cancelButton: { backgroundColor: '#fff', border: '1.5px solid #d1d5db', borderRadius: '6px', color: '#374151', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1rem' },
};

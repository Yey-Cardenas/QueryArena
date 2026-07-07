import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
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
    if (!trimmed) return 'El nombre es requerido';
    const duplicate = levels.some(
      (l) => l.name.toLowerCase() === trimmed.toLowerCase() && l.id !== currentId,
    );
    if (duplicate) return 'Ya existe un nivel con ese nombre';
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
      const message = err instanceof Error ? err.message : 'Error en la operación';
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
      let message = 'Error al eliminar el nivel';
      if (err instanceof Error) {
        if (err.message.includes('HAS_ASSOCIATED_EXERCISES') || err.message.includes('409') || err.message.includes('associated')) {
          message = 'No se puede eliminar: el nivel tiene ejercicios asociados';
        } else { message = err.message; }
      }
      setDeleteErrors((prev) => ({ ...prev, [level.id]: message }));
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!authUser) return null; // Redirect in progress

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {/* Encabezado */}
        <div style={styles.header}>
          <h1 style={styles.title}>🎯 Niveles de Dificultad</h1>
          <button type="button" style={styles.primaryButton} onClick={openCreateModal}>
            + Crear nivel
          </button>
        </div>

        {isLoading ? (
          <p style={styles.statusText}>Cargando niveles…</p>
        ) : loadError ? (
          <div style={styles.errorBanner} role="alert">{loadError}</div>
        ) : levels.length === 0 ? (
          <p style={styles.statusText}>No hay niveles. Crea uno para comenzar.</p>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Niveles de dificultad">
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>ID</th>
                  <th style={styles.th}>Nombre</th>
                  <th style={styles.th}>Creado</th>
                  <th style={{ ...styles.th, ...styles.thActions }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((level) => (
                  <React.Fragment key={level.id}>
                    <tr style={styles.tr}>
                      <td style={styles.td}>{level.id}</td>
                      <td style={styles.td}>{level.name}</td>
                      <td style={styles.td}>{formatDate(level.createdAt)}</td>
                      <td style={{ ...styles.td, ...styles.tdActions }}>
                        <button type="button" style={styles.editButton} onClick={() => openEditModal(level)}
                          aria-label={`Editar nivel ${level.name}`}>Editar</button>
                        <button type="button" style={styles.deleteButton} onClick={() => handleDelete(level)}
                          aria-label={`Eliminar nivel ${level.name}`}>Eliminar</button>
                      </td>
                    </tr>
                    {deleteErrors[level.id] && (
                      <tr>
                        <td colSpan={4} style={styles.rowError} role="alert">
                          {deleteErrors[level.id]}
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
      {modal && (
        <div style={styles.overlay} role="dialog" aria-modal="true"
          aria-label={modal.mode === 'create' ? 'Crear nivel' : 'Editar nivel'}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={styles.modalCard}>
            <h2 style={styles.modalTitle}>
              {modal.mode === 'create' ? '+ Crear nivel' : '✏️ Editar nivel'}
            </h2>
            {formError && <div style={styles.formError} role="alert">{formError}</div>}
            <form onSubmit={handleSubmit} noValidate>
              <div style={styles.field}>
                <label htmlFor="level-name" style={styles.label}>Nombre</label>
                <input id="level-name" type="text" autoComplete="off" autoFocus value={nameValue}
                  onChange={(e) => { setNameValue(e.target.value); setNameError(null); setFormError(null); }}
                  style={{ ...styles.input, ...(nameError ? styles.inputError : {}) }}
                  disabled={isSubmitting}
                  aria-describedby={nameError ? 'level-name-error' : undefined} />
                {nameError && <span id="level-name-error" style={styles.fieldError}>{nameError}</span>}
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
  container:     { minHeight: '100vh', backgroundColor: '#f8faff', padding: '3rem 1rem' },
  inner:         { maxWidth: '800px', margin: '0 auto' },
  header:        { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' },
  title:         { margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b' },
  statusText:    { color: '#9ca3af', textAlign: 'center', padding: '2rem 0' },
  errorBanner:   { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.9rem', padding: '0.75rem 1rem' },
  tableWrapper:  { backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(99,102,241,0.07)' },
  table:         { borderCollapse: 'collapse', width: '100%' },
  thead:         { background: 'linear-gradient(90deg, #ede9fe, #e0e7ff)' },
  th:            { color: '#4f46e5', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.75rem 1rem', textAlign: 'left', textTransform: 'uppercase', borderBottom: '2px solid #e0e7ff' },
  thActions:     { textAlign: 'right' },
  tr:            { borderBottom: '1px solid #f3f4f6' },
  td:            { color: '#111827', fontSize: '0.95rem', padding: '0.85rem 1rem', verticalAlign: 'middle' },
  tdActions:     { display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' },
  rowError:      { backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '0.85rem', padding: '0.5rem 1rem', textAlign: 'right' },
  primaryButton: { background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, padding: '0.5rem 1rem', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' },
  editButton:    { backgroundColor: '#fff', border: '1.5px solid #c4b5fd', borderRadius: '4px', color: '#4f46e5', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0.75rem' },
  deleteButton:  { backgroundColor: '#fff', border: '1.5px solid #fca5a5', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, padding: '0.3rem 0.75rem' },
  cancelButton:  { backgroundColor: '#fff', border: '1.5px solid #d1d5db', borderRadius: '6px', color: '#374151', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600, padding: '0.5rem 1rem' },
  overlay:       { alignItems: 'center', backgroundColor: 'rgba(30,27,75,0.5)', bottom: 0, display: 'flex', justifyContent: 'center', left: 0, position: 'fixed', right: 0, top: 0, zIndex: 50 },
  modalCard:     { backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 8px 32px rgba(99,102,241,0.2)', padding: '2rem', width: '100%', maxWidth: '400px', border: '1px solid #e0e7ff' },
  modalTitle:    { fontSize: '1.25rem', fontWeight: 800, margin: '0 0 1.25rem', color: '#1e1b4b' },
  formError:     { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem' },
  field:         { display: 'flex', flexDirection: 'column', marginBottom: '1.25rem' },
  label:         { fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.3rem', color: '#374151' },
  input:         { backgroundColor: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: '6px', fontSize: '1rem', padding: '0.55rem 0.75rem', outline: 'none', color: '#111827' },
  inputError:    { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  fieldError:    { color: '#ef4444', fontSize: '0.8rem', marginTop: '0.25rem' },
  modalActions:  { display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' },
};

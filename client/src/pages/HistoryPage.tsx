import { useState, useEffect, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getAttemptHistory } from '../api/attempts.api';
import { listExercises } from '../api/exercises.api';
import { Attempt, AttemptStatus, Exercise } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function statusLabel(status: AttemptStatus): string {
  switch (status) {
    case 'correct':   return 'Correcto';
    case 'incorrect': return 'Incorrecto';
    case 'error':     return 'Error';
    default:          return status;
  }
}

function statusStyle(status: AttemptStatus): React.CSSProperties {
  switch (status) {
    case 'correct':
      return styles.badgeCorrect;
    case 'incorrect':
      return styles.badgeIncorrect;
    case 'error':
      return styles.badgeError;
    default:
      return {};
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Attempts state
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Exercises for the filter dropdown
  const [exercises, setExercises] = useState<Exercise[]>([]);

  // Filter state
  const [filterExerciseId, setFilterExerciseId] = useState<string>('');

  // ── Load exercises for the filter dropdown (once) ───────────────────────────
  useEffect(() => {
    if (!user) return;

    listExercises()
      .then(setExercises)
      .catch(() => {
        // Non-critical — filter just won't show named options
        setExercises([]);
      });
  }, [user]);

  // ── Load attempt history (re-runs when filter changes) ───────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getAttemptHistory(filterExerciseId || undefined)
      .then((data) => {
        if (!cancelled) {
          // Ensure descending order by date (Requirement 6.2, 6.3)
          const sorted = [...data].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setAttempts(sorted);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load history';
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, filterExerciseId]);

  function handleFilterChange(e: ChangeEvent<HTMLSelectElement>) {
    setFilterExerciseId(e.target.value);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return null; // Redirect in progress

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>📋 Historial de Intentos</h1>

        {/* Filtro por ejercicio */}
        <div style={styles.filterRow}>
          <label htmlFor="exercise-filter" style={styles.filterLabel}>
            Filtrar por ejercicio:
          </label>
          <select id="exercise-filter" value={filterExerciseId} onChange={handleFilterChange}
            style={styles.select} disabled={isLoading} aria-label="Filtrar intentos por ejercicio">
            <option value="">Todos los ejercicios</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>{ex.title}</option>
            ))}
          </select>
        </div>

        {isLoading && <p style={styles.statusText} aria-live="polite">Cargando historial…</p>}

        {!isLoading && error && (
          <div style={styles.errorBanner} role="alert">
            {error}
            <button style={styles.retryButton} onClick={() => {
              setError(null); setIsLoading(true);
              getAttemptHistory(filterExerciseId || undefined)
                .then((data) => {
                  const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                  setAttempts(sorted);
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar el historial'))
                .finally(() => setIsLoading(false));
            }}>Reintentar</button>
          </div>
        )}

        {!isLoading && !error && attempts.length === 0 && (
          <p style={styles.statusText}>
            {filterExerciseId ? 'No hay intentos para este ejercicio.' : 'Aún no has enviado ningún intento.'}
          </p>
        )}

        {!isLoading && !error && attempts.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Historial de intentos">
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Ejercicio</th>
                  <th style={{ ...styles.th, ...styles.thCenter }}>Estado</th>
                  <th style={{ ...styles.th, ...styles.thRight }}>Puntaje</th>
                  <th style={{ ...styles.th, ...styles.thRight }}>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => (
                  <tr key={attempt.id} style={styles.tr}>
                    <td style={styles.td}>{attempt.exerciseTitle ?? attempt.exerciseId}</td>
                    <td style={{ ...styles.td, ...styles.tdCenter }}>
                      <span style={{ ...styles.badge, ...statusStyle(attempt.status) }}>
                        {statusLabel(attempt.status)}
                      </span>
                    </td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>{attempt.score} pts</td>
                    <td style={{ ...styles.td, ...styles.tdRight }}>{formatDate(attempt.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', backgroundColor: '#f8faff', padding: '3rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
  card: { backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 20px rgba(99,102,241,0.1)', border: '1px solid #e0e7ff', padding: '2rem', width: '100%', maxWidth: '900px' },
  title: { margin: '0 0 1.5rem', fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b' },
  filterRow: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterLabel: { fontSize: '0.85rem', fontWeight: 600, color: '#4f46e5' },
  select: { border: '1.5px solid #c4b5fd', borderRadius: '6px', fontSize: '0.875rem', padding: '0.4rem 0.75rem', color: '#1e1b4b', backgroundColor: '#f5f3ff', cursor: 'pointer', minWidth: '200px' },
  statusText: { color: '#9ca3af', textAlign: 'center', padding: '2rem 0' },
  errorBanner: { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.875rem', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' },
  retryButton: { background: 'none', border: '1px solid #dc2626', borderRadius: '4px', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.6rem' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  thead: { background: 'linear-gradient(90deg, #ede9fe, #e0e7ff)' },
  th: { color: '#4f46e5', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0.7rem 0.9rem', textAlign: 'left', borderBottom: '2px solid #e0e7ff' },
  thCenter: { textAlign: 'center' },
  thRight: { textAlign: 'right' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '0.8rem 0.9rem', color: '#111827', verticalAlign: 'middle' },
  tdCenter: { textAlign: 'center' },
  tdRight: { textAlign: 'right' },
  badge: { display: 'inline-block', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.7rem' },
  badgeCorrect:   { backgroundColor: '#dcfce7', color: '#15803d' },
  badgeIncorrect: { backgroundColor: '#fef9c3', color: '#a16207' },
  badgeError:     { backgroundColor: '#fee2e2', color: '#b91c1c' },
};

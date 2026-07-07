import { useState, useEffect, useRef, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getExercise } from '../api/exercises.api';
import { submitAttempt, AttemptResult } from '../api/attempts.api';
import { ExerciseDetail } from '../types';

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();

  // Exercise fetch state
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Query editor state
  const [query, setQuery] = useState('');
  const [queryError, setQueryError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);

  // Capture start time when the page mounts (Requirement 5.5)
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!id) {
      setLoadError('No exercise ID provided.');
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchExercise() {
      try {
        const data = await getExercise(id as string);
        if (!cancelled) {
          setExercise(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load exercise';
          setLoadError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchExercise();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function handleQueryChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setQuery(e.target.value);
    if (e.target.value.trim()) {
      setQueryError(null);
    }
    // Clear previous result and submit error when user edits the query
    setResult(null);
    setSubmitError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    // Client-side validation: query must not be empty (Requirement 15.1)
    if (!query.trim()) {
      setQueryError('La consulta SQL no puede estar vacía');
      return;
    }

    if (!exercise) return;

    const resolutionTimeMs = Date.now() - startTimeRef.current;

    setIsSubmitting(true);
    setSubmitError(null);
    setResult(null);

    try {
      const attemptResult = await submitAttempt(exercise.id, query.trim(), resolutionTimeMs);
      setResult(attemptResult);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar el intento';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─── Render: loading ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div style={styles.container}>
        <p style={styles.loadingText}>Cargando ejercicio…</p>
      </div>
    );
  }

  // ─── Render: load error ───────────────────────────────────────────────────

  if (loadError || !exercise) {
    return (
      <div style={styles.container}>
        <div style={styles.errorBanner} role="alert">
          {loadError ?? 'Ejercicio no encontrado'}
        </div>
        <Link to="/exercises" style={styles.backLink}>
          ← Volver al catálogo
        </Link>
      </div>
    );
  }

  // ─── Render: main ─────────────────────────────────────────────────────────

  return (
    <div style={styles.container}>
      <Link to="/exercises" style={styles.backLink}>
        ← Volver al catálogo
      </Link>

      {/* Detalle del ejercicio */}
      <div style={styles.card}>
        <div style={styles.metaRow}>
          <span style={styles.badge}>{exercise.level.name}</span>
          <span style={styles.badgeCat}>{exercise.category.name}</span>
          <span style={styles.scoreTag}>🏆 {exercise.score} pts</span>
        </div>
        <h1 style={styles.title}>{exercise.title}</h1>
        <div style={styles.description}><p>{exercise.description}</p></div>
      </div>

      {/* Editor SQL */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>✏️ Tu solución SQL</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.field}>
            <label htmlFor="sql-query" style={styles.label}>Escribe tu consulta SQL:</label>
            <textarea id="sql-query" value={query} onChange={handleQueryChange} rows={8}
              placeholder="SELECT ..." disabled={isSubmitting}
              style={{ ...styles.textarea, ...(queryError ? styles.textareaError : {}) }}
              aria-describedby={queryError ? 'query-error' : undefined} />
            {queryError && <span id="query-error" style={styles.fieldError} role="alert">{queryError}</span>}
          </div>
          {submitError && <div style={styles.errorBanner} role="alert">{submitError}</div>}
          <button type="submit"
            style={{ ...styles.button, ...(isSubmitting ? styles.buttonDisabled : {}) }}
            disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : '🚀 Enviar solución'}
          </button>
        </form>
      </div>

      {/* Panel de resultado */}
      {result && (
        <div style={{ ...styles.card, ...styles.resultCard,
            ...(result.status === 'correct' ? styles.resultCorrect : styles.resultIncorrect) }}
          role="region" aria-label="Resultado del intento">
          <h2 style={styles.sectionTitle}>Resultado</h2>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Estado:</span>
            <span style={{ ...styles.statusBadge,
                ...(result.status === 'correct' ? styles.statusCorrect
                  : result.status === 'incorrect' ? styles.statusIncorrect : styles.statusError) }}>
              {result.status === 'correct' ? '✓ Correcto' : result.status === 'incorrect' ? '✗ Incorrecto' : '⚠ Error'}
            </span>
          </div>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Puntaje obtenido:</span>
            <span style={styles.resultValue}>{result.score} pts</span>
          </div>
          <div style={styles.resultRow}>
            <span style={styles.resultLabel}>Tiempo de resolución:</span>
            <span style={styles.resultValue}>{(result.resolutionTimeMs / 1000).toFixed(1)} s</span>
          </div>
          {result.hint && (
            <div style={styles.hint}><strong>💡 Sugerencia:</strong> {result.hint}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: '760px', margin: '0 auto', padding: '2rem 1rem', fontFamily: 'system-ui, sans-serif' },
  backLink:  { color: '#4f46e5', textDecoration: 'none', fontSize: '0.875rem', display: 'inline-block', marginBottom: '1.25rem', fontWeight: 600 },
  card:      { backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 2px 12px rgba(99,102,241,0.1)', border: '1px solid #e0e7ff', padding: '1.5rem', marginBottom: '1.5rem' },
  metaRow:   { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' },
  badge:     { backgroundColor: '#ede9fe', borderRadius: '12px', color: '#6d28d9', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem' },
  badgeCat:  { backgroundColor: '#e0f2fe', borderRadius: '12px', color: '#0369a1', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem' },
  scoreTag:  { backgroundColor: '#fefce8', borderRadius: '12px', color: '#a16207', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.65rem' },
  title:     { fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.75rem', color: '#1e1b4b' },
  description: { color: '#374151', lineHeight: 1.65, fontSize: '0.95rem', whiteSpace: 'pre-wrap' },
  sectionTitle: { fontSize: '1.1rem', fontWeight: 700, margin: '0 0 1rem', color: '#4f46e5' },
  field:     { display: 'flex', flexDirection: 'column', marginBottom: '1rem' },
  label:     { fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.35rem', color: '#374151' },
  textarea:  { border: '1.5px solid #c4b5fd', borderRadius: '6px', fontFamily: "'Courier New', Courier, monospace", fontSize: '0.9rem', lineHeight: 1.5, padding: '0.6rem 0.75rem', resize: 'vertical', outline: 'none', color: '#111827', backgroundColor: '#fafafa' },
  textareaError: { borderColor: '#dc2626' },
  fieldError:    { color: '#dc2626', fontSize: '0.8rem', marginTop: '0.25rem' },
  errorBanner:   { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1rem', padding: '0.75rem' },
  button:        { background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, padding: '0.65rem 1.5rem', marginTop: '0.25rem', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' },
  buttonDisabled:{ opacity: 0.6, cursor: 'not-allowed' },
  resultCard:    { borderLeft: '4px solid transparent' },
  resultCorrect: { borderLeftColor: '#16a34a', backgroundColor: '#f0fdf4' },
  resultIncorrect: { borderLeftColor: '#dc2626', backgroundColor: '#fef2f2' },
  resultRow:   { display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' },
  resultLabel: { fontSize: '0.9rem', fontWeight: 600, color: '#374151', minWidth: '180px' },
  resultValue: { fontSize: '0.9rem', color: '#1e1b4b', fontWeight: 500 },
  statusBadge: { borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700, padding: '0.2rem 0.65rem' },
  statusCorrect:   { backgroundColor: '#dcfce7', color: '#15803d' },
  statusIncorrect: { backgroundColor: '#fee2e2', color: '#b91c1c' },
  statusError:     { backgroundColor: '#fef9c3', color: '#854d0e' },
  hint:        { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', color: '#78350f', fontSize: '0.875rem', marginTop: '0.75rem', padding: '0.65rem 0.9rem', lineHeight: 1.5 },
  loadingText: { color: '#9ca3af', textAlign: 'center', marginTop: '4rem' },
};

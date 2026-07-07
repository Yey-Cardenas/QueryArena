import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getRanking } from '../api/ranking.api';
import { RankingEntry } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Re-computes positions so that students with equal accumulated scores
 * share the same position number (dense rank with gaps — standard competition
 * ranking: 1, 2, 2, 4 …).
 *
 * The backend may return sequential positions even for ties, so we always
 * recompute on the frontend to guarantee correctness (Requirements 10.2, 10.3).
 */
function assignPositions(entries: RankingEntry[]): RankingEntry[] {
  if (entries.length === 0) return entries;

  // Sort descending by score so we assign positions in the right order
  const sorted = [...entries].sort((a, b) => b.accumulatedScore - a.accumulatedScore);

  let currentPosition = 1;
  return sorted.map((entry, index) => {
    if (index > 0 && entry.accumulatedScore < sorted[index - 1].accumulatedScore) {
      // Gap: next position skips over tied entries above
      currentPosition = index + 1;
    }
    return { ...entry, position: currentPosition };
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RankingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Load ranking ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getRanking()
      .then((data) => {
        if (!cancelled) {
          // Re-compute positions to handle tied scores correctly
          setRanking(assignPositions(data));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error al cargar el ranking';
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!user) return null; // Redirect in progress

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🏆 Ranking Global</h1>

        {isLoading && (
          <p style={styles.statusText} aria-live="polite">Cargando ranking…</p>
        )}

        {!isLoading && error && (
          <div style={styles.errorBanner} role="alert">
            {error}
            <button style={styles.retryButton} onClick={() => {
              setIsLoading(true); setError(null);
              getRanking()
                .then((data) => setRanking(assignPositions(data)))
                .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Error al cargar el ranking'))
                .finally(() => setIsLoading(false));
            }}>Reintentar</button>
          </div>
        )}

        {!isLoading && !error && ranking.length === 0 && (
          <p style={styles.statusText}>No hay estudiantes registrados aún.</p>
        )}

        {!isLoading && !error && ranking.length > 0 && (
          <div style={styles.tableWrapper}>
            <table style={styles.table} aria-label="Tabla de ranking">
              <thead>
                <tr style={styles.thead}>
                  <th style={{ ...styles.th, ...styles.thCenter }}>Posición</th>
                  <th style={styles.th}>Usuario</th>
                  <th style={{ ...styles.th, ...styles.thRight }}>Puntaje Acumulado</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((entry) => {
                  const isCurrentUser = entry.username === user.username;
                  return (
                    <tr key={entry.username}
                      style={isCurrentUser ? { ...styles.tr, ...styles.trHighlight } : styles.tr}
                      aria-current={isCurrentUser ? 'true' : undefined}>
                      <td style={{ ...styles.td, ...styles.tdCenter }}>{positionBadge(entry.position)}</td>
                      <td style={styles.td}>
                        {isCurrentUser ? (
                          <span style={styles.currentUserCell}>
                            <span style={styles.youIndicator}>→ Tú</span>
                            <strong>{entry.username}</strong>
                          </span>
                        ) : entry.username}
                      </td>
                      <td style={{ ...styles.td, ...styles.tdRight }}>
                        <span style={styles.score}>{entry.accumulatedScore} pts</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Position badge helper ────────────────────────────────────────────────────

function positionBadge(position: number): React.ReactNode {
  if (position === 1) return <span style={{ ...styles.positionBadge, ...styles.gold }}>{position}</span>;
  if (position === 2) return <span style={{ ...styles.positionBadge, ...styles.silver }}>{position}</span>;
  if (position === 3) return <span style={{ ...styles.positionBadge, ...styles.bronze }}>{position}</span>;
  return <span style={styles.positionText}>{position}</span>;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8faff',
    padding: '3rem 1rem',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(99,102,241,0.1)',
    border: '1px solid #e0e7ff',
    padding: '2rem',
    width: '100%',
    maxWidth: '700px',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.75rem',
    fontWeight: 800,
    color: '#1e1b4b',
  },
  statusText: { color: '#9ca3af', textAlign: 'center', padding: '2rem 0' },
  errorBanner: {
    backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
    color: '#dc2626', fontSize: '0.875rem', padding: '0.75rem 1rem', marginBottom: '1rem',
    display: 'flex', alignItems: 'center', gap: '1rem',
  },
  retryButton: {
    background: 'none', border: '1px solid #dc2626', borderRadius: '4px',
    color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem 0.6rem',
  },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' },
  thead: { background: 'linear-gradient(90deg, #ede9fe, #e0e7ff)' },
  th: {
    color: '#4f46e5', fontWeight: 700, fontSize: '0.78rem',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
    padding: '0.75rem 1rem', textAlign: 'left', borderBottom: '2px solid #e0e7ff',
  },
  thCenter: { textAlign: 'center' },
  thRight: { textAlign: 'right' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  trHighlight: { backgroundColor: '#eff6ff', borderBottom: '1px solid #bfdbfe' },
  td: { padding: '0.85rem 1rem', color: '#111827', verticalAlign: 'middle' },
  tdCenter: { textAlign: 'center' },
  tdRight: { textAlign: 'right' },
  currentUserCell: { display: 'inline-flex', alignItems: 'center', gap: '0.5rem' },
  youIndicator: { color: '#4f46e5', fontSize: '0.8rem', fontWeight: 700 },
  score: { fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#4f46e5' },
  positionBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', width: '32px', height: '32px', fontWeight: 800, fontSize: '0.85rem',
  },
  gold:   { backgroundColor: '#fef9c3', color: '#a16207', border: '2px solid #fde047' },
  silver: { backgroundColor: '#f1f5f9', color: '#475569', border: '2px solid #cbd5e1' },
  bronze: { backgroundColor: '#fff7ed', color: '#c2410c', border: '2px solid #fdba74' },
  positionText: { color: '#6b7280', fontWeight: 600 },
};

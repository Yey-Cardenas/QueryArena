import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as dashboardApi from '../api/dashboard.api';
import { DashboardSummary, ProgressByGroup, Attempt, AttemptStatus } from '../types';

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
    case 'correct':
      return 'Correcto';
    case 'incorrect':
      return 'Incorrecto';
    case 'error':
      return 'Error';
    default:
      return status;
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

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  accent?: boolean;
}

function StatCard({ label, value, accent }: StatCardProps) {
  return (
    <div style={{ ...styles.statCard, ...(accent ? styles.statCardAccent : {}) }}>
      <span style={styles.statValue}>{value}</span>
      <span style={styles.statLabel}>{label}</span>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Redirect unauthenticated users
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // ─── State ────────────────────────────────────────────────────────────────

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [progressByLevel, setProgressByLevel] = useState<ProgressByGroup[]>([]);
  const [progressByCategory, setProgressByCategory] = useState<ProgressByGroup[]>([]);
  const [recentHistory, setRecentHistory] = useState<Attempt[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Load all dashboard data ──────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      dashboardApi.getSummary(),
      dashboardApi.getProgressByLevel(),
      dashboardApi.getProgressByCategory(),
      dashboardApi.getRecentHistory(),
    ])
      .then(([sum, byLevel, byCategory, history]) => {
        if (!cancelled) {
          setSummary(sum);
          setProgressByLevel(byLevel);
          setProgressByCategory(byCategory);
          setRecentHistory(history);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error al cargar el dashboard';
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
      <div style={styles.inner}>
        <h1 style={styles.title}>Dashboard</h1>

        {/* Loading state */}
        {isLoading && (
          <p style={styles.statusText} aria-live="polite">
            Cargando dashboard…
          </p>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div style={styles.errorBanner} role="alert">
            {error}
            <button
              style={styles.retryButton}
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Dashboard content */}
        {!isLoading && !error && summary && (
          <>
            {/* ── Summary cards (Requirements 9.1, 9.2) ───────────────── */}
            <section aria-labelledby="summary-heading" style={styles.section}>
              <h2 id="summary-heading" style={styles.sectionTitle}>
                Resumen
              </h2>
              <div style={styles.statsGrid}>
                <StatCard
                  label="Ejercicios intentados"
                  value={summary.totalAttempted}
                />
                <StatCard
                  label="Ejercicios correctos"
                  value={summary.totalCorrect}
                />
                <StatCard
                  label="Puntaje acumulado"
                  value={summary.accumulatedScore}
                  accent
                />
                <StatCard
                  label="Posición en ranking"
                  value={summary.rankingPosition ?? '—'}
                />
              </div>
            </section>

            {/* ── Progress by level (Requirement 9.3) ─────────────────── */}
            <section aria-labelledby="by-level-heading" style={styles.section}>
              <h2 id="by-level-heading" style={styles.sectionTitle}>
                Progreso por nivel
              </h2>
              {progressByLevel.length === 0 ? (
                <p style={styles.emptyText}>No hay intentos aún.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table} aria-label="Progreso por nivel">
                    <thead>
                      <tr>
                        <th style={styles.th}>Nivel</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Intentados</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Correctos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressByLevel.map((row) => (
                        <tr key={row.id} style={styles.tr}>
                          <td style={styles.td}>{row.name}</td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>{row.attempted}</td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>{row.correct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Progress by category (Requirement 9.3) ──────────────── */}
            <section aria-labelledby="by-category-heading" style={styles.section}>
              <h2 id="by-category-heading" style={styles.sectionTitle}>
                Progreso por categoría
              </h2>
              {progressByCategory.length === 0 ? (
                <p style={styles.emptyText}>No hay intentos aún.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table} aria-label="Progreso por categoría">
                    <thead>
                      <tr>
                        <th style={styles.th}>Categoría</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Intentados</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Correctos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressByCategory.map((row) => (
                        <tr key={row.id} style={styles.tr}>
                          <td style={styles.td}>{row.name}</td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>{row.attempted}</td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>{row.correct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Recent history (Requirements 9.4, 9.5) ──────────────── */}
            <section aria-labelledby="history-heading" style={styles.section}>
              <h2 id="history-heading" style={styles.sectionTitle}>
                Historial reciente
              </h2>
              {recentHistory.length === 0 ? (
                <p style={styles.emptyText}>No hay intentos aún.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table} aria-label="Historial reciente de intentos">
                    <thead>
                      <tr>
                        <th style={styles.th}>Ejercicio</th>
                        <th style={{ ...styles.th, ...styles.thCenter }}>Estado</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Puntaje</th>
                        <th style={{ ...styles.th, ...styles.thRight }}>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentHistory.map((attempt) => (
                        <tr key={attempt.id} style={styles.tr}>
                          <td style={styles.td}>
                            {attempt.exerciseTitle ?? attempt.exerciseId}
                          </td>
                          <td style={{ ...styles.td, ...styles.tdCenter }}>
                            <span style={{ ...styles.badge, ...statusStyle(attempt.status) }}>
                              {statusLabel(attempt.status)}
                            </span>
                          </td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>
                            {attempt.score}
                          </td>
                          <td style={{ ...styles.td, ...styles.tdRight }}>
                            {formatDate(attempt.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
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
    maxWidth: '900px',
    margin: '0 auto',
  },
  title: {
    margin: '0 0 1.5rem',
    fontSize: '1.75rem',
    fontWeight: 600,
    color: '#111827',
  },
  section: {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginBottom: '1.5rem',
    padding: '1.5rem',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#374151',
  },
  // Stat cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '1.25rem 1rem',
    textAlign: 'center',
  },
  statCardAccent: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  statValue: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
    lineHeight: 1,
  },
  statLabel: {
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  // Empty / status
  emptyText: {
    color: '#6b7280',
    fontSize: '0.9rem',
    margin: 0,
    padding: '0.5rem 0',
  },
  statusText: {
    color: '#6b7280',
    textAlign: 'center',
    padding: '2rem 0',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    border: '1px solid #fca5a5',
    borderRadius: '6px',
    color: '#dc2626',
    fontSize: '0.9rem',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
  },
  retryButton: {
    backgroundColor: 'transparent',
    border: '1px solid #dc2626',
    borderRadius: '4px',
    color: '#dc2626',
    cursor: 'pointer',
    fontSize: '0.85rem',
    padding: '0.3rem 0.75rem',
    marginLeft: '1rem',
  },
  // Tables
  tableWrapper: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.9rem',
  },
  th: {
    borderBottom: '2px solid #e5e7eb',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0.6rem 0.75rem',
    textAlign: 'left',
  },
  thCenter: {
    textAlign: 'center',
  },
  thRight: {
    textAlign: 'right',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '0.75rem',
    color: '#111827',
    verticalAlign: 'middle',
  },
  tdCenter: {
    textAlign: 'center',
  },
  tdRight: {
    textAlign: 'right',
  },
  badge: {
    display: 'inline-block',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    padding: '0.2rem 0.6rem',
  },
  badgeCorrect: {
    backgroundColor: '#f0fdf4',
    color: '#16a34a',
  },
  badgeIncorrect: {
    backgroundColor: '#fef9c3',
    color: '#a16207',
  },
  badgeError: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
  },
};

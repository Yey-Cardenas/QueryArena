import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as exercisesApi from '../api/exercises.api';
import * as adminApi from '../api/admin.api';
import { Exercise, Level, Category } from '../types';

export default function ExercisesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { if (!user) navigate('/login', { replace: true }); }, [user, navigate]);

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [levelId, setLevelId] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingEx, setLoadingEx] = useState(true);
  const [exError, setExError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([adminApi.listLevels(), adminApi.listCategories()])
      .then(([l, c]) => { setLevels(l); setCategories(c); })
      .finally(() => setLoadingFilters(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoadingEx(true); setExError(null);
    const filters: exercisesApi.ExerciseFilters = {};
    if (levelId !== '') filters.levelId = levelId;
    if (categoryId !== '') filters.categoryId = categoryId;
    exercisesApi.listExercises(filters)
      .then(setExercises)
      .catch((e: unknown) => setExError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoadingEx(false));
  }, [user, levelId, categoryId]);

  if (!user) return null;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <h1 style={s.title}>Exercises</h1>

        {/* Filters */}
        <div style={s.filters}>
          <div style={s.filterGroup}>
            <label htmlFor="filter-level" style={s.filterLabel}>Level</label>
            <select id="filter-level" value={levelId}
              onChange={e => setLevelId(e.target.value === '' ? '' : Number(e.target.value))}
              style={s.select} disabled={loadingFilters}>
              <option value="">All levels</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div style={s.filterGroup}>
            <label htmlFor="filter-category" style={s.filterLabel}>Category</label>
            <select id="filter-category" value={categoryId}
              onChange={e => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              style={s.select} disabled={loadingFilters}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        {loadingEx && <p style={s.muted}>Loading…</p>}
        {!loadingEx && exError && <div style={s.errorBanner} role="alert">{exError}</div>}
        {!loadingEx && !exError && exercises.length === 0 && (
          <p style={s.muted}>No exercises found.</p>
        )}
        {!loadingEx && !exError && exercises.length > 0 && (
          <ul style={s.list} aria-label="Exercise catalog">
            {exercises.map(ex => (
              <li key={ex.id} style={s.item}>
                <button style={s.itemBtn} onClick={() => navigate(`/exercises/${ex.id}`)}
                  aria-label={`Open exercise: ${ex.title}`}>
                  <span style={s.itemTitle}>{ex.title}</span>
                  <div style={s.itemMeta}>
                    <span style={s.badge}>{ex.level.name}</span>
                    <span style={s.badge}>{ex.category.name}</span>
                    <span style={s.scorePill}>{ex.score} pts</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:       { minHeight: '100vh', backgroundColor: '#0f1117', padding: '2.5rem 1rem' },
  inner:      { maxWidth: '780px', margin: '0 auto' },
  title:      { fontSize: '1.5rem', fontWeight: 700, color: '#e2e4ec', marginBottom: '1.5rem' },
  filters:    { display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' },
  filterGroup:{ display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  filterLabel:{ fontSize: '0.75rem', fontWeight: 500, color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  select:     { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '4px', color: '#e2e4ec', fontSize: '0.875rem', padding: '0.4rem 0.75rem', minWidth: '150px' },
  muted:      { color: '#8b8fa8', textAlign: 'center', padding: '3rem 0' },
  errorBanner:{ backgroundColor: '#2a0f0f', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#ef4444', fontSize: '0.875rem', padding: '0.75rem 1rem' },
  list:       { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  item:       { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '6px', overflow: 'hidden' },
  itemBtn:    { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', width: '100%', textAlign: 'left' },
  itemTitle:  { color: '#e2e4ec', fontSize: '0.95rem', fontWeight: 500 },
  itemMeta:   { display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' },
  badge:      { backgroundColor: '#1e2130', border: '1px solid #2a2d3a', borderRadius: '9999px', color: '#8b8fa8', fontSize: '0.72rem', fontWeight: 500, padding: '0.15rem 0.55rem' },
  scorePill:  { backgroundColor: '#2a2415', border: '1px solid #44380f', borderRadius: '9999px', color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600, padding: '0.15rem 0.55rem' },
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import * as exercisesApi from '../api/exercises.api';
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
    Promise.all([exercisesApi.listLevels(), exercisesApi.listCategories()])
      .then(([l, c]) => { setLevels(l); setCategories(c); })
      .catch(() => { /* filters stay empty — exercise list still works */ })
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
      .catch((e: unknown) => setExError(e instanceof Error ? e.message : 'Error al cargar ejercicios'))
      .finally(() => setLoadingEx(false));
  }, [user, levelId, categoryId]);

  if (!user) return null;

  return (
    <div style={s.page}>
      <div style={s.inner}>
        <div style={s.pageHeader}>
          <h1 style={s.title}>📚 Catálogo de Ejercicios</h1>
          <p style={s.subtitle}>Practica tus habilidades de SQL con ejercicios de distintos niveles</p>
        </div>

        {/* Filtros */}
        <div style={s.filtersCard}>
          <div style={s.filterGroup}>
            <label htmlFor="filter-level" style={s.filterLabel}>🎯 Nivel de dificultad</label>
            <select id="filter-level" value={levelId}
              onChange={e => setLevelId(e.target.value === '' ? '' : Number(e.target.value))}
              style={s.select} disabled={loadingFilters}>
              <option value="">Todos los niveles</option>
              {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div style={s.filterGroup}>
            <label htmlFor="filter-category" style={s.filterLabel}>🏷️ Categoría</label>
            <select id="filter-category" value={categoryId}
              onChange={e => setCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              style={s.select} disabled={loadingFilters}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Lista */}
        {loadingEx && <p style={s.muted}>Cargando ejercicios…</p>}
        {!loadingEx && exError && <div style={s.errorBanner} role="alert">{exError}</div>}
        {!loadingEx && !exError && exercises.length === 0 && (
          <p style={s.muted}>No se encontraron ejercicios con los filtros seleccionados.</p>
        )}
        {!loadingEx && !exError && exercises.length > 0 && (
          <ul style={s.list} aria-label="Catálogo de ejercicios">
            {exercises.map(ex => (
              <li key={ex.id} style={s.item}>
                <button style={s.itemBtn} onClick={() => navigate(`/exercises/${ex.id}`)}
                  aria-label={`Abrir ejercicio: ${ex.title}`}>
                  <div style={s.itemLeft}>
                    <span style={s.itemTitle}>{ex.title}</span>
                    <p style={s.itemDesc}>{ex.description.slice(0, 90)}{ex.description.length > 90 ? '…' : ''}</p>
                  </div>
                  <div style={s.itemMeta}>
                    <span style={s.badge}>{ex.level.name}</span>
                    <span style={s.badgeCat}>{ex.category.name}</span>
                    <span style={s.scorePill}>🏆 {ex.score} pts</span>
                    <span style={s.arrow}>→</span>
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
  page:       { minHeight: '100vh', backgroundColor: '#f8faff', padding: '2.5rem 1rem' },
  inner:      { maxWidth: '820px', margin: '0 auto' },
  pageHeader: { marginBottom: '1.75rem' },
  title:      { fontSize: '1.75rem', fontWeight: 800, color: '#1e1b4b', margin: '0 0 0.4rem' },
  subtitle:   { fontSize: '0.95rem', color: '#6b7280', margin: 0 },
  filtersCard:{ backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '10px', padding: '1.25rem 1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(99,102,241,0.07)' },
  filterGroup:{ display: 'flex', flexDirection: 'column', gap: '0.3rem' },
  filterLabel:{ fontSize: '0.78rem', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.06em' },
  select:     { backgroundColor: '#f5f3ff', border: '1.5px solid #c4b5fd', borderRadius: '6px', color: '#1e1b4b', fontSize: '0.9rem', fontWeight: 500, padding: '0.45rem 0.85rem', minWidth: '160px', cursor: 'pointer' },
  muted:      { color: '#9ca3af', textAlign: 'center', padding: '3rem 0', fontSize: '0.95rem' },
  errorBanner:{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#dc2626', fontSize: '0.875rem', padding: '0.75rem 1rem' },
  list:       { listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: 0, margin: 0 },
  item:       { backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '10px', overflow: 'hidden', transition: 'box-shadow 0.15s', boxShadow: '0 1px 4px rgba(99,102,241,0.06)' },
  itemBtn:    { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.4rem', width: '100%', textAlign: 'left', gap: '1rem' },
  itemLeft:   { display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 },
  itemTitle:  { color: '#1e1b4b', fontSize: '1rem', fontWeight: 700 },
  itemDesc:   { color: '#6b7280', fontSize: '0.85rem', margin: 0, lineHeight: 1.4 },
  itemMeta:   { display: 'flex', gap: '0.4rem', flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' },
  badge:      { backgroundColor: '#ede9fe', border: '1px solid #c4b5fd', borderRadius: '9999px', color: '#6d28d9', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem' },
  badgeCat:   { backgroundColor: '#e0f2fe', border: '1px solid #7dd3fc', borderRadius: '9999px', color: '#0369a1', fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.6rem' },
  scorePill:  { backgroundColor: '#fefce8', border: '1px solid #fde047', borderRadius: '9999px', color: '#a16207', fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.6rem' },
  arrow:      { color: '#4f46e5', fontWeight: 700, fontSize: '1.1rem' },
};

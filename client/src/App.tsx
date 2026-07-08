import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ExercisesPage from './pages/ExercisesPage';
import ExerciseDetailPage from './pages/ExerciseDetailPage';
import HistoryPage from './pages/HistoryPage';
import DashboardPage from './pages/DashboardPage';
import RankingPage from './pages/RankingPage';
import AdminLevelsPage from './pages/admin/AdminLevelsPage';
import AdminCategoriesPage from './pages/admin/AdminCategoriesPage';
import AdminExercisesPage from './pages/admin/AdminExercisesPage';

// ─── Placeholder pages (no dedicated file yet) ───────────────────────────────

function HomePage() {
  return (
    <div style={homeS.page}>
      <div style={homeS.wrap}>
        <div style={homeS.hero}>
          <img src="/logo.png" alt="QueryArena" style={homeS.heroLogo} />
          <h1 style={homeS.title}>QueryArena</h1>
          <p style={homeS.sub}>Practica SQL. Sigue tu progreso. Escala en el ranking.</p>
          <div style={homeS.actions}>
            <a href="/register" style={homeS.btnPrimary}>Comenzar ahora</a>
            <a href="/login" style={homeS.btnGhost}>Iniciar sesión</a>
          </div>
        </div>
        <div style={homeS.grid}>
          {[
            { icon: '📝', title: 'Ejercicios SQL', text: 'Clasificados por nivel y tema.' },
            { icon: '📊', title: 'Dashboard', text: 'Rastrea tu progreso a lo largo del tiempo.' },
            { icon: '🏆', title: 'Ranking', text: 'Compara tu puntaje con el de tus compañeros.' },
          ].map((f) => (
            <div key={f.title} style={homeS.card}>
              <span style={homeS.icon}>{f.icon}</span>
              <h3 style={homeS.cardTitle}>{f.title}</h3>
              <p style={homeS.cardText}>{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const homeS: Record<string, React.CSSProperties> = {
  page:      { minHeight: '100vh', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #fdf4ff 100%)' },
  wrap:      { maxWidth: '820px', margin: '0 auto', padding: '4rem 1.5rem' },
  hero:      { textAlign: 'center', marginBottom: '3.5rem' },
  heroLogo:  { width: '96px', height: '96px', objectFit: 'contain', borderRadius: '20px', marginBottom: '1.25rem', boxShadow: '0 4px 20px rgba(99,102,241,0.2)' },
  title:     { fontSize: '2.75rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.75rem', letterSpacing: '-0.02em' },
  sub:       { fontSize: '1.05rem', color: '#6b7280', marginBottom: '2rem' },
  actions:   { display: 'flex', gap: '0.75rem', justifyContent: 'center' },
  btnPrimary:{ background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', borderRadius: '8px', color: '#fff', fontSize: '0.95rem', fontWeight: 700, padding: '0.7rem 2rem', textDecoration: 'none', display: 'inline-block', boxShadow: '0 3px 12px rgba(99,102,241,0.35)' },
  btnGhost:  { border: '1.5px solid #c4b5fd', borderRadius: '8px', color: '#4f46e5', fontSize: '0.95rem', fontWeight: 600, padding: '0.7rem 2rem', textDecoration: 'none', display: 'inline-block', backgroundColor: '#fff' },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' },
  card:      { backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '1.75rem', textAlign: 'center', boxShadow: '0 2px 8px rgba(99,102,241,0.08)' },
  icon:      { fontSize: '2rem', display: 'block', marginBottom: '0.75rem' },
  cardTitle: { fontSize: '1rem', fontWeight: 700, color: '#1e1b4b', marginBottom: '0.4rem' },
  cardText:  { fontSize: '0.875rem', color: '#6b7280', margin: 0 },
};

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '0.75rem' }}>404</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Página no encontrada.</p>
      <a href="/" style={{ color: '#4f46e5', fontWeight: 600 }}>← Volver al inicio</a>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected student routes (Requirement 14.2) */}
          <Route element={<PrivateRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/exercises" element={<ExercisesPage />} />
            <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/ranking" element={<RankingPage />} />
          </Route>

          {/* Protected admin routes (Requirement 14.3) */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/levels" element={<AdminLevelsPage />} />
            <Route path="/admin/categories" element={<AdminCategoriesPage />} />
            <Route path="/admin/exercises" element={<AdminExercisesPage />} />
          </Route>

          {/* Fallback */}
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

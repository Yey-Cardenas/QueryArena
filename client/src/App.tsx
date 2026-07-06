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
    <div style={homeS.wrap}>
      <div style={homeS.hero}>
        <h1 style={homeS.title}>QueryArena</h1>
        <p style={homeS.sub}>Practice SQL. Track progress. Climb the leaderboard.</p>
        <div style={homeS.actions}>
          <a href="/register" style={homeS.btnPrimary}>Get started</a>
          <a href="/login" style={homeS.btnGhost}>Sign in</a>
        </div>
      </div>
      <div style={homeS.grid}>
        {[
          { icon: '📝', title: 'SQL Exercises', text: 'Categorized by level and topic.' },
          { icon: '📊', title: 'Dashboard', text: 'Track your progress over time.' },
          { icon: '🏆', title: 'Ranking', text: 'Compare scores with your peers.' },
        ].map((f) => (
          <div key={f.title} style={homeS.card}>
            <span style={homeS.icon}>{f.icon}</span>
            <h3 style={homeS.cardTitle}>{f.title}</h3>
            <p style={homeS.cardText}>{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const homeS: Record<string, React.CSSProperties> = {
  wrap:  { maxWidth: '820px', margin: '0 auto', padding: '4rem 1.5rem' },
  hero:  { textAlign: 'center', marginBottom: '3.5rem' },
  title: { fontSize: '2.75rem', fontWeight: 800, color: '#e2e4ec', marginBottom: '0.75rem', letterSpacing: '-0.02em' },
  sub:   { fontSize: '1.05rem', color: '#8b8fa8', marginBottom: '2rem' },
  actions: { display: 'flex', gap: '0.75rem', justifyContent: 'center' },
  btnPrimary: { backgroundColor: '#6366f1', borderRadius: '6px', color: '#fff', fontSize: '0.95rem', fontWeight: 600, padding: '0.65rem 1.75rem', textDecoration: 'none', display: 'inline-block' },
  btnGhost: { border: '1px solid #2a2d3a', borderRadius: '6px', color: '#8b8fa8', fontSize: '0.95rem', fontWeight: 500, padding: '0.65rem 1.75rem', textDecoration: 'none', display: 'inline-block' },
  grid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
  card:  { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', padding: '1.5rem', textAlign: 'center' },
  icon:  { fontSize: '1.75rem', display: 'block', marginBottom: '0.65rem' },
  cardTitle: { fontSize: '0.95rem', fontWeight: 600, color: '#e2e4ec', marginBottom: '0.4rem' },
  cardText: { fontSize: '0.85rem', color: '#8b8fa8', margin: 0 },
};

function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#e2e4ec', marginBottom: '0.75rem' }}>404</h1>
      <p style={{ color: '#8b8fa8', marginBottom: '1.5rem' }}>Page not found.</p>
      <a href="/" style={{ color: '#6366f1', fontWeight: 500 }}>← Back to home</a>
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

import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface FormFields { email: string; password: string; }
interface FieldErrors { email?: string; password?: string; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f: FormFields): FieldErrors {
  const e: FieldErrors = {};
  if (!f.email.trim()) e.email = 'El correo electrónico es requerido';
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Formato de correo inválido';
  if (!f.password) e.password = 'La contraseña es requerida';
  return e;
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const registered = (location.state as { registered?: boolean } | null)?.registered === true;

  const [fields, setFields] = useState<FormFields>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFields(p => ({ ...p, [name]: value }));
    setFieldErrors(p => ({ ...p, [name]: undefined }));
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(fields);
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setBusy(true);
    try {
      await login(fields.email.trim(), fields.password);
      const stored = localStorage.getItem('qa_token');
      let role = 'student';
      if (stored) {
        try { role = JSON.parse(atob(stored.split('.')[1])).role ?? 'student'; } catch { /* ignore */ }
      }
      navigate(role === 'admin' ? '/admin/levels' : '/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      if (msg.includes('Invalid email or password') || msg.includes('INVALID_CREDENTIALS'))
        setFormError('Correo o contraseña incorrectos');
      else if (msg.includes('Invalid email format'))
        setFieldErrors({ email: 'Formato de correo inválido' });
      else setFormError(msg);
    } finally { setBusy(false); }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoArea}>
          <img src="/logo.png" alt="QueryArena" style={s.logoImg} />
          <h1 style={s.title}>Iniciar sesión</h1>
          <p style={s.subtitle}>Bienvenido de nuevo a QueryArena</p>
        </div>

        {registered && (
          <div style={s.success} role="status">
            ✓ Cuenta creada exitosamente. ¡Ya puedes iniciar sesión!
          </div>
        )}
        {formError && <div style={s.error} role="alert">⚠ {formError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <Field label="Correo electrónico" id="email" type="email" name="email"
            value={fields.email} onChange={handleChange}
            error={fieldErrors.email} disabled={busy} autoComplete="email" />
          <Field label="Contraseña" id="password" type="password" name="password"
            value={fields.password} onChange={handleChange}
            error={fieldErrors.password} disabled={busy} autoComplete="current-password" />
          <button type="submit" style={{ ...s.btn, ...(busy ? s.btnBusy : {}) }} disabled={busy}>
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p style={s.footer}>
          ¿No tienes cuenta? <Link to="/register" style={s.link}>Regístrate aquí</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, id, type, name, value, onChange, error, disabled, autoComplete }: {
  label: string; id: string; type: string; name: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string; disabled?: boolean; autoComplete?: string;
}) {
  return (
    <div style={s.field}>
      <label htmlFor={id} style={s.label}>{label}</label>
      <input id={id} name={name} type={type} value={value} onChange={onChange}
        disabled={disabled} autoComplete={autoComplete}
        style={{ ...s.input, ...(error ? s.inputErr : {}) }} />
      {error && <span style={s.fieldErr} role="alert">{error}</span>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #fdf4ff 100%)', padding: '1rem' },
  card:     { backgroundColor: '#fff', border: '1px solid #e0e7ff', borderRadius: '12px', padding: '2.5rem', width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(99,102,241,0.12)' },
  logoArea: { textAlign: 'center', marginBottom: '1.75rem' },
  logoImg: { width: '72px', height: '72px', objectFit: 'contain' as const, marginBottom: '0.5rem', borderRadius: '12px' },
  title:    { margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: 800, color: '#1e1b4b' },
  subtitle: { margin: 0, fontSize: '0.875rem', color: '#6b7280' },
  success:  { backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', color: '#15803d', fontSize: '0.875rem', marginBottom: '1.25rem', padding: '0.75rem 1rem' },
  error:    { backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#dc2626', fontSize: '0.875rem', marginBottom: '1.25rem', padding: '0.75rem 1rem' },
  field:    { display: 'flex', flexDirection: 'column', marginBottom: '1.1rem' },
  label:    { fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: '#374151' },
  input:    { backgroundColor: '#f9fafb', border: '1.5px solid #d1d5db', borderRadius: '6px', color: '#111827', fontSize: '0.95rem', outline: 'none', padding: '0.6rem 0.85rem', transition: 'border-color 0.15s' },
  inputErr: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  fieldErr: { color: '#ef4444', fontSize: '0.78rem', marginTop: '0.3rem' },
  btn:      { background: 'linear-gradient(90deg, #4f46e5, #7c3aed)', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, marginTop: '0.75rem', padding: '0.7rem 1rem', width: '100%', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' },
  btnBusy:  { opacity: 0.7, cursor: 'not-allowed' },
  footer:   { fontSize: '0.875rem', marginTop: '1.5rem', textAlign: 'center', color: '#6b7280' },
  link:     { color: '#4f46e5', fontWeight: 600, textDecoration: 'none' },
};

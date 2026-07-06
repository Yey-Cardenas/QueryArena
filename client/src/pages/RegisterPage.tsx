import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface FormFields { username: string; email: string; password: string; }
interface FieldErrors { username?: string; email?: string; password?: string; }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(f: FormFields): FieldErrors {
  const e: FieldErrors = {};
  if (!f.username.trim()) e.username = 'Username is required';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!EMAIL_RE.test(f.email.trim())) e.email = 'Invalid email format';
  if (!f.password) e.password = 'Password is required';
  else if (f.password.length < 8) e.password = 'Password must be at least 8 characters';
  return e;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fields, setFields] = useState<FormFields>({ username: '', email: '', password: '' });
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
      await register(fields.username.trim(), fields.email.trim(), fields.password);
      navigate('/login', { state: { registered: true } });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      if (msg.includes('Username is already taken')) setFieldErrors({ username: 'Username is already taken' });
      else if (msg.includes('Email is already registered')) setFieldErrors({ email: 'Email is already registered' });
      else if (msg.includes('Password must be at least 8 characters')) setFieldErrors({ password: 'Password must be at least 8 characters' });
      else if (msg.includes('Invalid email format')) setFieldErrors({ email: 'Invalid email format' });
      else setFormError(msg);
    } finally { setBusy(false); }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Create account</h1>
        {formError && <div style={s.error} role="alert">{formError}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <Field label="Username" id="username" type="text" name="username"
            value={fields.username} onChange={handleChange} error={fieldErrors.username} disabled={busy} autoComplete="username" />
          <Field label="Email" id="email" type="email" name="email"
            value={fields.email} onChange={handleChange} error={fieldErrors.email} disabled={busy} autoComplete="email" />
          <Field label="Password" id="password" type="password" name="password"
            value={fields.password} onChange={handleChange} error={fieldErrors.password} disabled={busy} autoComplete="new-password" />
          <button type="submit" style={s.btn} disabled={busy}>
            {busy ? 'Creating account…' : 'Register'}
          </button>
        </form>
        <p style={s.footer}>Already have an account? <Link to="/login" style={s.link}>Sign in</Link></p>
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
      {error && <span style={s.fieldErr}>{error}</span>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1117', padding: '1rem' },
  card:     { backgroundColor: '#1a1d27', border: '1px solid #2a2d3a', borderRadius: '8px', padding: '2rem', width: '100%', maxWidth: '380px' },
  title:    { margin: '0 0 1.5rem', fontSize: '1.4rem', fontWeight: 700, color: '#e2e4ec', textAlign: 'center' },
  error:    { backgroundColor: '#2a0f0f', border: '1px solid #7f1d1d', borderRadius: '4px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem', padding: '0.65rem' },
  field:    { display: 'flex', flexDirection: 'column', marginBottom: '1rem' },
  label:    { fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.3rem', color: '#8b8fa8', textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:    { backgroundColor: '#12151f', border: '1px solid #2a2d3a', borderRadius: '4px', color: '#e2e4ec', fontSize: '0.95rem', outline: 'none', padding: '0.55rem 0.75rem' },
  inputErr: { borderColor: '#ef4444' },
  fieldErr: { color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem' },
  btn:      { backgroundColor: '#6366f1', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.5rem', padding: '0.6rem 1rem', width: '100%' },
  footer:   { fontSize: '0.85rem', marginTop: '1.25rem', textAlign: 'center', color: '#8b8fa8' },
  link:     { color: '#6366f1' },
};

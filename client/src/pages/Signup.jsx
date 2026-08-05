import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/ui/Toast.jsx';
import { ChartLineUp } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

export default function Signup() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', displayName: '' });

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error(t('validation.passwordMin'));
      return;
    }
    setLoading(true);
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      const code = err.response?.data?.error?.code;
      const msg = code ? t(`errors.${code}`, { defaultValue: err.response?.data?.error?.message }) : t('auth.signupFailed');
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-action text-white">
            <ChartLineUp size={25} weight="fill" aria-hidden="true" />
          </span>
          <h1 className="mt-3 text-2xl font-bold text-primary">TradingLog</h1>
          <p className="mt-1 text-sm text-muted">{t('auth.createJournal')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">{t('common.displayName')}</label>
            <input
              type="text"
              className="input"
              placeholder={t('auth.namePlaceholder')}
              value={form.displayName}
              onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <label className="label">{t('auth.emailLabel')}</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="label">{t('auth.passwordLabel')}</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
              minLength={8}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
            {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          {t('auth.alreadyAccount')}{' '}
          <Link to="/login" className="text-action hover:text-action-hover">
            {t('auth.signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}

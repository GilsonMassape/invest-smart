import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  getCurrentSession,
  onAuthStateChange,
  signInWithMagicLink,
  signOut,
} from '../services/auth';

type AuthGateProps = {
  children: React.ReactNode;
};

export const AuthGate = ({ children }: AuthGateProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await getCurrentSession();

      if (mounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    };

    loadSession();

    const { data: subscription } = onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setMessage('');

    const { error } = await signInWithMagicLink(email);

    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Link de acesso enviado para seu e-mail.');
    }

    setSending(false);
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return <div className="page">Carregando autenticação...</div>;
  }

  if (!session) {
    return (
      <main className="page">
        <section className="card" style={{ maxWidth: 520, margin: '48px auto' }}>
          <div className="card-header">
            <div>
              <p className="eyebrow">Invest Smart</p>
              <h2>Entrar no Invest Smart</h2>
              <p className="muted">
                Use seu e-mail para receber um link seguro de acesso.
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="preferences-panel">
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                required
              />
            </label>

            <button type="submit" disabled={sending}>
              {sending ? 'Enviando...' : 'Receber link de acesso'}
            </button>

            {message ? <p className="muted">{message}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <div>
          <strong>{session.user.email}</strong>
          <div className="muted">Sessão autenticada</div>
        </div>

        <button onClick={handleLogout}>Sair</button>
      </div>

      {children}
    </>
  );
};
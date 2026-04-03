import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TOPIC_OPTIONS = [
  'Technology & AI',
  'Climate Change',
  'Education Reform',
  'Economic Policy',
  'Ethics & Philosophy',
  'Healthcare',
  'General'
];

const FEATURE_CARDS = [
  { icon: 'Ghost', label: 'Ghost Mode', desc: 'Debate anonymously when you want low-pressure practice.' },
  { icon: 'ELO', label: 'Smart Matchmaking', desc: 'Get paired with opponents closer to your current level.' },
  { icon: 'AI', label: 'AI Coaching', desc: 'Review clarity, vocabulary, and rebuttal quality after each room.' },
  { icon: 'RTC', label: 'Voice and Video', desc: 'Switch between text, audio, and live camera debates.' }
];

export default function AuthPage({ mode = 'login' }) {
  const { login, register, verification, verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(mode);
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    rememberMe: true,
    preferredMode: 'text',
    preferredLanguage: 'English',
    preferredTopics: ['General'],
    verificationCode: ''
  });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (verification?.code) {
      setForm((current) => ({ ...current, verificationCode: verification.code }));
      setInfo(`Demo verification code: ${verification.code}`);
    }
  }, [verification]);

  const setField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const toggleTopic = (topic) => {
    setForm((current) => {
      const exists = current.preferredTopics.includes(topic);
      const nextTopics = exists
        ? current.preferredTopics.filter((item) => item !== topic)
        : [...current.preferredTopics, topic];
      return { ...current, preferredTopics: nextTopics.length ? nextTopics : ['General'] };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      if (tab === 'login') {
        await login(form.email, form.password, form.rememberMe);
      } else {
        if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');
        await register({
          username: form.username,
          email: form.email,
          password: form.password,
          preferredMode: form.preferredMode,
          preferredLanguage: form.preferredLanguage,
          preferredTopics: form.preferredTopics
        }, form.rememberMe);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const submitVerification = async (event) => {
    event.preventDefault();
    setError('');
    setInfo('');
    try {
      const email = verification?.email || form.email;
      await verifyEmail(email, form.verificationCode);
      setInfo('Email verified successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify email');
    }
  };

  const refreshVerification = async () => {
    setError('');
    setInfo('');
    try {
      const email = verification?.email || form.email;
      const response = await resendVerification(email);
      setInfo(response.verificationCode ? `Demo verification code: ${response.verificationCode}` : response.message);
      setForm((current) => ({ ...current, verificationCode: response.verificationCode || current.verificationCode }));
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend verification code');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-grid">
        <aside className="auth-aside">
          <div className="auth-brand">
            <div className="badge badge-blue" style={{ marginBottom: 18 }}>Debate platform</div>
            <div className="auth-wordmark">
              DIAL<span style={{ color: 'var(--accent)' }}>ECT</span>
            </div>
            <p className="auth-copy">
              Debate-based Intelligent Adaptive Learning and Evaluation with a calmer layout, more breathing room, and a sharper path into each match.
            </p>
            <p className="auth-microcopy">
              Build confidence in text rooms, move into voice or video when ready, and keep your identity flexible with Ghost Mode.
            </p>
          </div>

          <div className="auth-feature-grid">
            {FEATURE_CARDS.map((item) => (
              <div key={item.label} className="auth-feature-card">
                <div className="auth-feature-kicker">{item.icon}</div>
                <div className="auth-feature-title">{item.label}</div>
                <div className="auth-feature-desc">{item.desc}</div>
              </div>
            ))}
          </div>
        </aside>

        <div className="auth-panel">
          <div className="segmented-control" style={{ display: 'flex', width: '100%' }}>
            {['login', 'register'].map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => { setTab(entry); setError(''); setInfo(''); }}
                className={`segmented-button ${tab === entry ? 'active' : ''}`}
                style={{ flex: 1, textTransform: 'capitalize' }}
              >
                {entry === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <div className="card auth-card fade-in">
            <div className="auth-heading">
              <h1>{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1>
              <p>
                {tab === 'login'
                  ? 'Sign in and continue your next debate session.'
                  : 'Pick your preferences now. You can change them later from your profile.'}
              </p>
            </div>

            <form onSubmit={submit}>
              <div className="auth-fields">
                {tab === 'register' && (
                  <>
                    <div className="field">
                      <label>Username</label>
                      <input className="input" type="text" placeholder="your_handle" value={form.username} onChange={setField('username')} required minLength={3} maxLength={30} />
                    </div>

                    <div className="auth-row">
                      <div className="field">
                        <label>Preferred Mode</label>
                        <select className="input" value={form.preferredMode} onChange={setField('preferredMode')}>
                          <option value="text">Text</option>
                          <option value="voice">Voice</option>
                          <option value="video">Video</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Preferred Language</label>
                        <input className="input" type="text" value={form.preferredLanguage} onChange={setField('preferredLanguage')} placeholder="English" />
                      </div>
                    </div>

                    <div className="field">
                      <label>Favourite Topics</label>
                      <div className="chip-group">
                        {TOPIC_OPTIONS.map((topic) => (
                          <button
                            key={topic}
                            type="button"
                            className={`chip-button ${form.preferredTopics.includes(topic) ? 'active' : ''}`}
                            onClick={() => toggleTopic(topic)}
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="field">
                  <label>{tab === 'login' ? 'Email or Username' : 'Email'}</label>
                  <input
                    className="input"
                    type={tab === 'login' ? 'text' : 'email'}
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={setField('email')}
                    required
                  />
                </div>

                <div className="field">
                  <label>Password</label>
                  <input className="input" type="password" placeholder="At least 8 chars + a number" value={form.password} onChange={setField('password')} required minLength={8} />
                </div>

                {tab === 'register' && (
                  <div className="field">
                    <label>Confirm Password</label>
                    <input className="input" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={setField('confirmPassword')} required minLength={8} />
                  </div>
                )}
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, marginBottom: 22, fontSize: 13, color: 'var(--text2)' }}>
                <input
                  type="checkbox"
                  checked={form.rememberMe}
                  onChange={(event) => setForm((current) => ({ ...current, rememberMe: event.target.checked }))}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Keep me signed in on this device
              </label>

              {error && (
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--red-dim)', border: '1px solid #e05c5c30', borderRadius: 12, color: 'var(--red)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {info && (
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--green-dim)', border: '1px solid #2ecc8730', borderRadius: 12, color: 'var(--green)', fontSize: 13 }}>
                  {info}
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                {loading ? (
                  <span className="spin" style={{ width: 16, height: 16, border: '2px solid #ffffff44', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block' }} />
                ) : tab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {verification && (
              <form onSubmit={submitVerification} style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  Email verification is enabled for this environment.
                </div>
                <input className="input" type="text" placeholder="Verification code" value={form.verificationCode} onChange={setField('verificationCode')} style={{ marginBottom: 12 }} />
                <div className="button-row">
                  <button type="submit" className="btn btn-ghost">Verify Email</button>
                  <button type="button" className="btn btn-ghost" onClick={refreshVerification}>Resend Code</button>
                </div>
              </form>
            )}

            {tab === 'register' && (
              <p style={{ marginTop: 18, fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                New accounts start in <span style={{ color: 'var(--text2)' }}>Ghost Mode</span> with 1000 ELO
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

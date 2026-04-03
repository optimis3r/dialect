import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

function Stat({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {sub ? <div className="stat-card__sub">{sub}</div> : null}
    </div>
  );
}

function DetailRows({ items, emptyText }) {
  if (!items?.length) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>{emptyText}</div>;
  }

  return items.map((entry, index) => (
    <div key={entry.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '12px 0', borderBottom: index === items.length - 1 ? 'none' : '1px solid var(--border)' }}>
      <span>{entry.key}</span>
      <span style={{ color: 'var(--text2)', textAlign: 'right' }}>{entry.debates} debates / avg {entry.avgScore}</span>
    </div>
  ));
}

export default function ProfilePage() {
  const { user, updateProfile, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id');
  const isOwnProfile = !profileId || profileId === user?._id;
  const [profile, setProfile] = useState(user);
  const [form, setForm] = useState({ username: '', bio: '', avatar: '', preferredMode: 'text', preferredLanguage: 'English', preferredTopics: '' });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      setError('');
      try {
        const data = isOwnProfile
          ? (await api.get('/auth/me')).data.user
          : (await api.get(`/auth/profile/${profileId}`)).data.user;
        if (!mounted) return;
        setProfile(data);
        setForm({
          username: data.username || '',
          bio: data.bio || '',
          avatar: data.avatar || '',
          preferredMode: data.preferredMode || 'text',
          preferredLanguage: data.preferredLanguage || 'English',
          preferredTopics: (data.preferredTopics || []).join(', ')
        });
      } catch (err) {
        if (mounted) setError(err.response?.data?.message || 'Could not load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => { mounted = false; };
  }, [isOwnProfile, profileId]);

  const winRate = useMemo(() => {
    if (!profile?.totalDebates) return 0;
    return Math.round((profile.wins / profile.totalDebates) * 100);
  }, [profile]);

  const saveProfile = async () => {
    setMessage('');
    setError('');
    try {
      const updated = await updateProfile({
        username: form.username,
        bio: form.bio,
        avatar: form.avatar,
        preferredMode: form.preferredMode,
        preferredLanguage: form.preferredLanguage,
        preferredTopics: form.preferredTopics.split(',').map((item) => item.trim()).filter(Boolean)
      });
      setProfile(updated);
      await refreshUser();
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update profile');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spin" style={{ width: 38, height: 38, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="page">
        <Navbar />
        <div className="container page-shell">
          <div className="card" style={{ color: 'var(--red)' }}>{error}</div>
        </div>
      </div>
    );
  }

  const displayName = profile?.mode === 'ghost' ? profile?.ghostAlias : profile?.username;

  return (
    <div className="page">
      <Navbar />
      <div className="container page-shell">
        <div className="page-hero">
          <div>
            <div className="page-kicker">{isOwnProfile ? 'Your profile' : 'Public profile'}</div>
            <h1 className="page-title">{displayName}</h1>
            <p className="page-subtitle">
              {profile?.bio || (profile?.mode === 'ghost'
                ? 'This debater is currently shielded by Ghost Mode.'
                : 'No profile bio added yet.')}
            </p>
          </div>
          <div className="button-row">
            <span className="badge badge-blue">{profile?.eloRating} ELO</span>
            <span className={`badge ${profile?.mode === 'ghost' ? 'badge-amber' : 'badge-green'}`}>
              {profile?.mode === 'ghost' ? 'Ghost' : 'Public'}
            </span>
          </div>
        </div>

        <div className="stat-grid" style={{ marginBottom: 28 }}>
          <Stat label="Debates" value={profile?.totalDebates || 0} />
          <Stat label="Wins" value={profile?.wins || 0} sub={`${winRate}% win rate`} />
          <Stat label="Losses" value={profile?.losses || 0} />
          <Stat label="Draws" value={profile?.draws || 0} />
          <Stat label="Average Vocab" value={profile?.avgVocabScore || '-'} />
        </div>

        <div className="content-grid">
          <div className="section-stack">
            <div className="card">
              <div className="section-label">Badges</div>
              {profile?.badges?.length ? (
                <div className="chip-group">
                  {profile.badges.map((badge) => (
                    <span key={badge.id} className="chip-button active" style={{ cursor: 'default' }}>
                      {badge.label}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>No badges earned yet.</div>
              )}
            </div>

            <div className="card">
              <div className="section-label">Topic performance</div>
              <DetailRows items={profile?.topicStats} emptyText="No topic data yet." />
            </div>

            <div className="card">
              <div className="section-label">Language performance</div>
              <DetailRows items={profile?.languageStats} emptyText="No language data yet." />
            </div>
          </div>

          <div className="sidebar-stack">
            <div className="card">
              <div className="section-label">
                {isOwnProfile ? 'Edit profile' : 'Preferences'}
              </div>
              {isOwnProfile ? (
                <>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Username</label>
                    <input className="input" value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Bio</label>
                    <textarea className="input" value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} rows={4} />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Avatar URL</label>
                    <input className="input" value={form.avatar} onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))} placeholder="https://..." />
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Preferred Mode</label>
                    <select className="input" value={form.preferredMode} onChange={(event) => setForm((current) => ({ ...current, preferredMode: event.target.value }))}>
                      <option value="text">Text</option>
                      <option value="voice">Voice</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  <div className="field" style={{ marginBottom: 12 }}>
                    <label>Preferred Language</label>
                    <input className="input" value={form.preferredLanguage} onChange={(event) => setForm((current) => ({ ...current, preferredLanguage: event.target.value }))} />
                  </div>
                  <div className="field" style={{ marginBottom: 14 }}>
                    <label>Preferred Topics</label>
                    <input className="input" value={form.preferredTopics} onChange={(event) => setForm((current) => ({ ...current, preferredTopics: event.target.value }))} placeholder="Technology & AI, Ethics & Philosophy" />
                  </div>
                  {message ? <div style={{ color: 'var(--green)', fontSize: 12, marginBottom: 10 }}>{message}</div> : null}
                  {error ? <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 10 }}>{error}</div> : null}
                  <button className="btn btn-primary btn-block" onClick={saveProfile}>Save Profile</button>
                </>
              ) : (
                <>
                  <div style={{ color: 'var(--text2)', marginBottom: 10 }}>
                    Preferred language: <strong style={{ color: 'var(--text)' }}>{profile?.preferredLanguage || 'Hidden'}</strong>
                  </div>
                  <div style={{ color: 'var(--text2)', marginBottom: 10 }}>Favourite topics:</div>
                  <div className="chip-group">
                    {(profile?.preferredTopics || []).length
                      ? profile.preferredTopics.map((topic) => <span key={topic} className="chip-button active" style={{ cursor: 'default' }}>{topic}</span>)
                      : <span style={{ color: 'var(--muted)', fontSize: 13 }}>No public preferences shared.</span>}
                  </div>
                </>
              )}
            </div>

            {isOwnProfile && (
              <div className="card">
                <div className="section-label">Vocabulary log</div>
                {profile?.vocabularyLog?.length ? profile.vocabularyLog.map((entry, index) => (
                  <div key={entry.word} style={{ padding: '12px 0', borderBottom: index === profile.vocabularyLog.length - 1 ? 'none' : '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700 }}>{entry.word}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{(entry.replacements || []).slice(0, 3).join(', ')}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{entry.definition}</div>
                  </div>
                )) : <div style={{ color: 'var(--muted)', fontSize: 13 }}>Your AI vocabulary log will grow after more debates.</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

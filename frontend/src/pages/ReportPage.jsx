import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';
import { API_URL } from '../config';

function ScoreRing({ value, label, color = 'var(--accent)' }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={96} height={96} viewBox="0 0 96 96">
        <circle cx={48} cy={48} r={radius} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle
          cx={48}
          cy={48}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
        <text x={48} y={48} textAnchor="middle" dominantBaseline="central" style={{ fill: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
          {value}
        </text>
      </svg>
      <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function SectionCard({ title, items, emptyText = 'Nothing captured yet.' }) {
  return (
    <div className="card">
      <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>{title}</div>
      {items?.length ? items.map((item, index) => (
        <div key={`${title}-${index}`} style={{ padding: '10px 0', borderBottom: index === items.length - 1 ? 'none' : '1px solid var(--border)', color: 'var(--text2)' }}>
          {item}
        </div>
      )) : <div style={{ color: 'var(--muted)' }}>{emptyText}</div>}
    </div>
  );
}

export default function ReportPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedInsight, setSelectedInsight] = useState(null);

  useEffect(() => {
    api.get(`/debate/report/${roomId}`)
      .then((response) => setData(response.data))
      .catch((err) => setError(err.response?.data?.message || 'Report not found'))
      .finally(() => setLoading(false));
  }, [roomId]);

  const report = data?.report;
  const side = data?.side;
  const session = data?.session;
  const aiStatus = data?.aiStatus;
  const aiError = data?.aiError;
  const isA = side === 'A';

  const myWordCloud = useMemo(() => (isA ? report?.wordCloudA : report?.wordCloudB) || [], [isA, report]);
  const myInsights = useMemo(() => (isA ? report?.wordInsightsA : report?.wordInsightsB) || [], [isA, report]);
  const myTips = useMemo(() => (isA ? report?.improvementTipsA : report?.improvementTipsB) || [], [isA, report]);
  const myStrengths = useMemo(() => (isA ? report?.strengthsA : report?.strengthsB) || [], [isA, report]);
  const myWeakPoints = useMemo(() => (isA ? report?.weakPointsA : report?.weakPointsB) || [], [isA, report]);
  const myActionPlan = useMemo(() => (isA ? report?.actionPlanA : report?.actionPlanB) || [], [isA, report]);
  const myLex = isA ? report?.lexicalDiversityA : report?.lexicalDiversityB;
  const myVocab = isA ? report?.vocabScoreA : report?.vocabScoreB;
  const mySentiment = isA ? report?.sentimentA : report?.sentimentB;
  const mySummary = isA ? report?.summaryA : report?.summaryB;
  const mySpeakingShare = isA ? report?.speakingShareA : report?.speakingShareB;
  const myEloChange = isA ? session?.eloChangeA : session?.eloChangeB;
  const myArgumentQuality = isA ? report?.argumentQualityA : report?.argumentQualityB;
  const myRebuttalQuality = isA ? report?.rebuttalQualityA : report?.rebuttalQualityB;
  const myClarity = isA ? report?.clarityA : report?.clarityB;
  const myPersuasiveness = isA ? report?.persuasivenessA : report?.persuasivenessB;
  const myEvidenceUse = isA ? report?.evidenceUseA : report?.evidenceUseB;
  const myCoaching = isA ? report?.coachingA : report?.coachingB;
  const myArgumentFeedback = isA ? report?.argumentFeedbackA : report?.argumentFeedbackB;
  const myRebuttalFeedback = isA ? report?.rebuttalFeedbackA : report?.rebuttalFeedbackB;
  const myClarityFeedback = isA ? report?.clarityFeedbackA : report?.clarityFeedbackB;
  const myPersuasivenessFeedback = isA ? report?.persuasivenessFeedbackA : report?.persuasivenessFeedbackB;
  const myComposite = isA ? report?.compositeScoreA : report?.compositeScoreB;

  const copyShareLink = async () => {
    try {
      const response = await api.post(`/debate/report/${roomId}/share`);
      const link = `${API_URL}/api/debate/report/share/${response.data.shareToken}`;
      await navigator.clipboard.writeText(link);
      setCopied('Public report link copied to clipboard.');
    } catch {
      setCopied('Could not generate a share link right now.');
    }
  };

  if (loading) {
    return (
      <div className="page">
        <Navbar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spin" style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Navbar />
        <div className="container" style={{ padding: '32px 24px' }}>
          <div className="card" style={{ color: 'var(--red)' }}>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <div className="container" style={{ padding: '32px 24px', flex: 1, maxWidth: 1080 }}>
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', gap: 16, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>AI Performance Report</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{session?.topic}</h1>
            <div className="button-row">
              <span className="badge badge-blue">{session?.mode}</span>
              <span className="badge badge-blue">{session?.language}</span>
              {session?.matchType === 'human-vs-ai' ? <span className="badge badge-amber">AI Practice</span> : null}
              {!session?.isRated ? <span className="badge badge-amber">Unrated</span> : null}
              <span className={`badge ${session?.winner === side ? 'badge-green' : session?.winner === 'draw' ? 'badge-amber' : 'badge-red'}`}>
                {session?.winner === side ? 'Won' : session?.winner === 'draw' ? 'Draw' : 'Lost'}
              </span>
              {session?.isRated ? (
                <span className={`badge ${myEloChange >= 0 ? 'badge-green' : 'badge-red'}`}>{myEloChange >= 0 ? '+' : ''}{myEloChange} ELO</span>
              ) : null}
              <span className="badge badge-blue">{report?.provider || 'local-nlp'}</span>
            </div>
          </div>
          <div className="button-row">
            <button className="btn btn-ghost" onClick={copyShareLink}>Copy Share Link</button>
            <button className="btn btn-primary" onClick={() => navigate(session?.matchType === 'human-vs-ai' ? '/lobby?opponent=ai' : '/lobby')}>
              New Debate
            </button>
          </div>
        </div>

        {copied ? (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--green-dim)', border: '1px solid #2ecc8730', borderRadius: 6, color: 'var(--green)', fontSize: 13 }}>
            {copied}
          </div>
        ) : null}

        {report?.fallbackUsed || aiError ? (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--amber-dim)', border: '1px solid #d4912a30', borderRadius: 6, color: 'var(--amber)', fontSize: 13, lineHeight: 1.6 }}>
            {report?.fallbackUsed
              ? `Free local coaching was used${report.fallbackReason ? `: ${report.fallbackReason}` : '.'}`
              : `Report warning: ${aiError}`}
          </div>
        ) : null}

        {!report ? (
          <div className="card" style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ color: 'var(--text2)', marginBottom: 8 }}>
              {aiStatus === 'failed' ? 'The richer AI report could not be completed.' : 'AI report is still being generated...'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Refresh in a moment if this debate has just ended.</div>
          </div>
        ) : (
          <>
            <div className="card" style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>Your Score Snapshot</div>
              <div style={{ display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
                <ScoreRing value={myComposite ?? 0} label="Composite" color="var(--accent)" />
                <ScoreRing value={myArgumentQuality ?? 0} label="Arguments" color="var(--green)" />
                <ScoreRing value={myRebuttalQuality ?? 0} label="Rebuttals" color="var(--amber)" />
                <ScoreRing value={myClarity ?? 0} label="Clarity" color="var(--accent2)" />
                <ScoreRing value={myPersuasiveness ?? 0} label="Persuasion" color="var(--green)" />
                <ScoreRing value={myEvidenceUse ?? 0} label="Evidence" color="var(--amber)" />
              </div>
            </div>

            <div className="button-row" style={{ alignItems: 'stretch' }}>
              <div style={{ flex: 2, minWidth: 340 }}>
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Summary</div>
                  <p style={{ color: 'var(--text)', lineHeight: 1.7, marginBottom: 12 }}>{mySummary}</p>
                  <div style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 8 }}>Tone: <strong style={{ color: 'var(--text)' }}>{mySentiment}</strong></div>
                  {myCoaching ? <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>Coach note: {myCoaching}</div> : null}
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Debate Verdict</div>
                  <div style={{ color: 'var(--text)', lineHeight: 1.7, marginBottom: 12 }}>{report.overallSummary || report.verdictReason}</div>
                  <div style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>{report.verdictReason}</div>
                </div>

                <SectionCard title="Debate Highlights" items={report.debateHighlights || []} emptyText="Highlights are still being prepared." />

                <div className="button-row" style={{ alignItems: 'stretch', marginTop: 20 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <SectionCard title="Strengths" items={myStrengths} emptyText="No strengths captured yet." />
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <SectionCard title="Improvement Tips" items={myTips} emptyText="No improvement tips available yet." />
                  </div>
                </div>

                <div className="button-row" style={{ alignItems: 'stretch', marginTop: 20 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <SectionCard title="Weak Points" items={myWeakPoints} emptyText="No weak points were flagged." />
                  </div>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <SectionCard title="Action Plan" items={myActionPlan} emptyText="No action plan available yet." />
                  </div>
                </div>

                <div className="card" style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Coach Breakdown</div>
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Argument Quality</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{myArgumentFeedback || 'No detailed argument feedback yet.'}</div>
                  </div>
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Rebuttal Quality</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{myRebuttalFeedback || 'No detailed rebuttal feedback yet.'}</div>
                  </div>
                  <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Clarity</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{myClarityFeedback || 'No clarity feedback yet.'}</div>
                  </div>
                  <div style={{ padding: '10px 0' }}>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Persuasiveness</div>
                    <div style={{ color: 'var(--text2)', lineHeight: 1.6 }}>{myPersuasivenessFeedback || 'No persuasiveness feedback yet.'}</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 300 }}>
                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Core Metrics</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {[
                      ['Lexical Diversity', myLex],
                      ['Vocabulary Score', myVocab],
                      ['Speaking Share', mySpeakingShare],
                      ['Argument Quality', myArgumentQuality],
                      ['Rebuttal Quality', myRebuttalQuality],
                      ['Evidence Use', myEvidenceUse]
                    ].map(([label, value]) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--text2)', fontSize: 13 }}>{label}</span>
                        <strong>{value ?? 0}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Word Cloud</div>
                  {myWordCloud.length ? (
                    <div className="chip-group">
                      {myWordCloud.map((entry) => (
                        <button
                          key={entry.word}
                          type="button"
                          className={`chip-button ${selectedInsight?.word === entry.word ? 'active' : ''}`}
                          onClick={() => setSelectedInsight(myInsights.find((item) => item.word === entry.word) || null)}
                        >
                          {entry.word} ({entry.count})
                        </button>
                      ))}
                    </div>
                  ) : <div style={{ color: 'var(--muted)' }}>No vocabulary cloud available.</div>}
                </div>

                <div className="card" style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Word Insights</div>
                  {myInsights.length ? myInsights.map((insight) => (
                    <button
                      key={insight.word}
                      type="button"
                      onClick={() => setSelectedInsight(insight)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 0', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'inherit' }}
                    >
                      <div style={{ fontWeight: 600 }}>{insight.word}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{(insight.replacements || []).slice(0, 3).join(', ')}</div>
                    </button>
                  )) : <div style={{ color: 'var(--muted)' }}>No weak-word insights detected.</div>}
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Insight Detail</div>
                  {selectedInsight ? (
                    <>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{selectedInsight.word}</div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>{selectedInsight.definition}</div>
                      <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 8 }}>
                        Better alternatives: {(selectedInsight.replacements || []).join(', ')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)' }}>Example: {selectedInsight.example}</div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--muted)' }}>Select a word insight to see replacement ideas, a definition, and an example.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

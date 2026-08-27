import { useState } from 'react';
import { API_BASE } from './apiConfig';
import { useAuth } from './AuthContext';

export default function ResultsView({ data, onReset, onBackToDashboard, isLoggedIn }) {
  const { userContext, systemScores, flags, geminiAnalysis } = data;
  const { user } = useAuth() || {};

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [targetEmail, setTargetEmail] = useState(user?.email || '');
  const [emailStatus, setEmailStatus] = useState('idle'); // idle | sending | success | error
  const [emailMessage, setEmailMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  const getScoreInfo = (val) => {
    let score = val;
    let status = 'SCORED';

    if (typeof val === 'object' && val !== null) {
      score = val.score;
      status = val.status;
    }

    if (status === 'NOT_TESTED' || score === null || score === undefined) {
      return { isNotTested: true, scoreDisplay: 'Not Tested', colorClass: 'text-muted-warm', label: '' };
    }

    const numScore = Number(score);
    if (numScore >= 80) return { isNotTested: false, scoreDisplay: `${numScore}/100`, colorClass: 'text-status-pass', label: 'Optimal' };
    if (numScore >= 60) return { isNotTested: false, scoreDisplay: `${numScore}/100`, colorClass: 'text-status-warn', label: 'Borderline' };
    return { isNotTested: false, scoreDisplay: `${numScore}/100`, colorClass: 'text-status-fail', label: 'Needs Attention' };
  };

  const getStatusColor = (status) => {
    if (status === 'PASS') return 'text-status-pass';
    if (status === 'HIGH' || status === 'LOW') return 'text-status-fail';
    return 'text-status-warn';
  };

  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!targetEmail) return;

    setEmailStatus('sending');
    setEmailMessage('');
    setPreviewUrl(null);

    try {
      const token = localStorage.getItem('hemoflow_token');
      const res = await fetch(`${API_BASE}/api/reports/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ toEmail: targetEmail, reportData: data })
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to send email report.');

      setEmailStatus('success');
      setEmailMessage(resData.message);
      if (resData.previewUrl) setPreviewUrl(resData.previewUrl);
    } catch (err) {
      setEmailStatus('error');
      setEmailMessage(err.message);
    }
  };

  return (
    <div className="d-flex flex-column gap-4">
      {/* Patient Header Card */}
      <div className="card-clean p-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div>
          <h2 className="h4 fw-bold mb-1" style={{ color: '#1A1A1A' }}>{userContext.name || 'Patient Report'}</h2>
          <div className="text-muted-warm small d-flex flex-wrap gap-3">
            <span>Age: <strong style={{ color: '#1A1A1A' }}>{userContext.age || 'N/A'}</strong></span>
            <span>Sex: <strong style={{ color: '#1A1A1A', textTransform: 'capitalize' }}>{userContext.sex}</strong></span>
            <span>Status: <strong style={{ color: '#1A1A1A' }}>{userContext.fasting ? 'Fasting' : 'Non-Fasting'}</strong></span>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {isLoggedIn && onBackToDashboard && (
            <button onClick={onBackToDashboard} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Dashboard
            </button>
          )}
          <button 
            onClick={() => { setShowEmailModal(true); setTargetEmail(user?.email || ''); }}
            className="btn btn-outline-teal btn-sm d-inline-flex align-items-center gap-1"
          >
            ✉️ Email Report
          </button>
          <button onClick={onReset} className="btn btn-teal btn-sm">
            Analyze Another Report
          </button>
        </div>
      </div>

      {/* Email Report Modal / Inline Banner */}
      {showEmailModal && (
        <div className="card-clean p-4 border-teal animate-fade-in" style={{ backgroundColor: '#F4FBFB', borderLeft: '4px solid #1B6E6E' }}>
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h4 className="h6 fw-bold m-0" style={{ color: '#1B6E6E' }}>✉️ Email Blood Analysis Report</h4>
            <button onClick={() => setShowEmailModal(false)} className="btn-close btn-sm" aria-label="Close"></button>
          </div>
          <p className="small text-muted-warm mb-3">
            Send a formatted HTML summary of this blood panel, system scores, and AI reasoning directly to an email address.
          </p>

          <form onSubmit={handleSendEmail} className="d-flex flex-column flex-sm-row gap-2 align-items-stretch">
            <input
              type="email"
              required
              className="form-control form-control-sm flex-grow-1"
              placeholder="Enter target email address..."
              value={targetEmail}
              onChange={(e) => setTargetEmail(e.target.value)}
              disabled={emailStatus === 'sending'}
            />
            <button 
              type="submit" 
              className="btn btn-teal btn-sm text-nowrap"
              disabled={emailStatus === 'sending'}
            >
              {emailStatus === 'sending' ? 'Sending Mail...' : 'Send Report Email'}
            </button>
          </form>

          {emailMessage && (
            <div className={`mt-3 small p-2.5 rounded ${emailStatus === 'success' ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-danger-subtle text-danger border border-danger-subtle'}`}>
              <div>{emailMessage}</div>
              {previewUrl && (
                <div className="mt-1">
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="fw-bold text-decoration-underline" style={{ color: '#0D9488' }}>
                    🔗 Click here to preview Ethereal test email output
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* System Health Scores */}
      <div className="card-clean p-4">
        <div className="mb-3 pb-2 border-bottom">
          <h3 className="h6 fw-bold m-0 text-uppercase tracking-wider" style={{ color: '#1A1A1A', fontSize: '0.85rem' }}>
            System Scores
          </h3>
        </div>
        <div className="row g-3">
          {Object.entries(systemScores || {}).map(([system, val]) => {
            const { isNotTested, scoreDisplay, colorClass, label } = getScoreInfo(val);
            return (
              <div key={system} className="col-6 col-md-3">
                <div className="p-3 rounded-2 border text-center h-100 d-flex flex-column justify-content-between" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E6E1' }}>
                  <div className="text-muted-warm small fw-medium text-capitalize mb-2">
                    {system.replace('_', ' ')}
                  </div>
                  {isNotTested ? (
                    <div className="my-auto text-muted-warm font-medium" style={{ fontSize: '1.05rem', padding: '0.5rem 0' }}>
                      Not Tested
                    </div>
                  ) : (
                    <>
                      <div className={`display-6 num-tabular mb-1 ${colorClass}`}>
                        {scoreDisplay}
                      </div>
                      <div className={`status-label ${colorClass}`}>
                        {label}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deterministic Biomarker Flags Table */}
      <div className="card-clean p-4">
        <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
          <h3 className="h6 fw-bold m-0 text-uppercase tracking-wider" style={{ color: '#1A1A1A', fontSize: '0.85rem' }}>
            Biomarker Flag Results
          </h3>
          <span className="small text-muted-warm num-tabular">
            {flags?.length || 0} Flagged
          </span>
        </div>

        {!flags || flags.length === 0 ? (
          <div className="p-3 rounded-2 border text-status-pass" style={{ backgroundColor: '#F4F9F5', borderColor: '#D2E7D7', fontSize: '0.9rem' }}>
            All evaluated biomarkers are within optimal reference ranges.
          </div>
        ) : (
          <div className="border rounded-2 overflow-hidden" style={{ borderColor: '#E8E6E1' }}>
            {/* Header row */}
            <div className="flag-table-row text-muted-warm small fw-semibold bg-light" style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <div>Biomarker</div>
              <div>Result</div>
              <div>Ref Range</div>
              <div className="text-end">Status</div>
            </div>

            {/* Item rows */}
            {flags.map((item, idx) => (
              <div key={idx} className="flag-table-row">
                <div className="fw-semibold text-capitalize" style={{ color: '#1A1A1A' }}>
                  {item.name.replace('_', ' ')}
                </div>
                <div className="num-tabular" style={{ color: '#1A1A1A' }}>
                  {item.value !== null ? `${item.value} ${item.unit || ''}` : 'N/A'}
                </div>
                <div className="num-tabular text-muted-warm small">
                  {item.range ? `${item.range.low} – ${item.range.high}` : 'N/A'}
                </div>
                <div className={`text-end fw-semibold ${getStatusColor(item.status)}`} style={{ fontSize: '0.88rem' }}>
                  {item.status} {item.deviationPct ? `(${item.deviationPct}% dev)` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Cross-Marker Pattern Analysis */}
      <div className="card-clean p-4">
        <div className="mb-3 pb-2 border-bottom">
          <h3 className="h6 fw-bold m-0 text-uppercase tracking-wider" style={{ color: '#1A1A1A', fontSize: '0.85rem' }}>
            Cross-Marker Pattern Analysis
          </h3>
        </div>

        {geminiAnalysis?.summary && (
          <p className="mb-4" style={{ color: '#1A1A1A', fontSize: '0.98rem', lineHeight: '1.65' }}>
            {geminiAnalysis.summary}
          </p>
        )}

        <div className="d-flex flex-column gap-3">
          {geminiAnalysis?.patterns?.map((p, i) => (
            <div key={i} className="p-3.5 rounded-2 border" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E6E1', padding: '1.15rem' }}>
              <h4 className="h6 fw-bold mb-2" style={{ color: '#1A1A1A' }}>{p.title}</h4>
              <div className="text-muted-warm small mb-2" style={{ fontSize: '0.82rem' }}>
                Associated Markers: <span className="fw-medium" style={{ color: '#1B6E6E' }}>{p.markers?.join(', ')}</span>
              </div>
              <p className="m-0" style={{ color: '#5A5A56', fontSize: '0.92rem', lineHeight: '1.6' }}>{p.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Next Steps */}
      <div className="card-clean p-4">
        <div className="mb-3 pb-2 border-bottom">
          <h3 className="h6 fw-bold m-0 text-uppercase tracking-wider" style={{ color: '#1A1A1A', fontSize: '0.85rem' }}>
            Suggested Next Steps
          </h3>
        </div>

        <ol className="m-0 ps-3" style={{ color: '#1A1A1A', fontSize: '0.95rem', lineHeight: '1.7' }}>
          {geminiAnalysis?.next_steps?.map((step, i) => (
            <li key={i} className="mb-2 last-mb-0">{step}</li>
          ))}
        </ol>
      </div>

      {/* Medical Disclaimer */}
      <div className="text-center pt-2 pb-4">
        <p className="text-muted-warm small m-0" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
          This automated analysis is intended for informational purposes only and does not constitute a medical diagnosis.
        </p>
      </div>
    </div>
  );
}

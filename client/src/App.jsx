import { useState } from 'react';
import UploadForm from './UploadForm';
import ResultsView from './ResultsView';

export default function App() {
  const [result, setResult] = useState(null);

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: '840px' }}>
      {/* Clean Brand Header */}
      <div className="text-center mb-5">
        <div className="d-inline-block px-3 py-1 mb-2 rounded-2" style={{ backgroundColor: '#EBF4F4', color: '#1B6E6E', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Blood Intelligence
        </div>
        <h1 className="h2 fw-bold tracking-tight mb-2" style={{ color: '#1A1A1A' }}>Hemoflow</h1>
        <p className="text-muted-warm small max-w-md mx-auto mb-0" style={{ fontSize: '0.92rem' }}>
          Deterministic Blood Report Analysis & AI Biomarker Reasoning
        </p>
      </div>

      {!result ? (
        <UploadForm onSuccess={setResult} />
      ) : (
        <ResultsView data={result} onReset={() => setResult(null)} />
      )}
    </div>
  );
}

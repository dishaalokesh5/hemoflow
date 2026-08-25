import { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Navbar from './Navbar';
import UploadForm from './UploadForm';
import ResultsView from './ResultsView';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import Dashboard from './Dashboard';

function MainApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('new-analysis'); // 'new-analysis' | 'dashboard' | 'login' | 'register'
  const [result, setResult] = useState(null);

  const handleAnalysisSuccess = (data) => {
    setResult(data);
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
    setResult(null);
  };

  const handleSelectHistoricalReport = (storedData) => {
    setResult(storedData);
  };

  return (
    <div className="container py-4 py-md-5" style={{ maxWidth: '840px' }}>
      <Navbar activeTab={activeTab} onNavigate={handleNavigate} />

      {/* Clean Sub-header / Brand Title when on form views */}
      {activeTab === 'new-analysis' && !result && (
        <div className="text-center mb-5">
          <div className="d-inline-block px-3 py-1 mb-2 rounded-2" style={{ backgroundColor: '#EBF4F4', color: '#1B6E6E', fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Blood Intelligence
          </div>
          <h1 className="h2 fw-bold tracking-tight mb-2" style={{ color: '#1A1A1A' }}>Hemoflow</h1>
          <p className="text-muted-warm small max-w-md mx-auto mb-0" style={{ fontSize: '0.92rem' }}>
            Deterministic Blood Report Analysis & AI Biomarker Reasoning
          </p>
        </div>
      )}

      {/* View router */}
      {result ? (
        <ResultsView
          data={result}
          onBackToDashboard={() => {
            setResult(null);
            setActiveTab('dashboard');
          }}
          onReset={() => {
            setResult(null);
            setActiveTab(user ? 'dashboard' : 'new-analysis');
          }}
          isLoggedIn={!!user}
        />
      ) : activeTab === 'login' ? (
        <LoginForm
          onSuccess={() => setActiveTab('dashboard')}
          onSwitchToRegister={() => setActiveTab('register')}
        />
      ) : activeTab === 'register' ? (
        <RegisterForm
          onSuccess={() => setActiveTab('dashboard')}
          onSwitchToLogin={() => setActiveTab('login')}
        />
      ) : activeTab === 'dashboard' && user ? (
        <Dashboard
          onSelectReport={handleSelectHistoricalReport}
          onNewAnalysis={() => handleNavigate('new-analysis')}
        />
      ) : (
        <UploadForm onSuccess={handleAnalysisSuccess} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

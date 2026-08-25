import { useAuth } from './AuthContext';

export default function Navbar({ activeTab, onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <header className="mb-4 pb-3 border-bottom">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
        {/* Brand */}
        <div className="d-flex align-items-center gap-2 cursor-pointer" onClick={() => onNavigate('new-analysis')} style={{ cursor: 'pointer' }}>
          <div className="px-2.5 py-1 rounded-2 fw-bold text-white" style={{ backgroundColor: '#1B6E6E', fontSize: '0.9rem' }}>
            HF
          </div>
          <span className="h5 fw-bold mb-0 tracking-tight" style={{ color: '#1A1A1A' }}>
            Hemoflow
          </span>
        </div>

        {/* Navigation Links */}
        <div className="d-flex align-items-center gap-2">
          <button
            className={`btn btn-sm ${activeTab === 'new-analysis' ? 'btn-teal' : 'btn-outline-secondary border-0'}`}
            onClick={() => onNavigate('new-analysis')}
          >
            New Analysis
          </button>

          {user ? (
            <>
              <button
                className={`btn btn-sm ${activeTab === 'dashboard' ? 'btn-teal' : 'btn-outline-secondary border-0'}`}
                onClick={() => onNavigate('dashboard')}
              >
                Dashboard
              </button>

              <span className="text-muted-warm small ms-2 me-1 d-none d-md-inline" style={{ fontSize: '0.82rem' }}>
                {user.email}
              </span>

              <button
                className="btn btn-sm btn-outline-danger ms-1"
                onClick={() => {
                  logout();
                  onNavigate('new-analysis');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                className={`btn btn-sm ${activeTab === 'login' ? 'btn-teal' : 'btn-outline-secondary border-0'}`}
                onClick={() => onNavigate('login')}
              >
                Login
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'register' ? 'btn-teal' : 'btn-outline-secondary border-0'}`}
                onClick={() => onNavigate('register')}
              >
                Register
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

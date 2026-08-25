import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function LoginForm({ onSuccess, onSwitchToRegister }) {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  return (
    <div className="card-clean p-4 mx-auto" style={{ maxWidth: '440px' }}>
      <div className="mb-4 text-center">
        <h2 className="h5 fw-bold mb-1" style={{ color: '#1A1A1A' }}>Welcome Back</h2>
        <p className="text-muted-warm small mb-0">Sign in to access your report history</p>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-2 border" style={{ backgroundColor: '#FDF2F2', borderColor: '#F8D7DA', color: '#C1442E', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label text-muted-warm small fw-semibold">Email Address</label>
          <input
            type="email"
            className="form-control form-control-clean"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
          />
        </div>

        <div className="mb-4">
          <label className="form-label text-muted-warm small fw-semibold">Password</label>
          <input
            type="password"
            className="form-control form-control-clean"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          className="btn btn-teal w-100 py-2.5 d-flex align-items-center justify-content-center gap-2 mb-3"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>Signing In...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        <div className="text-center text-muted-warm small">
          Don't have an account?{' '}
          <button
            type="button"
            className="btn btn-link p-0 text-decoration-none fw-semibold"
            style={{ color: '#1B6E6E', fontSize: '0.88rem' }}
            onClick={onSwitchToRegister}
          >
            Create Account
          </button>
        </div>
      </form>
    </div>
  );
}

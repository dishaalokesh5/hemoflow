import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE } from './apiConfig';

export default function Dashboard({ onSelectReport, onNewAnalysis }) {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewLoadingId, setViewLoadingId] = useState(null);

  const fetchReports = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load report history.');
      setReports(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleView = async (id) => {
    setViewLoadingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/reports/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch report.');
      onSelectReport(data.analysis_data);
    } catch (err) {
      alert(`Error viewing report: ${err.message}`);
    } finally {
      setViewLoadingId(null);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/reports/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete report.');
      setReports(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      alert(`Error deleting report: ${err.message}`);
    }
  };

  const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    const date = new Date(isoStr);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="card-clean p-4">
      <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom">
        <div>
          <h2 className="h5 fw-bold m-0" style={{ color: '#1A1A1A' }}>Report History</h2>
          <p className="text-muted-warm small mb-0">View and manage your saved blood report analyses</p>
        </div>
        <button onClick={onNewAnalysis} className="btn btn-teal btn-sm">
          + New Analysis
        </button>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-2 border" style={{ backgroundColor: '#FDF2F2', borderColor: '#F8D7DA', color: '#C1442E', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-teal" role="status">
            <span className="visually-hidden">Loading history...</span>
          </div>
          <p className="text-muted-warm small mt-2">Loading your reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-5 border rounded-2" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E6E1' }}>
          <h3 className="h6 fw-semibold text-muted-warm mb-2">No Reports Saved Yet</h3>
          <p className="text-muted-warm small mb-3">Upload your first blood test PDF to analyze and save your results.</p>
          <button onClick={onNewAnalysis} className="btn btn-teal btn-sm">
            Analyze A Report
          </button>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr className="text-muted-warm small text-uppercase" style={{ fontSize: '0.78rem', letterSpacing: '0.04em' }}>
                <th style={{ backgroundColor: '#FAFAF8', borderBottomColor: '#E8E6E1' }}>Report File</th>
                <th style={{ backgroundColor: '#FAFAF8', borderBottomColor: '#E8E6E1' }}>Date Analyzed</th>
                <th style={{ backgroundColor: '#FAFAF8', borderBottomColor: '#E8E6E1' }}>Status</th>
                <th className="text-end" style={{ backgroundColor: '#FAFAF8', borderBottomColor: '#E8E6E1' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <div className="fw-semibold text-truncate" style={{ maxWidth: '240px', color: '#1A1A1A' }}>
                      {report.original_filename}
                    </div>
                  </td>
                  <td className="text-muted-warm small num-tabular">
                    {formatDate(report.created_at)}
                  </td>
                  <td>
                    <span className="badge rounded-pill bg-success-subtle text-success px-2.5 py-1" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {report.status}
                    </span>
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-teal me-2"
                      onClick={() => handleView(report.id)}
                      disabled={viewLoadingId === report.id}
                    >
                      {viewLoadingId === report.id ? 'Loading...' : 'View'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(report.id, report.original_filename)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

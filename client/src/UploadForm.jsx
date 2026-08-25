import { useState } from 'react';
import { useAuth } from './AuthContext';
import { API_BASE } from './apiConfig';

export default function UploadForm({ onSuccess }) {
  const { token } = useAuth();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('male');
  const [fasting, setFasting] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a PDF report file.');
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('age', age);
    formData.append('sex', sex);
    formData.append('fasting', fasting);
    formData.append('pdf', file);

    try {
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="card-clean p-4">
      <div className="mb-4 pb-2 border-bottom">
        <h5 className="h6 fw-bold m-0 text-uppercase tracking-wider" style={{ color: '#1A1A1A', fontSize: '0.85rem' }}>
          Upload Report
        </h5>
      </div>

      {error && (
        <div className="p-3 mb-4 rounded-2 border" style={{ backgroundColor: '#FDF2F2', borderColor: '#F8D7DA', color: '#C1442E', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Patient Name */}
        <div className="mb-3">
          <label className="form-label text-muted-warm small fw-semibold">Full Name</label>
          <input
            type="text"
            className="form-control form-control-clean"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. John Doe"
            required
          />
        </div>

        {/* Age & Sex Grid */}
        <div className="row g-3 mb-3">
          <div className="col-md-6">
            <label className="form-label text-muted-warm small fw-semibold">Age</label>
            <input
              type="number"
              className="form-control form-control-clean"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 30"
              required
            />
          </div>
          <div className="col-md-6">
            <label className="form-label text-muted-warm small fw-semibold">Biological Sex</label>
            <select className="form-select form-select-clean" value={sex} onChange={e => setSex(e.target.value)}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Fasting Checkbox */}
        <div className="mb-4">
          <div className="p-3 rounded-2 border d-flex align-items-center justify-content-between" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E6E1' }}>
            <label className="form-check-label text-muted-warm small mb-0 pe-2" htmlFor="fastingSwitch">
              Fasting before blood draw
            </label>
            <input
              className="form-check-input ms-0"
              type="checkbox"
              role="switch"
              id="fastingSwitch"
              checked={fasting}
              onChange={e => setFasting(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* PDF File Upload */}
        <div className="mb-4">
          <label className="form-label text-muted-warm small fw-semibold">Blood Test PDF Report</label>
          <input
            type="file"
            className="form-control form-control-clean"
            accept=".pdf"
            onChange={e => setFile(e.target.files[0])}
            required
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-teal w-100 py-2.5 d-flex align-items-center justify-content-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              <span>Analyzing Report...</span>
            </>
          ) : (
            <span>Analyze PDF Report</span>
          )}
        </button>
      </form>
    </div>
  );
}

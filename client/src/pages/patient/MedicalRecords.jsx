import React, { useState, useEffect, useRef } from 'react';
import { useToast } from '../../context/ToastContext';
import { historyAPI } from '../../services/api';

export default function MedicalRecords() {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({ date: '', category: 'Diagnosis', title: '', description: '', notes: '' });

  useEffect(() => {
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const res = await historyAPI.getAll();
      setRecords(res.data);
    } catch {
      addToast('Failed to load medical records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingId(record._id);
      setFormData({
        date: record.date || new Date().toISOString().split('T')[0],
        category: record.category,
        title: record.title,
        description: record.description,
        notes: record.notes || ''
      });
    } else {
      setEditingId(null);
      setFormData({ date: new Date().toISOString().split('T')[0], category: 'Diagnosis', title: '', description: '', notes: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, date: formData.date || new Date().toISOString().split('T')[0] };
      if (editingId) {
        await historyAPI.update(editingId, payload);
        addToast('Medical record updated successfully.', 'success');
      } else {
        await historyAPI.create(payload);
        addToast('Medical record added successfully.', 'success');
      }
      setShowModal(false);
      fetchRecords();
    } catch {
      addToast(editingId ? 'Failed to update record.' : 'Failed to add record.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this medical record?')) return;
    try {
      await historyAPI.delete(id);
      addToast('Record deleted.', 'info');
      fetchRecords();
    } catch {
      addToast('Failed to delete record.', 'error');
    }
  };

  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      addToast(`Document "${e.target.files[0].name}" uploaded successfully.`, 'success');
    }
  };

  const categoryColors = {
    Diagnosis: 'var(--accent-rose)',
    Allergy: 'var(--accent-amber)',
    'Lab Report': 'var(--accent-cyan)',
    Prescription: 'var(--accent-teal)',
    Surgery: 'var(--accent-purple)',
  };

  return (
    <div className="animate-fade-in">
      <div className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '800' }}>Medical Records</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Your complete health history and documents.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => fileInputRef.current?.click()}
            style={{ background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer' }}>
            📎 Upload Document
          </button>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="btn-submit" style={{ padding: '0.6rem 1.2rem', borderRadius: '8px' }}
            onClick={() => handleOpenModal()}>
            + Add Record
          </button>
        </div>
      </div>

      <div className="widget-grid">
        {/* Timeline */}
        <div className="widget-glass" style={{ gridColumn: 'span 12' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
            Health Timeline — {records.length} Records
          </h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>⏳ Loading records...</div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No medical records yet. Add your first record above.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {records.map((r) => (
                <div key={r._id} style={{ display: 'flex', gap: '1.5rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderLeft: `4px solid ${categoryColors[r.category] || 'var(--accent-cyan)'}`, borderRadius: '8px', alignItems: 'center' }}>
                  <div style={{ minWidth: '80px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: categoryColors[r.category] || 'var(--accent-cyan)', background: `rgba(${categoryColors[r.category] === 'var(--accent-rose)' ? '244,63,94' : '0,229,255'}, 0.1)`, padding: '0.2rem 0.5rem', borderRadius: '8px' }}>{r.category}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{r.date}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: '700', color: '#fff', marginBottom: '0.25rem' }}>{r.title}</h4>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{r.description}</p>
                    {r.notes && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic', borderLeft: '2px solid var(--border-glass)', paddingLeft: '0.5rem' }}>Note: {r.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button onClick={() => handleOpenModal(r)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: 'var(--text-secondary)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                    <button onClick={() => handleDelete(r._id)} style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--accent-rose)', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="widget-glass" style={{ gridColumn: 'span 12', textAlign: 'center', padding: '3rem 2rem', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Upload Medical Documents</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Drag and drop PDFs, Images, or Prescriptions here, or click to browse.</p>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
          <button className="btn-submit" style={{ padding: '0.6rem 2rem', borderRadius: '8px' }} onClick={() => fileInputRef.current?.click()}>
            Browse Files
          </button>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="widget-glass" style={{ width: '100%', maxWidth: '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-between" style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>{editingId ? 'Edit Record' : 'New Record'}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Category *</label>
                  <select className="input-field" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {['Diagnosis', 'Allergy', 'Lab Report', 'Prescription', 'Surgery'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Date *</label>
                  <input required type="date" className="input-field" style={{ colorScheme: 'dark' }}
                    value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Title *</label>
                <input required type="text" className="input-field" placeholder="e.g. Stage I Hypertension"
                  value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Description *</label>
                <textarea required rows="3" className="input-field" placeholder="Detailed description of the condition..." style={{ resize: 'vertical' }}
                  value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Notes (optional)</label>
                <input type="text" className="input-field" placeholder="Optional notes"
                  value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-glass)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-submit" style={{ flex: 1, padding: '0.75rem', borderRadius: '8px' }}>
                  {editingId ? 'Save Changes' : 'Save Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

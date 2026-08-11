import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getReports, createReport, deleteReport } from '../api';
import { PlusCircle, FileText, ChevronRight, Trash2 } from 'lucide-react';

export default function Home() {
  const [reports, setReports] = useState([]);
  const [newReportName, setNewReportName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await getReports();
      setReports(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newReportName) return;
    setLoading(true);
    try {
      const res = await createReport(newReportName);
      navigate(`/report/${res.data.id}`);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="title">Rendiciones Online</h1>
      
      <div className="glass-card">
        <h2>Nueva Rendición</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>
          Crea un nuevo grupo para cuadrar cuentas.
        </p>
        <form onSubmit={handleCreate}>
          <input
            type="text"
            placeholder="Ej: Viaje a la playa"
            value={newReportName}
            onChange={(e) => setNewReportName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            <PlusCircle size={20} />
            {loading ? 'Creando...' : 'Crear Rendición'}
          </button>
        </form>
      </div>

      <div className="glass-card">
        <h2>Rendiciones Activas</h2>
        <ul className="item-list">
          {reports.map((report) => (
            <li key={report.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileText size={20} style={{ color: 'var(--primary)' }} />
                <div>
                  <div style={{ fontWeight: '600' }}>{report.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {report.status === 'closed' && <span className="badge closed">Cerrada</span>}
                {report.status === 'open' && <span className="badge">Abierta</span>}
                <button 
                  className="btn" 
                  style={{ background: 'transparent', color: 'var(--danger)', padding: '8px', width: 'auto' }} 
                  onClick={async () => {
                     if (window.confirm('¿Seguro que quieres eliminar esta rendición y todos sus datos?')) {
                        try {
                           await deleteReport(report.id);
                           fetchReports();
                        } catch (err) {
                           alert('Error al eliminar');
                        }
                     }
                  }}
                  title="Eliminar Rendición"
                >
                  <Trash2 size={18} />
                </button>
                <Link to={`/report/${report.id}`} style={{ color: 'white', textDecoration: 'none' }}>
                  <button className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%' }}>
                    <ChevronRight size={16} />
                  </button>
                </Link>
              </div>
            </li>
          ))}
          {reports.length === 0 && (
             <p style={{ color: 'var(--text-muted)', textAlign: 'center', margin: '20px 0' }}>
               No hay rendiciones. Crea la primera arriba.
             </p>
          )}
        </ul>
      </div>
    </div>
  );
}

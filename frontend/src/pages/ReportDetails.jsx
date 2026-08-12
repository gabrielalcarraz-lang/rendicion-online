import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getReport, closeReport, getSettlement } from '../api';
import { ArrowLeft, Upload, CheckCircle, Trash2, Camera, User } from 'lucide-react';
import localforage from 'localforage';

export default function ReportDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Store local images here: { receipt_id: 'base64_string' }
  const [localImages, setLocalImages] = useState({});

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [reportRes, settlementRes] = await Promise.all([
         getReport(id),
         getSettlement(id)
      ]);
      const reportData = reportRes.data;
      setReport(reportData);
      setSettlement(settlementRes.data);
      
      // Load local images
      if (reportData.receipts) {
        const imageMap = {};
        for (const receipt of reportData.receipts) {
          if (receipt.image_path === 'local_storage') {
            const base64 = await localforage.getItem(`receipt_${receipt.id}`);
            if (base64) {
              imageMap[receipt.id] = base64;
            }
          }
        }
        setLocalImages(imageMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm("¿Seguro que quieres cuadrar y cerrar esta rendición? Las fotos locales serán borradas permanentemente de este dispositivo.")) return;
    try {
      await closeReport(id);
      
      // Delete all local images associated with this report
      if (report && report.receipts) {
        for (const receipt of report.receipts) {
          if (receipt.image_path === 'local_storage') {
            await localforage.removeItem(`receipt_${receipt.id}`);
          }
        }
      }
      
      fetchData(); // refresh
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{textAlign: 'center', marginTop: '50px'}}><div className="loader"></div></div>;
  if (!report) return <div>Reporte no encontrado</div>;

  const isClosed = report.status === 'closed';

  return (
    <div className="animate-fade-in">
      <div className="nav-bar">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="title" style={{ margin: 0, flex: 1, textAlign: 'center' }}>{report.name}</h1>
        {isClosed && <span className="badge closed" style={{ marginRight: '10px' }}>Cerrada</span>}
        <button 
          className="btn" 
          style={{ background: 'transparent', color: 'var(--danger)', padding: '8px', width: 'auto' }} 
          onClick={async () => {
             if (window.confirm('¿Seguro que quieres eliminar esta rendición y todos sus datos permanentemente?')) {
                try {
                   const { deleteReport } = await import('../api');
                   await deleteReport(id);
                   navigate('/');
                } catch (err) {
                   alert('Error al eliminar');
                }
             }
          }}
          title="Eliminar Rendición"
        >
          <Trash2 size={24} />
        </button>
      </div>

      <div className="glass-card settlement-card">
        <h2>Resumen de Totales</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>
          Sumatoria de impuestos y montos finales de las boletas.
        </p>
        
        <ul className="item-list">
          <li>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
               <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '50%' }}>
                 <CheckCircle size={20} />
               </div>
               <div style={{ textAlign: 'left' }}>
                 <div style={{ fontWeight: '600', fontSize: '1.1rem' }}>Monto Final Total</div>
               </div>
            </div>
            <div className="amount-positive">
               ${report.receipts?.reduce((sum, r) => sum + (r.total_amount || 0), 0).toFixed(0) || 0}
            </div>
          </li>
        </ul>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2>Boletas ({report.receipts?.length || 0})</h2>
          {!isClosed && (
            <button className="btn btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={() => navigate(`/report/${id}/upload`)}>
              <Camera size={18} /> Añadir
            </button>
          )}
        </div>
        
        <ul className="item-list">
          {report.receipts?.map(receipt => (
             <li key={receipt.id} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{receipt.name || `Boleta #${receipt.id}`}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pagado por: {receipt.paid_by || 'No especificado'}</div>
                    </div>
                    {!isClosed && (
                       <button 
                         className="btn" 
                         style={{ background: 'transparent', color: 'var(--danger)', padding: '6px', width: 'auto' }}
                         onClick={async () => {
                            if (window.confirm(`¿Estás seguro de eliminar la boleta "${receipt.name}"? Esta acción no se puede deshacer.`)) {
                               try {
                                  const { deleteReceipt } = await import('../api');
                                  await deleteReceipt(receipt.id);
                                  fetchData(); // Refresh the report data
                               } catch (err) {
                                  alert('Error al eliminar la boleta');
                               }
                            }
                         }}
                         title="Eliminar Boleta"
                       >
                         <Trash2 size={20} />
                       </button>
                    )}
                 </div>
                 
                 <div className="assignment-tags" style={{ marginTop: '10px', width: '100%', display: 'flex', flexDirection: 'column', gap: '15px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Monto Final Detectado:</div>
                       <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--success)' }}>${receipt.total_amount || 0}</div>
                    </div>
                    {receipt.image_path && receipt.image_path !== 'local_storage' && (
                       <div style={{ textAlign: 'center', marginTop: '5px' }}>
                          <a 
                            href={receipt.image_path.startsWith('http') ? receipt.image_path : `https://rendicion-online.onrender.com${receipt.image_path}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.9rem' }}
                          >
                             Ver fotografía de la boleta
                          </a>
                       </div>
                    )}
                    {receipt.image_path === 'local_storage' && localImages[receipt.id] && (
                       <div style={{ textAlign: 'center', marginTop: '5px' }}>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              const dataUrl = localImages[receipt.id];
                              const [header, base64] = dataUrl.split(',');
                              const mime = header.match(/:(.*?);/)[1];
                              const binary = atob(base64);
                              const array = new Uint8Array(binary.length);
                              for (let i = 0; i < binary.length; i++) {
                                array[i] = binary.charCodeAt(i);
                              }
                              const blob = new Blob([array], { type: mime });
                              const url = URL.createObjectURL(blob);
                              window.open(url, '_blank');
                            }}
                            style={{ 
                              color: 'var(--primary)', 
                              textDecoration: 'underline', 
                              fontSize: '0.9rem',
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer'
                            }}
                          >
                             Ver fotografía local (se borrará al cuadrar)
                          </button>
                       </div>
                    )}
                 </div>
              </li>
          ))}
          {report.receipts?.length === 0 && (
             <p style={{ color: 'var(--text-muted)' }}>No has subido boletas aún.</p>
          )}
        </ul>
      </div>

      {!isClosed && (
        <button className="btn btn-success" style={{ marginTop: '20px' }} onClick={handleClose}>
          <CheckCircle size={20} />
          Cuadrar y Cerrar Rendición
        </button>
      )}
    </div>
  );
}

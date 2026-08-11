import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { uploadReceipt, updateReceipt, getReceiptNames } from '../api';
import { ArrowLeft, Camera, CheckCircle } from 'lucide-react';

export default function UploadReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [name, setName] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [file, setFile] = useState(null);
  const [isManual, setIsManual] = useState(false);
  const [manualDetail, setManualDetail] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const [extractedData, setExtractedData] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [recentNames, setRecentNames] = useState([]);

  useEffect(() => {
     getReceiptNames().then(res => setRecentNames(res.data)).catch(console.error);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !paidBy) {
      alert("Por favor, ingresa el nombre de la boleta y quién pagó.");
      return;
    }
    if (!isManual && !file) {
      alert("Por favor, sube una foto de la boleta o elige ingreso manual.");
      return;
    }
    if (isManual && (!manualDetail || !manualAmount)) {
      alert("Por favor, completa el detalle y el monto manual.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('paid_by', paidBy);
      if (file) formData.append('receiptImage', file);
      if (isManual) {
        formData.append('manualDetail', manualDetail);
        formData.append('manualAmount', manualAmount);
      }

      const res = await uploadReceipt(id, formData);
      setExtractedData(res.data);
      setEditAmount(res.data.total_amount || 0);
    } catch (err) {
      console.error(err);
      alert("Hubo un error al procesar la boleta.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
     try {
        setLoading(true);
        if (editAmount !== extractedData.total_amount) {
           await updateReceipt(extractedData.id, editAmount);
        }
        navigate(`/report/${id}`);
     } catch (err) {
        console.error(err);
        alert("Hubo un error al confirmar.");
     } finally {
        setLoading(false);
     }
  };

  if (extractedData) {
     return (
       <div className="animate-fade-in">
         <div className="nav-bar">
           <button className="back-btn" onClick={() => navigate(-1)}>
             <ArrowLeft size={24} />
           </button>
           <h2 style={{ margin: 0 }}>Verificar Boleta</h2>
         </div>
         <div className="glass-card">
           <h3 style={{ textAlign: 'center', marginBottom: '20px' }}>Verifica el Monto Extraído</h3>
           
           {extractedData.image_path && (
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                 <img 
                   src={`http://localhost:3000${extractedData.image_path}`} 
                   alt="Boleta" 
                   style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} 
                 />
              </div>
           )}

           <label>Monto Final (Edita si es incorrecto)</label>
           <input 
             type="number" 
             value={editAmount} 
             onChange={e => setEditAmount(e.target.value)} 
             style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success)', textAlign: 'center' }}
           />

           <button className="btn btn-success" onClick={handleConfirm} disabled={loading} style={{ marginTop: '20px' }}>
             {loading ? 'Guardando...' : <><CheckCircle size={20} /> Confirmar y Guardar</>}
           </button>
         </div>
       </div>
     );
  }

  return (
    <div className="animate-fade-in">
      <div className="nav-bar">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Agregar Boleta</h2>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit}>
          <label>Nombre Identificatorio de la Boleta</label>
          <input 
            type="text" 
            list="recent-names"
            placeholder="Ej: Supermercado Lider" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          <datalist id="recent-names">
             {recentNames.map(n => <option key={n} value={n} />)}
          </datalist>

          <label>¿Quién pagó la boleta?</label>
          <select 
            value={paidBy} 
            onChange={e => setPaidBy(e.target.value)}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', marginBottom: '15px' }}
          >
            <option value="">Selecciona una persona...</option>
            <option value="Gabriel">Gabriel</option>
            <option value="Marjorie">Marjorie</option>
          </select>

          <div style={{ margin: '20px 0', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ fontSize: '1.1rem' }}>Detalle de Consumo</h3>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem' }}
                onClick={() => setIsManual(!isManual)}
              >
                {isManual ? 'Usar Foto/OCR' : 'Ingreso Manual (Sin Foto)'}
              </button>
            </div>

            {isManual ? (
              <div className="animate-fade-in">
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '10px' }}>
                  Ingresa un detalle general y el monto total en caso de que la boleta no tenga desglose.
                </p>
                <label>Detalle General Escrito</label>
                <input 
                  type="text" 
                  placeholder="Ej: Cuota asado general" 
                  value={manualDetail} 
                  onChange={e => setManualDetail(e.target.value)} 
                />
                
                <label>Monto Total ($)</label>
                <input 
                  type="number" 
                  placeholder="Ej: 25000" 
                  value={manualAmount} 
                  onChange={e => setManualAmount(e.target.value)} 
                />
              </div>
            ) : (
              <div className="animate-fade-in file-upload-wrapper">
                <div className="file-upload-btn">
                  <Camera size={40} style={{ marginBottom: '10px', color: 'var(--primary)' }} />
                  <div style={{ fontWeight: '600', color: 'white' }}>Toma una Foto o Sube la Boleta (Imagen o PDF)</div>
                  <div style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                    {file ? file.name : 'Se leerá el monto total automáticamente'}
                  </div>
                </div>
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  capture="environment" 
                  onChange={e => setFile(e.target.files[0])} 
                />
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? (
               <><div className="loader" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div> Procesando...</>
            ) : (
               <>Extraer Monto <ArrowLeft style={{ transform: 'rotate(180deg)' }} size={20} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

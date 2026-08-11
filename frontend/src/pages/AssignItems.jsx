import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReport, saveReceiptItems, extractRawText } from '../api';
import { ArrowLeft, Save, Plus, X, Users, Trash2, FileSearch } from 'lucide-react';

export default function AssignItems() {
  const { reportId, receiptId } = useParams();
  const navigate = useNavigate();
  
  const [receipt, setReceipt] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [newPerson, setNewPerson] = useState('');
  const [bulkPerson, setBulkPerson] = useState('');
  
  const [rawText, setRawText] = useState('');
  const [extracting, setExtracting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [reportId, receiptId]);

  const fetchData = async () => {
    try {
      const res = await getReport(reportId);
      const rec = res.data.receipts.find(r => r.id === parseInt(receiptId));
      if (rec) {
        setReceipt(rec);
        // Copy items so we can edit them
        setItems(JSON.parse(JSON.stringify(rec.items || [])));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    try {
      const res = await extractRawText(receiptId);
      setRawText(res.data.text || "No se pudo extraer texto.");
    } catch (err) {
      console.error(err);
      setRawText("Error al extraer los datos.");
    } finally {
      setExtracting(false);
    }
  };

  const handleAssign = (itemIndex, person) => {
    if (!person.trim()) return;
    const newItems = [...items];
    if (!newItems[itemIndex].assignments.includes(person)) {
      newItems[itemIndex].assignments.push(person);
      setItems(newItems);
    }
    setNewPerson('');
  };

  const handleRemoveAssign = (itemIndex, person) => {
    const newItems = [...items];
    newItems[itemIndex].assignments = newItems[itemIndex].assignments.filter(p => p !== person);
    setItems(newItems);
  };

  const handleBulkAssign = () => {
    if (!bulkPerson.trim()) return;
    const newItems = [...items];
    newItems.forEach(item => {
      if (!item.assignments.includes(bulkPerson)) {
        item.assignments.push(bulkPerson);
      }
    });
    setItems(newItems);
    setBulkPerson('');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveReceiptItems(receiptId, items);
      navigate(`/report/${reportId}`);
    } catch (err) {
      console.error(err);
      alert("Error al guardar.");
      setLoading(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleDeleteItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handleAddItem = () => {
    setItems([...items, { description: 'Nuevo Ítem', quantity: 1, unit_price: 0, amount: 0, assignments: [] }]);
  };

  if (loading) return <div style={{textAlign: 'center', marginTop: '50px'}}><div className="loader"></div></div>;
  if (!receipt) return <div>Boleta no encontrada</div>;

  return (
    <div className="animate-fade-in">
      <div className="nav-bar">
        <button className="back-btn" onClick={() => navigate(`/report/${reportId}`)}>
          <ArrowLeft size={24} />
        </button>
        <h2 style={{ margin: 0 }}>Asignar Ítems</h2>
      </div>

      <div className="glass-card" style={{ marginBottom: '15px' }}>
        <h3 style={{ marginBottom: '5px' }}>{receipt.name}</h3>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Pagado por: <strong>{receipt.paid_by}</strong></p>
        
        {receipt.image_path && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
             <button 
                className="btn btn-secondary" 
                onClick={handleExtract} 
                disabled={extracting}
             >
                <FileSearch size={18} />
                {extracting ? 'Leyendo documento...' : 'Extraer Detalle del Archivo'}
             </button>
             
             {rawText && (
               <div className="animate-fade-in" style={{ marginTop: '15px' }}>
                 <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Texto encontrado:</p>
                 <textarea 
                   readOnly 
                   value={rawText} 
                   style={{ width: '100%', height: '150px', background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '10px', fontSize: '0.85rem' }} 
                 />
                 <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '5px' }}>* Puedes copiar de aquí para agregar los ítems manualmente si faltó alguno.</p>
               </div>
             )}
          </div>
        )}

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <input 
            type="text" 
            placeholder="Nombre para todos los ítems" 
            value={bulkPerson}
            onChange={e => setBulkPerson(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={handleBulkAssign}>
            <Users size={18} /> Todos
          </button>
        </div>
      </div>

      {items.map((item, idx) => (
        <div key={idx} className="glass-card" style={{ padding: '15px' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <input 
              type="number" 
              placeholder="Cant."
              title="Cantidad"
              value={item.quantity || 1}
              onChange={e => {
                const qty = parseFloat(e.target.value) || 0;
                const newItems = [...items];
                newItems[idx].quantity = qty;
                newItems[idx].amount = qty * (newItems[idx].unit_price || 0);
                setItems(newItems);
              }}
              style={{ flex: '0 0 50px', marginBottom: 0, padding: '8px 4px', textAlign: 'center', fontSize: '0.85rem' }}
            />
            <input 
              type="text" 
              placeholder="Descripción"
              value={item.description}
              onChange={e => handleItemChange(idx, 'description', e.target.value)}
              style={{ flex: '1 1 120px', marginBottom: 0, padding: '8px', fontSize: '0.85rem' }}
            />
            <input 
              type="number" 
              placeholder="Precio U."
              title="Precio Unitario"
              value={item.unit_price || 0}
              onChange={e => {
                const up = parseFloat(e.target.value) || 0;
                const newItems = [...items];
                newItems[idx].unit_price = up;
                newItems[idx].amount = (newItems[idx].quantity || 1) * up;
                setItems(newItems);
              }}
              style={{ flex: '0 0 75px', marginBottom: 0, padding: '8px', fontSize: '0.85rem' }}
            />
            <input 
              type="number" 
              placeholder="Total"
              title="Total"
              value={item.amount}
              onChange={e => handleItemChange(idx, 'amount', e.target.value)}
              style={{ flex: '0 0 75px', marginBottom: 0, padding: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
            />
            <button className="btn" style={{ background: 'transparent', color: 'var(--danger)', flex: '0 0 40px', padding: '8px' }} onClick={() => handleDeleteItem(idx)}>
              <Trash2 size={18} />
            </button>
          </div>

          <div className="assignment-tags" style={{ marginBottom: '10px' }}>
            {item.assignments.map(person => (
               <span key={person} className="tag">
                 {person} 
                 <button onClick={() => handleRemoveAssign(idx, person)}><X size={12} /></button>
               </span>
            ))}
            {item.assignments.length === 0 && (
               <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sin asignar (lo asume quien pagó o se pierde)</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
             <input 
               type="text" 
               placeholder="Nuevo responsable" 
               id={`person-input-${idx}`}
               style={{ marginBottom: 0, padding: '6px 10px', fontSize: '0.9rem' }}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                    handleAssign(idx, e.target.value);
                    e.target.value = '';
                 }
               }}
             />
             <button 
                className="btn btn-secondary" 
                style={{ width: 'auto', padding: '6px 12px' }}
                onClick={() => {
                  const input = document.getElementById(`person-input-${idx}`);
                  handleAssign(idx, input.value);
                  input.value = '';
                }}
             >
               Añadir
             </button>
          </div>
        </div>
      ))}

      <button className="btn btn-secondary" style={{ marginBottom: '20px' }} onClick={handleAddItem}>
        <Plus size={18} /> Agregar Ítem Manual
      </button>

      <button className="btn btn-success" onClick={handleSave} disabled={loading}>
        <Save size={20} /> Guardar Asignaciones
      </button>
    </div>
  );
}

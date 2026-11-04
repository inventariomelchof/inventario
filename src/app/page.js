'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState('products')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')

  // Formulario de Productos (Nueva Lógica)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    barcode: '', 
    name: '', 
    presentation: '', 
    packageName: 'PAQUETE',
    packageUnits: '', 
    packageWeight: '', 
    weightUnit: 'g', 
    categoryId: '', 
    brandId: '',
    customUnits: []
  })

  // Crear Categorías/Marcas
  const [newCategory, setNewCategory] = useState('')
  const [newBrand, setNewBrand] = useState('')

  // Entradas y Salidas
  const [entryForm, setEntryForm] = useState({ productId: '', packages: '', units: '', expirationDate: '' })
  const [exitForm, setExitForm] = useState({ productId: '', packages: '', units: '', reason: 'Venta', deliveredBy: '', receivedBy: '' })
  const [cart, setCart] = useState([])
  const [transportType, setTransportType] = useState('Moto')
  const [maxWeight, setMaxWeight] = useState(1500)

  // Escáner
  const [showScanner, setShowScanner] = useState(false)
  const [scanMode, setScanMode] = useState('')

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); }
  }, [])

  useEffect(() => { if (status === 'unauthenticated') router.push('/login') }, [status, router])

  useEffect(() => {
    if (showScanner) {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          html5QrCode.stop().then(() => {
            setShowScanner(false);
            if (scanMode === 'search') { setSearchTerm(decodedText); setView('products'); } 
            else if (scanMode === 'form') { setFormData(prev => ({ ...prev, barcode: decodedText })); }
          }).catch(err => console.error(err));
        }, () => { }
      ).catch((err) => { alert("No se pudo iniciar la cámara: " + err); setShowScanner(false); });
      return () => { if(html5QrCode.isScanning) html5QrCode.stop().catch(e => console.log(e)); }
    }
  }, [showScanner, scanMode]);

  const fetchData = async () => {
    try {
      const [resP, resC, resB] = await Promise.all([
        fetch('/api/products'), fetch('/api/categories'), fetch('/api/brands')
      ])
      setProducts(await resP.json())
      setCategories(await resC.json())
      setBrands(await resB.json())
    } catch (error) { }
  }

  useEffect(() => { 
    if (status === 'authenticated') { fetchData() }
  }, [status])

  if (status === 'loading') return <div style={{ padding: '50px', textAlign: 'center' }}>Cargando sistema...</div>
  if (status === 'unauthenticated') return null

  // --- GESTIÓN DE CATEGORÍAS Y MARCAS ---
  const handleAddCategory = async (e) => {
    e.preventDefault()
    if(!newCategory) return
    const res = await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCategory }) })
    if(res.ok) { setNewCategory(''); fetchData(); } else { alert('La categoría ya existe o hubo un error') }
  }

  const handleAddBrand = async (e) => {
    e.preventDefault()
    if(!newBrand) return
    const res = await fetch('/api/brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newBrand }) })
    if(res.ok) { setNewBrand(''); fetchData(); } else { alert('La marca ya existe o hubo un error') }
  }

  // --- LÓGICA DE PRODUCTOS ---
  const addCustomUnit = () => setFormData({ ...formData, customUnits: [...formData.customUnits, { name: '', multiplier: '', weight: '' }] })
  const updateCustomUnit = (index, field, value) => {
    const newUnits = [...formData.customUnits]; newUnits[index][field] = value; setFormData({ ...formData, customUnits: newUnits })
  }
  const removeCustomUnit = (index) => setFormData({ ...formData, customUnits: formData.customUnits.filter((_, i) => i !== index) })

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    if(!formData.categoryId || !formData.brandId) return alert('Seleccione Categoría y Marca')
    
    const url = editingId ? `/api/products/${editingId}` : '/api/products'
    const method = editingId ? 'PUT' : 'POST'
    
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    
    setFormData({ barcode: '', name: '', presentation: '', packageName: 'PAQUETE', packageUnits: '', packageWeight: '', weightUnit: 'g', categoryId: '', brandId: '', customUnits: [] })
    setEditingId(null); setShowForm(false); await fetchData(); setLoading(false)
  }

  const handleDelete = async (id) => {
    if(confirm('¿Eliminar producto permanentemente?')) { await fetch(`/api/products/${id}`, { method: 'DELETE' }); await fetchData() }
  }

  const handleEdit = (product) => {
    setFormData({
      barcode: product.barcode || '',
      name: product.name.split(' ')[0], // Aproximación
      presentation: '',
      packageName: product.units?.find(u => u.name !== 'Unidad')?.name || 'PAQUETE',
      packageUnits: product.units?.find(u => u.name !== 'Unidad')?.multiplier.toString() || '',
      packageWeight: product.packageWeight?.toString() || '',
      weightUnit: 'kg',
      categoryId: product.categoryId,
      brandId: product.brandId,
      customUnits: []
    })
    setEditingId(product.id); setShowForm(true); setView('products')
  }

  // Cálculos en vivo para la vista previa
  const currentBrand = brands.find(b => b.id === formData.brandId)?.name || ''
  const previewDescription = `${formData.name} ${formData.presentation} x${formData.packageUnits}UND (${currentBrand})`.toUpperCase()
  
  let pesoEmpaqueKg = parseFloat(formData.packageWeight) || 0;
  if (formData.weightUnit === 'g') pesoEmpaqueKg = pesoEmpaqueKg / 1000;
  const pesoUnidadKg = (pesoEmpaqueKg / (parseInt(formData.packageUnits) || 1));

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1100px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      
      {showScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <h3>📷 Apunta al código</h3><div id="reader" style={{ width: '300px', margin: '20px auto' }}></div>
            <button onClick={() => setShowScanner(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div><h1 style={{ margin: 0, fontSize: '20px' }}>📦 Inventario PRO</h1><p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Admin: <strong>{session?.user?.name}</strong></p></div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', backgroundColor: isOnline ? '#d1fae5' : '#fee2e2', color: isOnline ? '#065f46' : '#991b1b' }}>{isOnline ? 'En línea' : 'Sin conexión'}</span>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px' }}>Salir</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('products'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'products' ? '#2563eb' : 'transparent', color: view === 'products' ? 'white' : '#4b5563' }}>📦 Productos</button>
        <button onClick={() => { setView('categories'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'categories' ? '#0ea5e9' : 'transparent', color: view === 'categories' ? 'white' : '#4b5563' }}>📑 Categorías</button>
        <button onClick={() => { setView('brands'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'brands' ? '#8b5cf6' : 'transparent', color: view === 'brands' ? 'white' : '#4b5563' }}>🏷️ Marcas</button>
        <button onClick={() => { setView('entries'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'entries' ? '#10b981' : 'transparent', color: view === 'entries' ? 'white' : '#4b5563' }}>📥 Entradas</button>
        <button onClick={() => { setView('exits'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'exits' ? '#f59e0b' : 'transparent', color: view === 'exits' ? 'white' : '#4b5563' }}>🚚 Salidas</button>
      </div>

      {/* CATEGORÍAS */}
      {view === 'categories' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Gestión de Categorías</h2>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value.toUpperCase())} placeholder="Nueva Categoría (Ej: BEBIDAS)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar</button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {categories.map(c => <li key={c.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.name}</li>)}
          </ul>
        </div>
      )}

      {/* MARCAS */}
      {view === 'brands' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Gestión de Marcas</h2>
          <form onSubmit={handleAddBrand} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input type="text" value={newBrand} onChange={e => setNewBrand(e.target.value.toUpperCase())} placeholder="Nueva Marca (Ej: AJEPER)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar</button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {brands.map(b => <li key={b.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{b.name}</li>)}
          </ul>
        </div>
      )}

      {/* PRODUCTOS LISTA */}
      {view === 'products' && !showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Catálogo</h2>
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>+ Nuevo Producto</button>
          </div>
          <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Código</th><th style={{padding:'10px'}}>Descripción</th><th style={{padding:'10px'}}>Peso Und</th><th style={{padding:'10px'}}>Acciones</th></tr></thead>
            <tbody>
              {products.filter(p => p.name.includes(searchTerm.toUpperCase())).map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontSize: '12px', fontWeight: 'bold' }}>{p.internalCode}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ padding: '12px' }}>{p.unitWeight.toFixed(3)} kg</td>
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(p)} style={{ padding: '6px 10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }}>Editar</button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px' }}>Borrar</button>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* FORMULARIO DE PRODUCTO */}
      {view === 'products' && showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>{editingId ? 'Editar' : 'Nuevo Producto'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Código de Barras" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <button type="button" onClick={() => setFormData({...formData, barcode: `200${Math.floor(Math.random() * 10000000000)}`})} style={{ padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px' }}>🪄 Auto</button>
              <button type="button" onClick={() => { setScanMode('form'); setShowScanner(true); }} style={{ padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px' }}>📷</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="">Seleccione Categoría...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="">Seleccione Marca...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="Nombre Base (Ej: AGUA CIELO)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <input type="text" required value={formData.presentation} onChange={e => setFormData({...formData, presentation: e.target.value.toUpperCase()})} placeholder="Medida (Ej: 500ML)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <input type="number" required value={formData.packageUnits} onChange={e => setFormData({...formData, packageUnits: e.target.value})} placeholder="Unds en paquete" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>

            <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Peso del Empaque Principal</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" required value={formData.packageName} onChange={e => setFormData({...formData, packageName: e.target.value.toUpperCase()})} placeholder="Empaque (Ej: BOLSA, PAQUETE)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <input type="number" step="0.01" required value={formData.packageWeight} onChange={e => setFormData({...formData, packageWeight: e.target.value})} placeholder="Peso Total" style={{ width: '120px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <select value={formData.weightUnit} onChange={e => setFormData({...formData, weightUnit: e.target.value})} style={{ width: '80px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="g">gr</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 'bold' }}>📝 Descripción:</p>
              <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold', color: '#0284c7' }}>{previewDescription}</p>
              <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 'bold' }}>⚖️ Cálculo automático:</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#0284c7' }}>
                {formData.packageName || 'Paquete'} pesa {formData.packageWeight || 0}{formData.weightUnit} | 
                Cada unidad pesa <strong>{pesoUnidadKg.toFixed(3)} kg</strong>
              </p>
            </div>

            <button type="submit" disabled={loading} style={{ padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '10px' }}>Guardar Producto</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </div>
      )}

      {/* ENTRADAS Y SALIDAS (Se mantienen igual que antes) */}
      {view === 'entries' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Registrar Entrada</h2>
          <p style={{ color: '#6b7280' }}>Próximamente se actualizará visualmente con las nuevas categorías.</p>
        </div>
      )}
      
      {view === 'exits' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Registrar Salida</h2>
          <p style={{ color: '#6b7280' }}>Próximamente se actualizará visualmente con las nuevas categorías.</p>
        </div>
      )}

    </div>
  )
}
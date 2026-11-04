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

  // Formulario de Productos
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    barcode: '', name: '', presentation: '', 
    packageName: 'PAQUETE', packageUnits: '', packageWeight: '', weightUnit: 'g', 
    categoryId: '', brandId: '', customUnits: []
  })

  // Crear Categorías/Marcas
  const [newCategory, setNewCategory] = useState('')
  const [newBrand, setNewBrand] = useState('')

  // Entradas y Salidas
  const [entryForm, setEntryForm] = useState({ productId: '', packages: '', units: '', expirationDate: '' })
  const [entrySearch, setEntrySearch] = useState('')
  const [exitForm, setExitForm] = useState({ productId: '', packages: '', units: '', reason: 'Venta', deliveredBy: '', receivedBy: '' })
  const [exitSearch, setExitSearch] = useState('')
  const [cart, setCart] = useState([])
  const [transportType, setTransportType] = useState('Moto')
  const [maxWeight, setMaxWeight] = useState(1500)
  const [unlimitedWeight, setUnlimitedWeight] = useState(false)

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

  const handleTransportChange = (type) => {
    setTransportType(type)
    if (type === 'Moto') { setMaxWeight(1500); setUnlimitedWeight(false) }
    else if (type === 'Carreta') { setMaxWeight(250); setUnlimitedWeight(false) }
    else { setMaxWeight(0); setUnlimitedWeight(true) }
  }

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
      name: product.name.split(' ')[0],
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

  // --- LÓGICA DE ENTRADAS ---
  const handleEntrySubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const product = products.find(p => p.id === entryForm.productId)
    if (!product) return alert('Seleccione un producto')
    
    const multiplier = product.units?.find(u => u.multiplier > 1)?.multiplier || 1;
    const totalUnits = (parseInt(entryForm.packages || 0) * multiplier) + parseInt(entryForm.units || 0);
    if (totalUnits <= 0) return alert('Ingrese una cantidad válida');

    const dataToSend = { productId: entryForm.productId, quantity: totalUnits, expirationDate: entryForm.expirationDate || null };

    await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) })
    setEntryForm({ productId: '', packages: '', units: '', expirationDate: '' }); setEntrySearch('');
    await fetchData(); setLoading(false); setView('kardex')
  }

  // --- LÓGICA DE SALIDAS ---
  const addToCart = (e) => {
    e.preventDefault()
    const product = products.find(p => p.id === exitForm.productId)
    if (!product) return alert('Seleccione un producto')

    const multiplier = product.units?.find(u => u.multiplier > 1)?.multiplier || 1;
    const totalUnits = (parseInt(exitForm.packages || 0) * multiplier) + parseInt(exitForm.units || 0);

    if (totalUnits <= 0) return alert('Ingrese una cantidad válida')
    const alreadyInCart = cart.find(c => c.id === product.id)?.quantity || 0;
    if ((totalUnits + alreadyInCart) > product.stock) return alert(`Stock insuficiente. Solo hay ${product.stock}`)

    const existingIndex = cart.findIndex(c => c.id === product.id);
    if(existingIndex >= 0) {
        const newCart = [...cart];
        newCart[existingIndex].quantity += totalUnits;
        newCart[existingIndex].weight = newCart[existingIndex].quantity * product.unitWeight;
        setCart(newCart);
    } else {
        setCart([...cart, { id: product.id, name: product.name, quantity: totalUnits, weight: product.unitWeight * totalUnits, unitWeight: product.unitWeight }])
    }
    
    setExitForm({ ...exitForm, productId: '', packages: '', units: '' });
    setExitSearch('');
  }

  const updateCartQuantity = (id, newQuantity) => {
    if (newQuantity <= 0) return;
    setCart(cart.map(c => c.id === id ? { ...c, quantity: newQuantity, weight: newQuantity * c.unitWeight } : c));
  }

  const removeFromCart = (id) => { setCart(cart.filter(c => c.id !== id)); }

  const handleExitSubmit = async () => {
    if (cart.length === 0) return alert('La lista está vacía')
    if (!exitForm.deliveredBy || !exitForm.receivedBy) return alert('Complete quién entrega y quién recibe')
    if (!unlimitedWeight && totalWeight > maxWeight) return alert('El peso excede el límite permitido')
    
    setLoading(true)
    const items = cart.map(c => ({ productId: c.id, quantity: c.quantity }))
    try {
      const res = await fetch('/api/exits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, reason: exitForm.reason, deliveredBy: exitForm.deliveredBy, receivedBy: exitForm.receivedBy })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      
      const ticketHTML = `
        <html><head><title>Ticket</title><style>body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 10px; font-size: 12px; } .text-center { text-align: center; } .bold { font-weight: bold; } .line { border-bottom: 1px dashed #000; margin: 5px 0; } table { width: 100%; border-collapse: collapse; } th, td { padding: 2px 0; text-align: left; } th { border-bottom: 1px dashed #000; }</style></head>
        <body>
          <div class="text-center bold" style="font-size: 16px;">MI EMPRESA S.A.C.</div><div class="text-center">RUC: 20123456789</div><div class="text-center">TICKET DE SALIDA</div><div class="line"></div>
          <div>Fecha: ${new Date().toLocaleString()}</div><div>Transporte: ${transportType}</div><div>Entrega: ${exitForm.deliveredBy}</div><div>Recibe: ${exitForm.receivedBy}</div><div class="line"></div>
          <table><thead><tr><th>Cant.</th><th>Producto</th></tr></thead><tbody>${cart.map(item => `<tr><td class="bold">${item.quantity} und</td><td>${item.name}</td></tr>`).join('')}</tbody></table>
          <div class="line"></div><div class="bold">Peso Total: ${totalWeight.toFixed(2)} kg</div><div class="line"></div>
          <div class="text-center" style="margin-top: 10px;">_______________________</div><div class="text-center">Firma de Recepción</div>
        </body></html>
      `;
      const printWindow = window.open('', '_blank'); printWindow.document.write(ticketHTML); printWindow.document.close(); printWindow.focus(); printWindow.print();
      alert('✅ Salida despachada.')
      setCart([]); setExitForm({ productId: '', packages: '', units: '', reason: 'Venta', deliveredBy: '', receivedBy: '' }); setExitSearch('');
      await fetchData(); setView('products')
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const totalWeight = cart.reduce((sum, item) => sum + item.weight, 0)
  const excedePeso = !unlimitedWeight && totalWeight > maxWeight

  const filteredProducts = products.filter(p => p.name.includes(searchTerm.toUpperCase()));
  const entryFiltered = products.filter(p => p.isActive && p.name.toLowerCase().includes(entrySearch.toLowerCase()));
  const exitFiltered = products.filter(p => p.isActive && p.name.toLowerCase().includes(exitSearch.toLowerCase()));

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

      {view === 'categories' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Gestión de Categorías</h2>
          <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value.toUpperCase())} placeholder="Nueva Categoría (Ej: BEBIDAS)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar</button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0 }}>{categories.map(c => <li key={c.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{c.name}</li>)}</ul>
        </div>
      )}

      {view === 'brands' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Gestión de Marcas</h2>
          <form onSubmit={handleAddBrand} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input type="text" value={newBrand} onChange={e => setNewBrand(e.target.value.toUpperCase())} placeholder="Nueva Marca (Ej: AJEPER)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar</button>
          </form>
          <ul style={{ listStyle: 'none', padding: 0 }}>{brands.map(b => <li key={b.id} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{b.name}</li>)}</ul>
        </div>
      )}

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
              {filteredProducts.map(p => (
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

      {view === 'products' && showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>{editingId ? 'Editar' : 'Nuevo Producto'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Código de Barras" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <button type="button" onClick={() => setFormData({...formData, barcode: `200${Math.floor(Math.random() * 10000000000)}`})} style={{ padding: '10px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px' }}>🪄 Auto</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="">Categoría...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select required value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                <option value="">Marca...</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '15px' }}>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="Nombre (Ej: AGUA CIELO)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <input type="text" required value={formData.presentation} onChange={e => setFormData({...formData, presentation: e.target.value.toUpperCase()})} placeholder="Medida (Ej: 500ML)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <input type="number" required value={formData.packageUnits} onChange={e => setFormData({...formData, packageUnits: e.target.value})} placeholder="Unds paquete" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" required value={formData.packageName} onChange={e => setFormData({...formData, packageName: e.target.value.toUpperCase()})} placeholder="Empaque (Ej: BOLSA)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <input type="number" step="0.01" required value={formData.packageWeight} onChange={e => setFormData({...formData, packageWeight: e.target.value})} placeholder="Peso" style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <select value={formData.weightUnit} onChange={e => setFormData({...formData, weightUnit: e.target.value})} style={{ width: '70px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <option value="g">gr</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
            <div style={{ padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '8px', border: '1px solid #bae6fd' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#0369a1', fontWeight: 'bold' }}>📝 Descripción:</p>
              <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold', color: '#0284c7' }}>{previewDescription}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#0284c7' }}>
                Peso Unidad: <strong>{pesoUnidadKg.toFixed(3)} kg</strong>
              </p>
            </div>
            <button type="submit" disabled={loading} style={{ padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Guardar Producto</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </div>
      )}

      {view === 'entries' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Registrar Entrada</h2>
          <form onSubmit={handleEntrySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="Buscar producto..." 
                value={entryForm.productId ? products.find(p=>p.id===entryForm.productId)?.name : entrySearch} 
                onChange={e => { setEntrySearch(e.target.value); setEntryForm({...entryForm, productId: ''}); }}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              {entrySearch && !entryForm.productId && (
                <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', borderRadius: '6px', marginTop: '5px' }}>
                  {entryFiltered.map(p => (
                    <div key={p.id} onClick={() => { setEntryForm({...entryForm, productId: p.id}); setEntrySearch(''); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                      {p.name} (Stock: {p.stock})
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Paquetes</label>
                <input type="number" min="0" value={entryForm.packages} onChange={e => setEntryForm({...entryForm, packages: e.target.value})} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Unidades</label>
                <input type="number" min="0" value={entryForm.units} onChange={e => setEntryForm({...entryForm, units: e.target.value})} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Fecha de Vencimiento</label>
              <input type="date" value={entryForm.expirationDate} onChange={e => setEntryForm({...entryForm, expirationDate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Registrar Entrada</button>
          </form>
        </div>
      )}

      {view === 'exits' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
            <h2>🚚 Preparar Salida</h2>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <select value={transportType} onChange={e => handleTransportChange(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                    <option value="Moto">Motocarga (Max 1500kg)</option>
                    <option value="Carreta">Carreta (Max 250kg)</option>
                    <option value="A mano">A mano (Sin límite)</option>
                </select>
                <input type="number" value={maxWeight} disabled={unlimitedWeight} onChange={e => setMaxWeight(e.target.value)} style={{ width: '100px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: unlimitedWeight ? '#eee' : 'white' }} />
            </div>
            <form onSubmit={addToCart} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Buscar producto..." 
                  value={exitForm.productId ? products.find(p=>p.id===exitForm.productId)?.name : exitSearch} 
                  onChange={e => { setExitSearch(e.target.value); setExitForm({...exitForm, productId: ''}); }}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
                {exitSearch && !exitForm.productId && (
                  <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', borderRadius: '6px', marginTop: '5px' }}>
                    {exitFiltered.map(p => (
                      <div key={p.id} onClick={() => { setExitForm({...exitForm, productId: p.id}); setExitSearch(''); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        {p.name} (Hay: {p.stock})
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Paquetes</label>
                  <input type="number" min="0" value={exitForm.packages} onChange={e => setExitForm({...exitForm, packages: e.target.value})} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Unidades</label>
                  <input type="number" min="0" value={exitForm.units} onChange={e => setExitForm({...exitForm, units: e.target.value})} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                </div>
              </div>
              <button type="submit" style={{ padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar a Lista</button>
            </form>
          </div>
          
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: excedePeso ? '3px solid red' : '1px solid #e5e7eb' }}>
            <h2>Lista de Carga ({transportType})</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {cart.map((item, index) => (
                <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <span style={{ flex: 1 }}>{item.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <input type="number" value={item.quantity} onChange={(e) => updateCartQuantity(item.id, parseInt(e.target.value))} style={{ width: '60px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }} />
                      <button onClick={() => removeFromCart(item.id)} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '5px 8px', borderRadius: '4px' }}>X</button>
                  </div>
                  <span style={{ fontWeight: 'bold', width: '70px', textAlign: 'right' }}>{item.weight.toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: excedePeso ? '#fee2e2' : '#f3f4f6', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Peso Total: {totalWeight.toFixed(2)} kg {unlimitedWeight ? '(Sin límite)' : `(Max: ${maxWeight} kg)`}</p>
              {excedePeso && <p style={{ margin: '5px 0 0 0', color: '#b91c1c', fontWeight: 'bold', fontSize: '14px' }}>⚠️ ¡EXCEDE EL PESO PERMITIDO!</p>}
            </div>
            {cart.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '2px solid #e5e7eb', paddingTop: '20px' }}>
                <input type="text" placeholder="Entregado por" value={exitForm.deliveredBy} onChange={e => setExitForm({...exitForm, deliveredBy: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px' }} />
                <input type="text" placeholder="Recibido por" value={exitForm.receivedBy} onChange={e => setExitForm({...exitForm, receivedBy: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px' }} />
                <button onClick={handleExitSubmit} disabled={excedePeso || loading} style={{ width: '100%', padding: '15px', backgroundColor: excedePeso ? '#9ca3af' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Despachar e Imprimir</button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
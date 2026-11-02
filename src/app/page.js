'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState('dashboard')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [isOnline, setIsOnline] = useState(true)

  // Filtros y Productos
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '', presentation: '', unitsPerPackage: '', brand: '', category: 'Bebidas', family: 'Gaseosas',
    unitWeight: '', packageWeight: '', barcode: '', customUnits: []
  })

  // Entradas
  const [entryForm, setEntryForm] = useState({ productId: '', packages: '', units: '', expirationDate: '' })
  const [entrySearch, setEntrySearch] = useState('')
  const [showEntryDropdown, setShowEntryDropdown] = useState(false)
  const [kardex, setKardex] = useState([])

  // Salidas
  const [cart, setCart] = useState([])
  const [exitForm, setExitForm] = useState({ productId: '', packages: '', units: '', reason: 'Venta', deliveredBy: '', receivedBy: '' })
  const [exitSearch, setExitSearch] = useState('')
  const [showExitDropdown, setShowExitDropdown] = useState(false)
  
  // Transporte
  const [transportType, setTransportType] = useState('Moto')
  const [maxWeight, setMaxWeight] = useState(1500)
  const [unlimitedWeight, setUnlimitedWeight] = useState(false)

  // Mermas
  const [mermaForm, setMermaForm] = useState({ productId: '', quantity: '' })
  const [mermaSearch, setMermaSearch] = useState('')
  const [showMermaDropdown, setShowMermaDropdown] = useState(false)

  // Usuarios
  const [users, setUsers] = useState([])
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'ALMACEN' })

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

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products'); if (!res.ok) throw new Error('Fallo');
      const data = await res.json(); if (Array.isArray(data)) setProducts(data)
    } catch (error) { }
  }
  const fetchKardex = async () => {
    try {
      const res = await fetch('/api/entries'); if (!res.ok) throw new Error('Fallo');
      const data = await res.json(); if (Array.isArray(data)) setKardex(data)
    } catch (error) { }
  }
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users'); if (!res.ok) throw new Error('Fallo');
      const data = await res.json(); if (Array.isArray(data)) setUsers(data)
    } catch (error) { }
  }

  useEffect(() => { 
    if (status === 'authenticated') { fetchProducts(); fetchKardex(); if(session?.user?.role === 'ADMIN') fetchUsers(); }
  }, [status, session])

  if (status === 'loading') return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '24px' }}>Cargando sistema...</div>
  if (status === 'unauthenticated') return null

  const formatStock = (product) => {
    if (!product) return ''
    let stockRestante = product.stock
    if (stockRestante === 0) return '0 unidades'
    const unidadesOrdenadas = [...(product.units || [])].sort((a, b) => b.multiplier - a.multiplier)
    let partes = []
    for (const unidad of unidadesOrdenadas) {
      if (unidad.multiplier > 1 && stockRestante >= unidad.multiplier) {
        const cantidad = Math.floor(stockRestante / unidad.multiplier)
        partes.push(`${cantidad} ${unidad.name}${cantidad > 1 ? 's' : ''}`)
        stockRestante = stockRestante % unidad.multiplier
      }
    }
    if (stockRestante > 0) partes.push(`${stockRestante} und`)
    return partes.join(', ')
  }

  const getExpirationAlert = (dateStr) => {
    if (!dateStr) return { text: '---', color: '#9ca3af', bg: 'transparent' }
    const diffDays = Math.ceil((new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { text: `VENCIDO`, color: '#ef4444', bg: '#fee2e2' }
    if (diffDays <= 30) return { text: `Vence en ${diffDays} días`, color: '#b45309', bg: '#fef3c7' }
    return { text: new Date(dateStr).toLocaleDateString(), color: '#10b981', bg: 'transparent' }
  }

  const handleTransportChange = (type) => {
    setTransportType(type)
    if (type === 'Moto') { setMaxWeight(1500); setUnlimitedWeight(false) }
    else if (type === 'Carreta') { setMaxWeight(250); setUnlimitedWeight(false) }
    else { setMaxWeight(0); setUnlimitedWeight(true) }
  }

  // --- LÓGICA DE PRODUCTOS ---
  const addCustomUnit = () => setFormData({ ...formData, customUnits: [...formData.customUnits, { name: '', multiplier: '', price: 0 }] })
  const updateCustomUnit = (index, field, value) => {
    const newUnits = [...formData.customUnits]; newUnits[index][field] = value; setFormData({ ...formData, customUnits: newUnits })
  }
  const removeCustomUnit = (index) => setFormData({ ...formData, customUnits: formData.customUnits.filter((_, i) => i !== index) })

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const url = editingId ? `/api/products/${editingId}` : '/api/products'
    const method = editingId ? 'PUT' : 'POST'
    
    const fullName = `${formData.name} ${formData.presentation} x${formData.unitsPerPackage}UND (${formData.brand})`.toUpperCase()
    const dataToSend = { ...formData, name: fullName, priceUnit: 0 } 

    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) })
    setFormData({ name: '', presentation: '', unitsPerPackage: '', brand: '', category: 'Bebidas', family: 'Gaseosas', unitWeight: '', packageWeight: '', barcode: '', customUnits: [] })
    setEditingId(null); setShowForm(false); await fetchProducts(); setLoading(false)
  }

  const handleDelete = async (id) => {
    if(confirm('¿Eliminar producto?')) { await fetch(`/api/products/${id}`, { method: 'DELETE' }); await fetchProducts() }
  }

  const handleEdit = (product) => {
    const custom = product.units?.filter(u => u.name !== 'Unidad').map(u => ({ name: u.name, multiplier: u.multiplier.toString(), price: 0 })) || []
    setFormData({
      name: product.name, presentation: '', unitsPerPackage: '1', brand: product.brand?.name || '', 
      category: product.category?.name || 'Bebidas', family: product.family?.name || 'Gaseosas',
      unitWeight: product.unitWeight.toString(), packageWeight: product.packageWeight?.toString() || '', barcode: product.barcode || '', customUnits: custom
    })
    setEditingId(product.id); setShowForm(true); setView('products')
  }

  // --- LÓGICA DE ENTRADAS ---
  const handleEntrySubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const product = products.find(p => p.id === entryForm.productId)
    if (!product) return alert('Seleccione un producto')
    
    const multiplier = product.unitsPerPackage || 1;
    const totalUnits = (parseInt(entryForm.packages || 0) * multiplier) + parseInt(entryForm.units || 0);
    if (totalUnits <= 0) return alert('Ingrese una cantidad válida');

    const dataToSend = { productId: entryForm.productId, quantity: totalUnits, expirationDate: entryForm.expirationDate || null };

    await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dataToSend) })
    setEntryForm({ productId: '', packages: '', units: '', expirationDate: '' }); setEntrySearch('');
    await fetchProducts(); await fetchKardex(); setLoading(false); setView('kardex')
  }

  // --- LÓGICA DE SALIDAS ---
  const addToCart = (e) => {
    e.preventDefault()
    const product = products.find(p => p.id === exitForm.productId)
    if (!product) return alert('Seleccione un producto')

    const multiplier = product.unitsPerPackage || 1;
    const totalUnits = (parseInt(exitForm.packages || 0) * multiplier) + parseInt(exitForm.units || 0);

    if (totalUnits <= 0) return alert('Ingrese una cantidad válida')
    const alreadyInCart = cart.find(c => c.id === product.id)?.quantity || 0;
    if ((totalUnits + alreadyInCart) > product.stock) return alert(`Stock insuficiente. Solo hay ${formatStock(product)}`)

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
      await fetchProducts(); await fetchKardex(); setView('kardex')
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const handleMermaSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const finalQuantity = parseInt(mermaForm.quantity)
    try {
      const res = await fetch('/api/mermas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: mermaForm.productId, quantity: finalQuantity }) })
      if (!res.ok) throw new Error((await res.json()).error)
      alert(`✅ Se registraron ${finalQuantity} unidades como merma.`)
      setMermaForm({ productId: '', quantity: '' }); setMermaSearch(''); await fetchProducts(); await fetchKardex()
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm) })
      if (!res.ok) throw new Error((await res.json()).error)
      alert('✅ Usuario creado.')
      setUserForm({ name: '', email: '', password: '', role: 'ALMACEN' }); await fetchUsers()
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const totalWeight = cart.reduce((sum, item) => sum + item.weight, 0)
  const excedePeso = !unlimitedWeight && totalWeight > maxWeight

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(searchTerm));
    return matchSearch;
  });

  const entryFiltered = products.filter(p => p.name.toLowerCase().includes(entrySearch.toLowerCase()));
  const exitFiltered = products.filter(p => p.name.toLowerCase().includes(exitSearch.toLowerCase()));
  const mermaFiltered = products.filter(p => p.name.toLowerCase().includes(mermaSearch.toLowerCase()));

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      
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
          <div style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', backgroundColor: isOnline ? '#d1fae5' : '#fee2e2', color: isOnline ? '#065f46' : '#991b1b' }}>
            {isOnline ? 'En línea' : 'Sin conexión'}
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px' }}>Salir</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('dashboard'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'dashboard' ? '#1e293b' : 'transparent', color: view === 'dashboard' ? 'white' : '#4b5563' }}>📊 Dashboard</button>
        <button onClick={() => { setView('products'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'products' ? '#2563eb' : 'transparent', color: view === 'products' ? 'white' : '#4b5563' }}>📦 Productos</button>
        <button onClick={() => { setView('entries'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'entries' ? '#10b981' : 'transparent', color: view === 'entries' ? 'white' : '#4b5563' }}>📥 Entradas</button>
        <button onClick={() => { setView('exits'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'exits' ? '#f59e0b' : 'transparent', color: view === 'exits' ? 'white' : '#4b5563' }}>🚚 Salidas</button>
        <button onClick={() => { setView('mermas'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'mermas' ? '#ef4444' : 'transparent', color: view === 'mermas' ? 'white' : '#4b5563' }}>⚠️ Mermas</button>
        <button onClick={() => { setView('kardex'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'kardex' ? '#8b5cf6' : 'transparent', color: view === 'kardex' ? 'white' : '#4b5563' }}>📋 Kardex</button>
        {session?.user?.role === 'ADMIN' && (
          <button onClick={() => { setView('users'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'users' ? '#0ea5e9' : 'transparent', color: view === 'users' ? 'white' : '#4b5563' }}>👥 Usuarios</button>
        )}
      </div>

      {view === 'dashboard' && (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
           <h2>Bienvenido al Sistema</h2>
           <p style={{ color: '#6b7280' }}>Selecciona una pestaña para comenzar a trabajar.</p>
        </div>
      )}

      {view === 'products' && !showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Catálogo</h2>
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>+ Nuevo</button>
          </div>
          <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '6px', border: '1px solid #ccc' }} />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Producto</th><th style={{padding:'10px'}}>Peso Und</th><th style={{padding:'10px'}}>Peso Paq</th><th style={{padding:'10px'}}>Vence</th><th style={{padding:'10px'}}>Stock</th><th style={{padding:'10px'}}>Acciones</th></tr></thead>
            <tbody>
              {filteredProducts.map(p => {
                const exp = getExpirationAlert(p.expirationDate);
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td>
                    <td style={{ padding: '12px' }}>{p.unitWeight} kg</td>
                    <td style={{ padding: '12px' }}>{p.packageWeight ? p.packageWeight + ' kg' : '-'}</td>
                    <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: exp.color, backgroundColor: exp.bg }}>{exp.text}</span></td>
                    <td style={{ padding: '12px', color: '#2563eb', fontWeight: 'bold' }}>{formatStock(p)}</td>
                    <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(p)} style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px' }}>Editar</button>
                      <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}>Borrar</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'products' && showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>{editingId ? 'Editar' : 'Nuevo Producto'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
              <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Código de Barras (Opcional)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <button type="button" onClick={() => {
                const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
                setFormData({...formData, barcode: `200${randomPart}`});
              }} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>🪄 Auto</button>
              <button type="button" onClick={() => { setScanMode('form'); setShowScanner(true); }} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>📷 Escanear</button>
            </div>

            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre Base (Ej: Agua Cielo)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="text" required value={formData.presentation} onChange={e => setFormData({...formData, presentation: e.target.value})} placeholder="Medida/Peso (Ej: 2.5L)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            
            <input type="number" required value={formData.unitsPerPackage} onChange={e => setFormData({...formData, unitsPerPackage: e.target.value})} placeholder="Unidades por Paquete (Ej: 6)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="text" required value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Marca (Ej: Ajeper)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />

            <div style={{ gridColumn: 'span 2', padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px', color: '#0369a1' }}>
              Vista Previa: {formData.name || 'Nombre'} {formData.presentation || 'Medida'} x{formData.unitsPerPackage || '0'}UND ({formData.brand || 'Marca'})
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Peso 1 Unidad (kg)</label>
              <input type="number" step="0.01" required value={formData.unitWeight} onChange={e => setFormData({...formData, unitWeight: e.target.value})} placeholder="Ej: 0.35" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Peso 1 Paquete (kg)</label>
              <input type="number" step="0.01" value={formData.packageWeight} onChange={e => setFormData({...formData, packageWeight: e.target.value})} placeholder="Ej: 2.1" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>

            {/* AGREGAR UNIDADES DE MEDIDA (Cajas, Displays, etc) */}
            <div style={{ gridColumn: 'span 2', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Presentaciones Adicionales (Caja, Fardo, etc.)</h3>
                <button type="button" onClick={addCustomUnit} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ Añadir Presentación</button>
              </div>
              {formData.customUnits.map((unit, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <input type="text" required value={unit.name} onChange={e => updateCustomUnit(index, 'name', e.target.value)} placeholder="Nombre (Ej: Caja, Display)" style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" required value={unit.multiplier} onChange={e => updateCustomUnit(index, 'multiplier', e.target.value)} placeholder="Unidades que trae" style={{ width: '150px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button type="button" onClick={() => removeCustomUnit(index)} style={{ padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>X</button>
                </div>
              ))}
              {formData.customUnits.length === 0 && <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>Si el producto solo se maneja por paquete y unidad, deja esto vacío.</p>}
            </div>
            
            <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '10px' }}>Guardar Producto</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ gridColumn: 'span 2', padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer' }}>Cancelar</button>
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
                onChange={e => { setEntrySearch(e.target.value); setEntryForm({...entryForm, productId: ''}); setShowEntryDropdown(true); }}
                onFocus={() => setShowEntryDropdown(true)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              {showEntryDropdown && entrySearch && (
                <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', borderRadius: '6px', marginTop: '5px' }}>
                  {entryFiltered.map(p => (
                    <div key={p.id} onClick={() => { setEntryForm({...entryForm, productId: p.id}); setEntrySearch(''); setShowEntryDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                      {p.name} (Stock: {formatStock(p)})
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
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Unidades Sueltas</label>
                <input type="number" min="0" value={entryForm.units} onChange={e => setEntryForm({...entryForm, units: e.target.value})} placeholder="0" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Fecha de Vencimiento de este Lote</label>
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
                <input type="number" value={maxWeight} disabled={unlimitedWeight} onChange={e => setMaxWeight(e.target.value)} placeholder="Peso max (kg)" style={{ width: '120px', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', backgroundColor: unlimitedWeight ? '#eee' : 'white' }} />
            </div>

            <form onSubmit={addToCart} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              <div style={{ position: 'relative' }}>
                <input type="text" placeholder="Buscar producto..." 
                  value={exitForm.productId ? products.find(p=>p.id===exitForm.productId)?.name : exitSearch} 
                  onChange={e => { setExitSearch(e.target.value); setExitForm({...exitForm, productId: ''}); setShowExitDropdown(true); }}
                  onFocus={() => setShowExitDropdown(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
                />
                {showExitDropdown && exitSearch && (
                  <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', borderRadius: '6px', marginTop: '5px' }}>
                    {exitFiltered.map(p => (
                      <div key={p.id} onClick={() => { setExitForm({...exitForm, productId: p.id}); setExitSearch(''); setShowExitDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                        {p.name} (Hay: {formatStock(p)})
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

      {view === 'mermas' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>⚠️ Reportar Merma</h2>
          <form onSubmit={handleMermaSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
            
            <div style={{ position: 'relative' }}>
              <input type="text" placeholder="Buscar producto..." 
                value={mermaForm.productId ? products.find(p=>p.id===mermaForm.productId)?.name : mermaSearch} 
                onChange={e => { setMermaSearch(e.target.value); setMermaForm({...mermaForm, productId: ''}); setShowMermaDropdown(true); }}
                onFocus={() => setShowMermaDropdown(true)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
              />
              {showMermaDropdown && mermaSearch && (
                <div style={{ position: 'absolute', zIndex: 10, width: '100%', backgroundColor: 'white', border: '1px solid #ccc', maxHeight: '150px', overflowY: 'auto', borderRadius: '6px', marginTop: '5px' }}>
                  {mermaFiltered.map(p => (
                    <div key={p.id} onClick={() => { setMermaForm({...mermaForm, productId: p.id}); setMermaSearch(''); setShowMermaDropdown(false); }} style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}>
                      {p.name} (Hay: {formatStock(p)})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cantidad de Unidades Dañadas</label>
              <input type="number" required value={mermaForm.quantity} onChange={e => setMermaForm({...mermaForm, quantity: e.target.value})} placeholder="Ej: 5" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <button type="submit" style={{ padding: '15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Reportar</button>
          </form>
        </div>
      )}

      {view === 'kardex' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Kardex</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Fecha</th><th style={{padding:'10px'}}>Producto</th><th style={{padding:'10px'}}>Tipo</th><th style={{padding:'10px'}}>Movimiento</th><th style={{padding:'10px'}}>Stock Final</th></tr></thead>
            <tbody>
              {kardex.map(m => {
                const movFormatted = formatStock({ stock: m.quantity, units: m.product?.units });
                const stockFormatted = formatStock({ stock: m.newStock, units: m.product?.units });
                
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{new Date(m.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.product?.name}</td>
                    <td style={{ padding: '10px' }}><span style={{ padding: '4px', borderRadius: '4px', backgroundColor: m.type === 'ENTRADA' ? '#d1fae5' : '#fee2e2', color: m.type === 'ENTRADA' ? '#065f46' : '#991b1b' }}>{m.type}</span></td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: m.type === 'ENTRADA' ? '#059669' : '#dc2626' }}>
                      {m.type === 'ENTRADA' ? '+' : '-'} {movFormatted}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{stockFormatted}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'users' && session?.user?.role === 'ADMIN' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>👥 Usuarios</h2>
          <form onSubmit={handleUserSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', margin: '20px 0' }}>
            <input type="text" required placeholder="Nombre" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="email" required placeholder="Correo" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="password" required placeholder="Clave" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <button type="submit" style={{ backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Crear</button>
          </form>
        </div>
      )}

    </div>
  )
}
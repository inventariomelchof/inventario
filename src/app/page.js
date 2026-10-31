'use client'
import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Html5Qrcode } from 'html5-qrcode'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [view, setView] = useState('dashboard')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  const [searchTerm, setSearchTerm] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formData, setFormData] = useState({
    name: '', category: 'Bebidas', family: 'Gaseosas', brand: 'Aje',
    unitWeight: '', stock: '', priceUnit: '', expirationDate: '', barcode: '',
    customUnits: []
  })

  const [entryData, setEntryData] = useState({ productId: '', quantity: '' })
  const [kardex, setKardex] = useState([])

  const [cart, setCart] = useState([])
  const [exitForm, setExitForm] = useState({ productId: '', quantity: '', reason: 'Venta', deliveredBy: '', receivedBy: '' })
  const PESO_MAXIMO_MOTO = 500 

  const [mermaForm, setMermaForm] = useState({ productId: '', quantity: '', unitMultiplier: 1 })

  const [users, setUsers] = useState([])
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'ALMACEN' })

  const [showScanner, setShowScanner] = useState(false)
  const [scanMode, setScanMode] = useState('')

  const syncOfflineData = async () => {
    const pendingEntries = JSON.parse(localStorage.getItem('pending_entries') || '[]');
    if (pendingEntries.length > 0) {
      setIsSyncing(true);
      try {
        for (const entry of pendingEntries) {
          await fetch('/api/entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
          });
        }
        localStorage.removeItem('pending_entries');
        await fetchProducts();
        await fetchKardex();
        alert(`✅ Se sincronizaron ${pendingEntries.length} entradas guardadas offline.`);
      } catch (error) {
        console.error("Error sincronizando:", error);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => { setIsOnline(true); syncOfflineData(); }
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    if (navigator.onLine) syncOfflineData();
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (showScanner) {
      const html5QrCode = new Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          html5QrCode.stop().then(() => {
            setShowScanner(false);
            if (scanMode === 'search') {
              setSearchTerm(decodedText);
              setView('products');
            } else if (scanMode === 'form') {
              setFormData(prev => ({ ...prev, barcode: decodedText }));
            }
          }).catch(err => console.error(err));
        },
        (errorMessage) => { }
      ).catch((err) => {
        alert("No se pudo iniciar la cámara: " + err);
        setShowScanner(false);
      });
      return () => {
        if(html5QrCode.isScanning) html5QrCode.stop().catch(e => console.log(e));
      }
    }
  }, [showScanner, scanMode]);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products')
      if (!res.ok) throw new Error('Fallo en la red')
      const data = await res.json()
      if (Array.isArray(data)) setProducts(data)
    } catch (error) {}
  }
  const fetchKardex = async () => {
    try {
      const res = await fetch('/api/entries')
      if (!res.ok) throw new Error('Fallo en la red')
      const data = await res.json()
      if (Array.isArray(data)) setKardex(data)
    } catch (error) {}
  }
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (!res.ok) throw new Error('Fallo en la red')
      const data = await res.json()
      if (Array.isArray(data)) setUsers(data)
    } catch (error) {}
  }

  useEffect(() => { 
    if (status === 'authenticated') { 
      fetchProducts(); 
      fetchKardex();
      if(session?.user?.role === 'ADMIN') fetchUsers();
    }
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
    const expDate = new Date(dateStr)
    const today = new Date()
    const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return { text: `VENCIDO (${new Date(dateStr).toLocaleDateString()})`, color: '#ef4444', bg: '#fee2e2' }
    if (diffDays <= 30) return { text: `Vence en ${diffDays} días`, color: '#b45309', bg: '#fef3c7' }
    return { text: new Date(dateStr).toLocaleDateString(), color: '#10b981', bg: 'transparent' }
  }

  const addCustomUnit = () => setFormData({ ...formData, customUnits: [...formData.customUnits, { name: '', multiplier: '', price: '' }] })
  const updateCustomUnit = (index, field, value) => {
    const newUnits = [...formData.customUnits]; newUnits[index][field] = value; setFormData({ ...formData, customUnits: newUnits })
  }
  const removeCustomUnit = (index) => setFormData({ ...formData, customUnits: formData.customUnits.filter((_, i) => i !== index) })

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    const url = editingId ? `/api/products/${editingId}` : '/api/products'
    const method = editingId ? 'PUT' : 'POST'
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
    setFormData({ name: '', category: 'Bebidas', family: 'Gaseosas', brand: 'Aje', unitWeight: '', stock: '', priceUnit: '', expirationDate: '', barcode: '', customUnits: [] })
    setEditingId(null); setShowForm(false); await fetchProducts(); setLoading(false)
  }

  const handleDelete = async (id) => {
    if(confirm('¿Eliminar producto?')) { await fetch(`/api/products/${id}`, { method: 'DELETE' }); await fetchProducts() }
  }

  const handleEdit = (product) => {
    const custom = product.units?.filter(u => u.name !== 'Unidad').map(u => ({ name: u.name, multiplier: u.multiplier.toString(), price: u.price.toString() })) || []
    setFormData({
      name: product.name, category: product.category?.name || 'Bebidas', family: product.family?.name || 'Gaseosas', brand: product.brand?.name || 'Aje',
      unitWeight: product.unitWeight.toString(), stock: product.stock.toString(), priceUnit: product.units?.find(u => u.name === 'Unidad')?.price.toString() || '',
      expirationDate: product.expirationDate ? product.expirationDate.split('T')[0] : '', barcode: product.barcode || '', customUnits: custom
    })
    setEditingId(product.id); setShowForm(true); setView('products')
  }

  const handleEntrySubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    if (!isOnline) {
      const pending = JSON.parse(localStorage.getItem('pending_entries') || '[]');
      pending.push(entryData);
      localStorage.setItem('pending_entries', JSON.stringify(pending));
      alert('⚠️ Estás sin conexión. La entrada se guardó en tu dispositivo y se enviará a la nube cuando vuelva el internet.');
      setEntryData({ productId: '', quantity: '' });
      setLoading(false);
      return;
    }
    await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entryData) })
    setEntryData({ productId: '', quantity: '' }); await fetchProducts(); await fetchKardex(); setLoading(false); setView('kardex')
  }

  const addToCart = (e) => {
    e.preventDefault()
    const product = products.find(p => p.id === exitForm.productId)
    const qty = parseInt(exitForm.quantity)
    if (!product || qty <= 0) return alert('Seleccione producto y cantidad válida')
    if (qty > product.stock) return alert(`Stock insuficiente. Solo hay ${product.stock}`)
    setCart([...cart, { id: product.id, name: product.name, quantity: qty, weight: product.unitWeight * qty }])
    setExitForm({ ...exitForm, productId: '', quantity: '' })
  }

  const handleExitSubmit = async () => {
    if (cart.length === 0) return alert('La lista está vacía')
    if (!exitForm.deliveredBy || !exitForm.receivedBy) return alert('Complete quién entrega y quién recibe')
    if (!isOnline) return alert('⚠️ Estás sin conexión. Las salidas requieren internet en esta versión.');
    
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
          <div class="text-center bold" style="font-size: 16px;">MI EMPRESA S.A.C.</div><div class="text-center">RUC: 20123456789</div><div class="text-center">TICKET DE SALIDA (ALMACÉN)</div><div class="line"></div>
          <div>Fecha: ${new Date().toLocaleString()}</div><div>Entregado por: ${exitForm.deliveredBy}</div><div>Recibido por: ${exitForm.receivedBy}</div><div class="line"></div>
          <table><thead><tr><th>Cant.</th><th>Producto</th></tr></thead><tbody>${cart.map(item => `<tr><td class="bold">${item.quantity} und</td><td>${item.name}</td></tr>`).join('')}</tbody></table>
          <div class="line"></div><div class="bold">Total Items: ${cart.reduce((sum, item) => sum + item.quantity, 0)}</div><div class="bold">Peso Total: ${totalWeight.toFixed(2)} kg</div><div class="line"></div>
          <div class="text-center" style="margin-top: 10px;">_______________________</div><div class="text-center">Firma de Recepción</div><div class="text-center" style="margin-top: 20px; font-size: 10px;">Generado por Sistema de Inventario</div>
        </body></html>
      `;
      const printWindow = window.open('', '_blank'); printWindow.document.write(ticketHTML); printWindow.document.close(); printWindow.focus(); printWindow.print();
      alert('✅ Salida despachada e impresión generada.')
      setCart([]); setExitForm({ productId: '', quantity: '', reason: 'Venta', deliveredBy: '', receivedBy: '' })
      await fetchProducts(); await fetchKardex(); setView('kardex')
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const handleMermaSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    if (!isOnline) return alert('⚠️ Estás sin conexión. Las mermas requieren internet.');
    const finalQuantity = parseInt(mermaForm.quantity) * parseInt(mermaForm.unitMultiplier)
    try {
      const res = await fetch('/api/mermas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: mermaForm.productId, quantity: finalQuantity }) })
      if (!res.ok) throw new Error((await res.json()).error)
      alert(`✅ Se registraron ${finalQuantity} unidades como merma.`)
      setMermaForm({ productId: '', quantity: '', unitMultiplier: 1 }); await fetchProducts(); await fetchKardex()
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const handleUserSubmit = async (e) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userForm)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      alert('✅ Usuario creado exitosamente.')
      setUserForm({ name: '', email: '', password: '', role: 'ALMACEN' }); await fetchUsers()
    } catch (error) { alert('Error: ' + error.message) }
    setLoading(false)
  }

  const handleShareWhatsApp = () => {
    let message = `*PEDIDO A PROVEEDOR*\n\n*Fecha:* ${new Date().toLocaleDateString()}\n`;
    if (filterBrand) message += `*Marca:* ${filterBrand}\n`;
    if (filterCategory) message += `*Categoría:* ${filterCategory}\n`;
    message += `\n*Productos que necesitamos:*\n`;
    const itemsToOrder = missingProducts;
    if (itemsToOrder.length === 0) return alert("No hay productos faltantes para pedir con este filtro.");
    itemsToOrder.forEach((p, index) => { message += `${index + 1}. ${p.name} - (Stock actual: ${p.stock} und)\n`; });
    message += `\nPor favor, confirmar disponibilidad y tiempo de entrega. Gracias.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const exportProductsToExcel = () => {
    const dataToExport = filteredProducts.map(p => ({
      'Código': p.internalCode, 'Código de Barras': p.barcode || '-', 'Producto': p.name,
      'Marca': p.brand?.name || '-', 'Categoría': p.category?.name || '-', 'Stock (Unidades)': p.stock,
      'Stock (Desglose)': formatStock(p), 'Dañados': p.damagedStock,
      'Precio Unidad': p.units?.find(u => u.name === 'Unidad')?.price || 0,
      'Vencimiento': p.expirationDate ? new Date(p.expirationDate).toLocaleDateString() : '-'
    }))
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Inventario"); XLSX.writeFile(wb, "Inventario_Productos.xlsx")
  }

  const exportProductsToPDF = () => {
    const doc = new jsPDF(); doc.text("Reporte de Inventario - Productos", 14, 15)
    const tableData = filteredProducts.map(p => [p.name, p.brand?.name || '-', formatStock(p), `S/ ${(p.units?.find(u => u.name === 'Unidad')?.price || 0).toFixed(2)}`])
    doc.autoTable({ head: [['Producto', 'Marca', 'Stock', 'Precio Und']], body: tableData, startY: 20 }); doc.save("Inventario_Productos.pdf")
  }

  const exportKardexToExcel = () => {
    const dataToExport = kardex.map(m => ({
      'Fecha': new Date(m.createdAt).toLocaleString(), 'Producto': m.product?.name || '-', 'Tipo': m.type, 'Cantidad': m.quantity, 'Stock Anterior': m.previousStock, 'Stock Nuevo': m.newStock
    }))
    const ws = XLSX.utils.json_to_sheet(dataToExport); const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kardex"); XLSX.writeFile(wb, "Kardex_Movimientos.xlsx")
  }

  const exportKardexToPDF = () => {
    const doc = new jsPDF(); doc.text("Reporte de Kardex - Movimientos", 14, 15)
    const tableData = kardex.map(m => [new Date(m.createdAt).toLocaleString(), m.product?.name || '-', m.type, m.quantity.toString(), m.newStock.toString()])
    doc.autoTable({ head: [['Fecha', 'Producto', 'Tipo', 'Cant.', 'Stock Final']], body: tableData, startY: 20 }); doc.save("Kardex_Movimientos.pdf")
  }

  const totalWeight = cart.reduce((sum, item) => sum + item.weight, 0)
  const excedePeso = totalWeight > PESO_MAXIMO_MOTO
  const selectedMermaProduct = products.find(p => p.id === mermaForm.productId)

  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.barcode && p.barcode.includes(searchTerm)) || (p.internalCode && p.internalCode.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchBrand = filterBrand === '' || p.brand?.name === filterBrand;
    const matchCategory = filterCategory === '' || p.category?.name === filterCategory;
    return matchSearch && matchBrand && matchCategory;
  });

  const uniqueBrands = [...new Set(products.map(p => p.brand?.name).filter(Boolean))];
  const uniqueCategories = [...new Set(products.map(p => p.category?.name).filter(Boolean))];

  const missingProducts = products.filter(p => {
    const isLow = p.stock <= 10;
    const matchBrand = filterBrand === '' || p.brand?.name === filterBrand;
    const matchCategory = filterCategory === '' || p.category?.name === filterCategory;
    return isLow && matchBrand && matchCategory;
  });

  const totalStockValue = products.reduce((sum, p) => {
    const price = p.units?.find(u => u.name === 'Unidad')?.price || 0;
    return sum + (p.stock * price);
  }, 0);
  const totalWeightAll = products.reduce((sum, p) => sum + (p.stock * p.unitWeight), 0);
  const expiringProducts = products.filter(p => {
    if(!p.expirationDate) return false;
    const diffDays = Math.ceil((new Date(p.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {showScanner && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
            <h3>📷 Apunta al código de barras</h3>
            <div id="reader" style={{ width: '300px', margin: '20px auto' }}></div>
            <button onClick={() => setShowScanner(false)} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#1f2937' }}>📦 Sistema de Inventario</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>Bienvenido, <strong>{session?.user?.name}</strong> ({session?.user?.role})</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', backgroundColor: isOnline ? (isSyncing ? '#fef3c7' : '#d1fae5') : '#fee2e2', color: isOnline ? (isSyncing ? '#b45309' : '#065f46') : '#991b1b' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: isOnline ? (isSyncing ? '#f59e0b' : '#10b981') : '#ef4444' }}></div>
            {isOnline ? (isSyncing ? 'Sincronizando...' : 'En línea') : 'Sin conexión'}
          </div>
          <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Cerrar Sesión</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', flexWrap: 'wrap' }}>
        <button onClick={() => { setView('dashboard'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'dashboard' ? '#1e293b' : 'transparent', color: view === 'dashboard' ? 'white' : '#4b5563' }}>📊 Dashboard</button>
        <button onClick={() => { setView('products'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'products' ? '#2563eb' : 'transparent', color: view === 'products' ? 'white' : '#4b5563' }}>📦 Productos</button>
        <button onClick={() => { setView('entries'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'entries' ? '#10b981' : 'transparent', color: view === 'entries' ? 'white' : '#4b5563' }}>📥 Entradas</button>
        <button onClick={() => { setView('exits'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'exits' ? '#f59e0b' : 'transparent', color: view === 'exits' ? 'white' : '#4b5563' }}>🚚 Salidas</button>
        <button onClick={() => { setView('mermas'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'mermas' ? '#ef4444' : 'transparent', color: view === 'mermas' ? 'white' : '#4b5563' }}>⚠️ Mermas</button>
        <button onClick={() => { setView('reports'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'reports' ? '#ec4899' : 'transparent', color: view === 'reports' ? 'white' : '#4b5563' }}>🛒 Faltantes</button>
        <button onClick={() => { setView('kardex'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'kardex' ? '#8b5cf6' : 'transparent', color: view === 'kardex' ? 'white' : '#4b5563' }}>📋 Kardex</button>
        {session?.user?.role === 'ADMIN' && (
          <button onClick={() => { setView('users'); setShowForm(false); }} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', backgroundColor: view === 'users' ? '#0ea5e9' : 'transparent', color: view === 'users' ? 'white' : '#4b5563' }}>👥 Usuarios</button>
        )}
      </div>

      {view === 'dashboard' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #2563eb' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', fontWeight: 'bold' }}>Valor del Inventario</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>S/ {totalStockValue.toFixed(2)}</p>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', fontWeight: 'bold' }}>Peso Total Almacén</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{totalWeightAll.toFixed(2)} kg</p>
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '14px', fontWeight: 'bold' }}>Total Productos</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>{products.length}</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#ef4444' }}>⚠️ Alerta de Stock Bajo ({missingProducts.length})</h3>
              {missingProducts.length === 0 ? <p style={{ color: '#6b7280' }}>Todo tiene stock suficiente.</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {missingProducts.slice(0, 5).map(p => (
                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontWeight: 'bold' }}>{p.name}</span><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{p.stock} und</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 15px 0', color: '#b45309' }}>📅 Por Vencer (30 días) ({expiringProducts.length})</h3>
              {expiringProducts.length === 0 ? <p style={{ color: '#6b7280' }}>No hay productos próximos a vencer.</p> : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {expiringProducts.slice(0, 5).map(p => (
                    <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontWeight: 'bold' }}>{p.name}</span><span style={{ color: '#b45309', fontWeight: 'bold' }}>{new Date(p.expirationDate).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'reports' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div><h2 style={{ margin: 0, color: '#ec4899' }}>🛒 Faltantes</h2></div>
            <button onClick={handleShareWhatsApp} style={{ padding: '10px 20px', backgroundColor: '#25D366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}><span>📲</span> WhatsApp</button>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="">Todas las Categorías</option>{uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="">Todas las Marcas</option>{uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#fce7f3', textAlign: 'left' }}><th style={{padding:'10px'}}>Producto</th><th style={{padding:'10px'}}>Marca</th><th style={{padding:'10px'}}>Stock Actual</th><th style={{padding:'10px'}}>Sugerencia</th></tr></thead>
              <tbody>
                {missingProducts.length === 0 ? (<tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>¡Todo el stock está completo!</td></tr>) : (
                  missingProducts.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td><td style={{ padding: '12px' }}>{p.brand?.name}</td>
                      <td style={{ padding: '12px', color: '#ef4444', fontWeight: 'bold' }}>{p.stock} und</td><td style={{ padding: '12px', fontWeight: 'bold', color: '#059669' }}>Pedir {50 - p.stock > 0 ? 50 - p.stock : 20} und</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'products' && !showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Catálogo</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={exportProductsToExcel} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Excel</button>
              <button onClick={exportProductsToPDF} style={{ padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📄 PDF</button>
              <button onClick={() => setShowForm(true)} style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Nuevo</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, display: 'flex', gap: '5px', minWidth: '250px' }}>
              <input type="text" placeholder="🔍 Buscar por nombre o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
              <button onClick={() => { setScanMode('search'); setShowScanner(true); }} style={{ padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>📷</button>
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="">Todas las Categorías</option>{uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}>
              <option value="">Todas las Marcas</option>{uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Producto</th><th style={{padding:'10px'}}>Cód. Barras</th><th style={{padding:'10px'}}>Vencimiento</th><th style={{padding:'10px'}}>Stock Físico</th><th style={{padding:'10px'}}>Dañados</th><th style={{padding:'10px'}}>Acciones</th></tr></thead>
              <tbody>
                {filteredProducts.length === 0 ? (<tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No se encontraron productos</td></tr>) : (
                  filteredProducts.map(p => {
                    const expAlert = getExpirationAlert(p.expirationDate);
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name} <br/><span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>{p.brand?.name}</span></td>
                        <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>{p.barcode || '---'}</td>
                        <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: expAlert.color, backgroundColor: expAlert.bg }}>{expAlert.text}</span></td>
                        <td style={{ padding: '12px', color: '#2563eb', fontWeight: 'bold' }}>{formatStock(p)} <br/><span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>({p.stock} und)</span></td>
                        <td style={{ padding: '12px', color: '#ef4444', fontWeight: 'bold' }}>{p.damagedStock} und</td>
                        <td style={{ padding: '12px', display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleEdit(p)} style={{ padding: '6px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Editar</button>
                          <button onClick={() => handleDelete(p.id)} style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Eliminar</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'products' && showForm && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>{editingId ? 'Editar' : 'Nuevo Producto'}</h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Nombre (Ej: Inca Kola 500ml)" style={{ gridColumn: 'span 2', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            
            <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px' }}>
              <input type="text" value={formData.barcode} onChange={e => setFormData({...formData, barcode: e.target.value})} placeholder="Código de Barras (Opcional)" style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
              <button type="button" onClick={() => {
                const randomPart = Math.floor(Math.random() * 10000000000).toString().padStart(10, '0');
                setFormData({...formData, barcode: `200${randomPart}`});
              }} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }} title="Generar Código Automático">
                🪄 Auto
              </button>
              <button type="button" onClick={() => { setScanMode('form'); setShowScanner(true); }} style={{ padding: '10px 20px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                📷 Escanear
              </button>
            </div>

            <input type="text" required value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="Marca" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="number" required value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} placeholder="Stock Inicial (Unidades Base)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="number" step="0.01" required value={formData.unitWeight} onChange={e => setFormData({...formData, unitWeight: e.target.value})} placeholder="Peso 1 und (kg)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="number" step="0.01" required value={formData.priceUnit} onChange={e => setFormData({...formData, priceUnit: e.target.value})} placeholder="Precio 1 und (S/)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Fecha de Vencimiento (Opcional)</label>
              <input type="date" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ gridColumn: 'span 2', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Presentaciones (Opcional)</h3>
                <button type="button" onClick={addCustomUnit} style={{ padding: '6px 12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ Añadir Presentación</button>
              </div>
              {formData.customUnits.map((unit, index) => (
                <div key={index} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
                  <input type="text" required value={unit.name} onChange={e => updateCustomUnit(index, 'name', e.target.value)} placeholder="Nombre (Ej: Paquete, Fardo)" style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" required value={unit.multiplier} onChange={e => updateCustomUnit(index, 'multiplier', e.target.value)} placeholder="¿Cuántas und trae?" style={{ width: '150px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <input type="number" step="0.01" required value={unit.price} onChange={e => updateCustomUnit(index, 'price', e.target.value)} placeholder="Precio S/" style={{ width: '100px', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                  <button type="button" onClick={() => removeCustomUnit(index)} style={{ padding: '8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>X</button>
                </div>
              ))}
            </div>
            <button type="submit" disabled={loading} style={{ gridColumn: 'span 2', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '10px' }}>{loading ? 'Guardando...' : 'Guardar Producto'}</button>
            <button type="button" onClick={() => setShowForm(false)} style={{ gridColumn: 'span 2', padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </form>
        </div>
      )}

      {view === 'entries' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>Entradas</h2>
          {!isOnline && <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: '15px', borderRadius: '6px', fontWeight: 'bold' }}>⚠️ Sin conexión. Las entradas se guardarán localmente.</div>}
          <form onSubmit={handleEntrySubmit} style={{ display: 'flex', gap: '15px', marginTop: '20px', flexWrap: 'wrap' }}>
            <select required value={entryData.productId} onChange={e => setEntryData({...entryData, productId: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px' }}>
              <option value="">Seleccione producto...</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} (Hay: {formatStock(p)})</option>)}
            </select>
            <input type="number" required value={entryData.quantity} onChange={e => setEntryData({...entryData, quantity: e.target.value})} placeholder="Cant. (und base)" style={{ width: '120px', padding: '10px', borderRadius: '6px' }} />
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', backgroundColor: isOnline ? '#10b981' : '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
              {isOnline ? 'Registrar' : 'Guardar Offline'}
            </button>
          </form>
        </div>
      )}

      {view === 'exits' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
            <h2>🚚 Cargar a la Moto</h2>
            {!isOnline && <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: '15px', borderRadius: '6px', fontWeight: 'bold' }}>⚠️ Sin conexión. Las salidas requieren internet.</div>}
            <form onSubmit={addToCart} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <select required value={exitForm.productId} onChange={e => setExitForm({...exitForm, productId: e.target.value})} style={{ padding: '10px', borderRadius: '6px' }}>
                <option value="">Seleccione producto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Hay: {formatStock(p)})</option>)}
              </select>
              <input type="number" required value={exitForm.quantity} onChange={e => setExitForm({...exitForm, quantity: e.target.value})} placeholder="Cantidad (unidades base)" style={{ padding: '10px', borderRadius: '6px' }} />
              <button type="submit" style={{ padding: '10px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>+ Agregar a la Lista</button>
            </form>
          </div>
          <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px', border: excedePeso ? '3px solid red' : '1px solid #e5e7eb' }}>
            <h2>Lista de Carga</h2>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {cart.map((item, index) => (
                <li key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #eee' }}>
                  <span>{item.quantity} und x {item.name}</span><span style={{ fontWeight: 'bold' }}>{item.weight.toFixed(2)} kg</span>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '20px', padding: '15px', backgroundColor: excedePeso ? '#fee2e2' : '#f3f4f6', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Peso Total: {totalWeight.toFixed(2)} kg</p>
              {excedePeso && <p style={{ margin: '5px 0 0 0', color: '#b91c1c', fontWeight: 'bold', fontSize: '14px' }}>⚠️ ¡EXCEDE EL PESO PERMITIDO!</p>}
            </div>
            {cart.length > 0 && (
              <div style={{ marginTop: '20px', borderTop: '2px solid #e5e7eb', paddingTop: '20px' }}>
                <input type="text" placeholder="Entregado por (Almacén)" value={exitForm.deliveredBy} onChange={e => setExitForm({...exitForm, deliveredBy: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <input type="text" placeholder="Recibido por (Tienda)" value={exitForm.receivedBy} onChange={e => setExitForm({...exitForm, receivedBy: e.target.value})} style={{ width: '100%', padding: '10px', marginBottom: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                <button onClick={handleExitSubmit} disabled={excedePeso || loading} style={{ width: '100%', padding: '15px', backgroundColor: excedePeso ? '#9ca3af' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>Confirmar Despacho e Imprimir</button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'mermas' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>⚠️ Reportar Producto Dañado o Vencido</h2>
          <form onSubmit={handleMermaSubmit} style={{ display: 'flex', gap: '15px', marginTop: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Producto</label>
              <select required value={mermaForm.productId} onChange={e => setMermaForm({...mermaForm, productId: e.target.value, unitMultiplier: 1})} style={{ width: '100%', padding: '10px', borderRadius: '6px' }}>
                <option value="">Seleccione producto...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (Hay: {formatStock(p)})</option>)}
              </select>
            </div>
            {selectedMermaProduct && (
              <div style={{ width: '180px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Presentación</label>
                <select value={mermaForm.unitMultiplier} onChange={e => setMermaForm({...mermaForm, unitMultiplier: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px' }}>
                  <option value="1">Unidad (botella)</option>
                  {selectedMermaProduct.units?.filter(u => u.name !== 'Unidad').map(u => (
                    <option key={u.id} value={u.multiplier}>{u.name} (x{u.multiplier})</option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ width: '150px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '5px' }}>Cantidad</label>
              <input type="number" required value={mermaForm.quantity} onChange={e => setMermaForm({...mermaForm, quantity: e.target.value})} placeholder="Ej: 1" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            </div>
            <button type="submit" disabled={loading} style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', height: '42px' }}>{loading ? 'Procesando...' : 'Reportar Merma'}</button>
          </form>
        </div>
      )}

      {view === 'kardex' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0 }}>Kardex</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={exportKardexToExcel} style={{ padding: '10px 15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📥 Excel</button>
              <button onClick={exportKardexToPDF} style={{ padding: '10px 15px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📄 PDF</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Fecha</th><th style={{padding:'10px'}}>Producto</th><th style={{padding:'10px'}}>Tipo</th><th style={{padding:'10px'}}>Cant.</th><th style={{padding:'10px'}}>Stock Final</th></tr></thead>
              <tbody>
                {kardex.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '10px', fontSize: '12px' }}>{new Date(m.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.product?.name}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ padding: '4px', borderRadius: '4px', backgroundColor: m.type === 'ENTRADA' ? '#d1fae5' : m.type === 'SALIDA' ? '#fee2e2' : '#fef3c7', color: m.type === 'ENTRADA' ? '#065f46' : m.type === 'SALIDA' ? '#991b1b' : '#92400e' }}>{m.type}</span>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 'bold' }}>{m.quantity}</td>
                    <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{m.newStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'users' && session?.user?.role === 'ADMIN' && (
        <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '12px' }}>
          <h2>👥 Gestión de Usuarios</h2>
          <form onSubmit={handleUserSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px', backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', marginTop: '20px' }}>
            <input type="text" required placeholder="Nombre completo" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="email" required placeholder="Correo electrónico" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <input type="password" required placeholder="Contraseña" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
            <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
              <option value="ALMACEN">Almacén</option><option value="TIENDA">Tienda</option><option value="ADMIN">Administrador</option>
            </select>
            <button type="submit" disabled={loading} style={{ gridColumn: 'span 4', padding: '10px', backgroundColor: '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>{loading ? 'Creando...' : '+ Crear Usuario'}</button>
          </form>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}><th style={{padding:'10px'}}>Nombre</th><th style={{padding:'10px'}}>Correo</th><th style={{padding:'10px'}}>Rol</th><th style={{padding:'10px'}}>Fecha de Registro</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>{u.name}</td>
                  <td style={{ padding: '12px' }}>{u.email}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: u.role === 'ADMIN' ? '#fee2e2' : u.role === 'ALMACEN' ? '#d1fae5' : '#fef3c7', color: u.role === 'ADMIN' ? '#991b1b' : u.role === 'ALMACEN' ? '#065f46' : '#92400e' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '12px', color: '#6b7280' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
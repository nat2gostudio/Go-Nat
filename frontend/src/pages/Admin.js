import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Plus, X, Trash2, Receipt } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function Admin() {
  const [tasks, setTasks] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'iva', // iva, irpf, cuota, factura, ingreso
    amount: '',
    due_date: ''
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin_tasks`, { withCredentials: true });
      setTasks(res.data);
    } catch (e) {
      toast.error('Error al cargar recordatorios');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;
    
    try {
      const payload = { ...formData, amount: formData.amount ? parseFloat(formData.amount) : null };
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/admin_tasks`, payload, { withCredentials: true });
      toast.success('Recordatorio añadido');
      setIsModalOpen(false);
      setFormData({ title: '', type: 'iva', amount: '', due_date: '' });
      fetchTasks();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const completeTask = async (id) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/admin_tasks/${id}`, { withCredentials: true });
      toast.success('¡Completado y eliminado!');
      fetchTasks();
    } catch (e) {
      toast.error('Error al completar');
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'iva':
      case 'irpf': 
        return <AlertTriangle className="text-amber-500" size={20} />;
      case 'factura':
      case 'ingreso':
        return <Receipt className="text-blue-500" size={20} />;
      default: 
        return <AlertTriangle className="text-secondary" size={20} />;
    }
  };

  const obligaciones = tasks.filter(t => ['iva', 'irpf', 'cuota'].includes(t.type));
  const facturas = tasks.filter(t => ['factura', 'ingreso'].includes(t.type));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">No Olvidar</h1>
          <p className="text-secondary text-sm mt-1">Impuestos, cuotas y pagos críticos.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} data-testid="add-admin-task-btn">
          <Plus className="mr-2 h-4 w-4" /> Añadir Recordatorio
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Taxes & Fees */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary">Obligaciones e Impuestos</h2>
          {obligaciones.length === 0 ? (
            <Card className="shadow-none border-dashed bg-muted/20">
              <CardContent className="p-6 text-center text-sm text-secondary">
                Todo al día.
              </CardContent>
            </Card>
          ) : (
            obligaciones.map(task => (
              <Card key={task.id} className="shadow-none group border-amber-200 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white dark:bg-card p-2 rounded-md shadow-sm border border-amber-100 dark:border-amber-900/50">
                      {getIcon(task.type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <div className="flex items-center gap-3 text-xs text-secondary mt-0.5">
                        {task.due_date && <span>Vence: <strong className="text-foreground">{task.due_date}</strong></span>}
                        {task.amount && <span>Importe: <strong className="text-foreground">{task.amount}€</strong></span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-green-600 hover:bg-green-100 hover:text-green-700 h-9 w-9" onClick={() => completeTask(task.id)} title="Marcar como pagado/completado">
                    <CheckCircle size={18} />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {/* Pending Invoices */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary">Facturas & Pagos Pendientes</h2>
          {facturas.length === 0 ? (
            <Card className="shadow-none border-dashed bg-muted/20">
              <CardContent className="p-6 text-center text-sm text-secondary">
                No hay facturas pendientes.
              </CardContent>
            </Card>
          ) : (
            facturas.map(task => (
              <Card key={task.id} className="shadow-none border-blue-200 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-white dark:bg-card p-2 rounded-md shadow-sm border border-blue-100 dark:border-blue-900/50">
                      {getIcon(task.type)}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <div className="flex items-center gap-3 text-xs text-secondary mt-0.5">
                        {task.due_date && <span>Fecha: <strong className="text-foreground">{task.due_date}</strong></span>}
                        {task.amount && <span className={task.type === 'ingreso' ? 'text-emerald-600 font-semibold' : 'text-foreground font-semibold'}>
                          {task.type === 'ingreso' ? '+' : '-'}{task.amount}€
                        </span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-green-600 hover:bg-green-100 hover:text-green-700 h-9 w-9" onClick={() => completeTask(task.id)} title="Resolver">
                    <CheckCircle size={18} />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>

      {/* Modal Añadir Recordatorio */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-xl border shadow-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Añadir Recordatorio Crítico</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <form id="admin-form" onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Concepto *</label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  required 
                  placeholder="Ej. Liquidación IVA 3T..." 
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                >
                  <option value="iva">IVA</option>
                  <option value="irpf">IRPF</option>
                  <option value="cuota">Cuota Autónomos / Software</option>
                  <option value="factura">Factura a Pagar</option>
                  <option value="ingreso">Ingreso Esperado</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Importe (€) Opcional</label>
                  <Input 
                    type="number"
                    step="0.01"
                    value={formData.amount} 
                    onChange={e => setFormData({...formData, amount: e.target.value})} 
                    placeholder="Ej. 150.50" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fecha Límite</label>
                  <Input 
                    type="date"
                    value={formData.due_date} 
                    onChange={e => setFormData({...formData, due_date: e.target.value})} 
                  />
                </div>
              </div>
            </form>
            
            <div className="p-5 border-t bg-muted/20 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="admin-form">Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Calendar, FileText, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    service_type: '',
    project_status: 'Activo',
    next_delivery: '',
    billing_status: 'Al día',
    links: {
      canva: '',
      meta: '',
      web: '',
      other: ''
    }
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/clients`, { withCredentials: true });
      setClients(res.data);
    } catch (e) {
      toast.error('Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      links: { ...prev.links, [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.service_type) {
      toast.error('Nombre y Servicio son obligatorios');
      return;
    }
    
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/clients`, formData, { withCredentials: true });
      toast.success('Cliente creado correctamente');
      setIsModalOpen(false);
      setFormData({
        name: '', service_type: '', project_status: 'Activo', next_delivery: '', billing_status: 'Al día',
        links: { canva: '', meta: '', web: '', other: '' }
      });
      fetchClients();
    } catch (error) {
      toast.error('Error al crear el cliente');
    }
  };

  const deleteClient = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar este cliente?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/clients/${id}`, { withCredentials: true });
      toast.success('Cliente eliminado');
      fetchClients();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Base de Clientes</h1>
          <p className="text-secondary text-sm mt-1">Gestiona los proyectos y accesos rápidos.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary w-4 h-4" />
            <Input className="pl-9 w-full md:w-64" placeholder="Buscar cliente..." />
          </div>
          <Button onClick={() => setIsModalOpen(true)} data-testid="add-client-btn">
            <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-secondary">Cargando...</p>
      ) : clients.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-md bg-card/50">
          <p className="text-secondary">No tienes clientes activos. Crea tu primer cliente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id} className="shadow-none flex flex-col group">
              <CardContent className="p-6 flex flex-col h-full flex-1">
                <div className="flex justify-between items-start mb-4 relative">
                  <div>
                    <h3 className="text-xl font-medium">{client.name}</h3>
                    <p className="text-sm text-secondary mt-1">{client.service_type}</p>
                  </div>
                  <button 
                    onClick={() => deleteClient(client.id)}
                    className="text-secondary hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0"
                    title="Eliminar cliente"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                <div className="space-y-3 mb-6 flex-1">
                  <div className="flex items-center text-sm gap-2">
                    <Calendar className="w-4 h-4 text-secondary" />
                    <span className="text-secondary">Entrega: {client.next_delivery || 'Sin fecha'}</span>
                  </div>
                  <div className="flex items-center text-sm gap-2">
                    <FileText className="w-4 h-4 text-secondary" />
                    <span className="text-secondary">Pago: {client.billing_status || 'Pendiente'}</span>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-medium text-secondary mb-3 uppercase tracking-widest">Enlaces Rápidos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {client.links?.canva && (
                      <a href={client.links.canva} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">Canva</Button>
                      </a>
                    )}
                    {client.links?.meta && (
                      <a href={client.links.meta} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">Meta</Button>
                      </a>
                    )}
                    {client.links?.web && (
                      <a href={client.links.web} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">Web</Button>
                      </a>
                    )}
                    {client.links?.other && (
                      <a href={client.links.other} target="_blank" rel="noreferrer">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8">Otros</Button>
                      </a>
                    )}
                    {(!client.links || (!client.links.canva && !client.links.meta && !client.links.web && !client.links.other)) && (
                      <span className="text-xs text-secondary italic col-span-4">Sin enlaces configurados</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Simple Custom Modal for adding clients (ADHD-friendly, no clutter) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-lg rounded-xl border shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between bg-muted/30">
              <h2 className="text-xl font-semibold">Añadir Nuevo Cliente</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-secondary">Información Básica</h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre del Cliente / Proyecto *</label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ej. Clínica Dental Sonrisas" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Servicio *</label>
                      <Input value={formData.service_type} onChange={e => setFormData({...formData, service_type: e.target.value})} required placeholder="Ej. Gestión RRSS, Diseño Web..." />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Próxima Entrega</label>
                      <Input type="date" value={formData.next_delivery} onChange={e => setFormData({...formData, next_delivery: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Estado de Pago</label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={formData.billing_status} 
                        onChange={e => setFormData({...formData, billing_status: e.target.value})}
                      >
                        <option value="Al día">Al día</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="Atrasado">Atrasado</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-secondary">Enlaces Rápidos (Opcional)</h3>
                  <p className="text-xs text-secondary mb-2">Añade los links que uses frecuentemente para este cliente para abrirlos en 1 clic.</p>
                  
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Enlace a Canva</label>
                      <Input placeholder="https://canva.com/..." value={formData.links.canva} onChange={e => handleLinkChange('canva', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Enlace a Meta Business</label>
                      <Input placeholder="https://business.facebook.com/..." value={formData.links.meta} onChange={e => handleLinkChange('meta', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Página Web</label>
                      <Input placeholder="https://..." value={formData.links.web} onChange={e => handleLinkChange('web', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Otro enlace (Drive, Edit, etc)</label>
                      <Input placeholder="https://..." value={formData.links.other} onChange={e => handleLinkChange('other', e.target.value)} />
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-6 border-t bg-muted/10 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="client-form">Guardar Cliente</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Search, Calendar, FileText, X, RotateCcw, Link2, ExternalLink, CheckSquare } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const initialSocialPosts = {
    instagram: { target: 0, completed: 0 },
    facebook: { target: 0, completed: 0 },
    tiktok: { target: 0, completed: 0 },
    google_business: { target: 0, completed: 0 },
    blog: { target: 0, completed: 0 }
  };

  const [formData, setFormData] = useState({
    name: '',
    service_type: 'RRSS',
    project_status: 'Activo',
    next_delivery: '',
    billing_status: 'Al día',
    links: { canva: '', meta: '', web: '', other: '' },
    social_posts: initialSocialPosts,
    url_promos: ''
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

  const handleSocialTargetChange = (network, value) => {
    const num = parseInt(value, 10) || 0;
    setFormData(prev => ({
      ...prev,
      social_posts: {
        ...prev.social_posts,
        [network]: { ...prev.social_posts[network], target: num }
      }
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
        name: '', service_type: 'RRSS', project_status: 'Activo', next_delivery: '', billing_status: 'Al día',
        links: { canva: '', meta: '', web: '', other: '' },
        social_posts: initialSocialPosts,
        url_promos: ''
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
  };

  const incrementPost = async (clientId, network, currentSocialPosts) => {
    const current = currentSocialPosts || initialSocialPosts;
    const updated = {
      ...current,
      [network]: {
        ...current[network],
        completed: (current[network]?.completed || 0) + 1
      }
    };
    
    setClients(clients.map(c => c.id === clientId ? { ...c, social_posts: updated } : c));
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/clients/${clientId}`, { social_posts: updated }, { withCredentials: true });
    } catch (e) {
      toast.error("Error al actualizar");
      fetchClients();
    }
  };

  const resetWeeklyPosts = async (clientId, currentSocialPosts) => {
    if (!window.confirm('¿Poner todos los contadores de la semana a 0?')) return;
    const current = currentSocialPosts || initialSocialPosts;
    const updated = {};
    for (let key in current) {
      updated[key] = { ...current[key], completed: 0 };
    }
    
    setClients(clients.map(c => c.id === clientId ? { ...c, social_posts: updated } : c));
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/clients/${clientId}`, { social_posts: updated }, { withCredentials: true });
      toast.success("Contadores a 0");
    } catch (e) {
      toast.error("Error al resetear");
      fetchClients();
    }
  };

  const updateClientField = async (clientId, field, value) => {
    setClients(clients.map(c => c.id === clientId ? { ...c, [field]: value } : c));
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/clients/${clientId}`, { [field]: value }, { withCredentials: true });
    } catch (e) {
      toast.error("Error al actualizar");
      fetchClients();
    }
  };

  const toggleChecklistItem = async (clientId, checklist, itemId) => {
    const updatedChecklist = checklist.map(item => 
      item.id === itemId ? { ...item, done: !item.done } : item
    );
    setClients(clients.map(c => c.id === clientId ? { ...c, checklist: updatedChecklist } : c));
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/clients/${clientId}`, { checklist: updatedChecklist }, { withCredentials: true });
    } catch (e) {
      toast.error("Error al actualizar checklist");
      fetchClients();
    }
  };

  const getUrgency = (dateString) => {
    if (!dateString) return { percent: 0, color: 'bg-secondary/20', text: 'Sin fecha' };
    const today = new Date();
    today.setHours(0,0,0,0);
    const delivery = new Date(dateString);
    const diffTime = delivery - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { percent: 100, color: 'bg-red-500', text: 'Atrasado' };
    if (diffDays === 0) return { percent: 100, color: 'bg-red-500', text: 'Hoy' };
    if (diffDays <= 3) return { percent: 85, color: 'bg-orange-500', text: `En ${diffDays} días` };
    if (diffDays <= 7) return { percent: 60, color: 'bg-amber-400', text: `En ${diffDays} días` };
    return { percent: 25, color: 'bg-emerald-400', text: `En ${diffDays} días` };
  };

  const networkLabels = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    google_business: "Google Business",
    blog: "Blog"
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Base de Clientes</h1>
          <p className="text-secondary text-sm mt-1">Gestiona los proyectos, entregas y objetivos de contenido.</p>
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
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {clients.map(client => {
            const urgency = getUrgency(client.next_delivery);
            const socialData = client.social_posts || {};
            const hasSocial = Object.values(socialData).some(n => n?.target > 0);
            
            const isWebOrNeuro = ['Web_Mantenimiento', 'NeuroAlly_PRO'].includes(client.service_type);
            const isNeuroPro = client.service_type === 'NeuroAlly_PRO';
            
            return (
              <Card key={client.id} className="shadow-none flex flex-col group relative overflow-hidden">
                {/* Visual Progress Bar at the top */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-secondary/10">
                  <div className={`h-full transition-all duration-500 ${urgency.color}`} style={{ width: `${urgency.percent}%` }} />
                </div>
                
                <CardContent className="p-6 pt-7 flex flex-col h-full flex-1">
                  <div className="flex justify-between items-start mb-4 relative">
                    <div>
                      <h3 className="text-xl font-medium">{client.name}</h3>
                      <span className="inline-block mt-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm">
                        {client.service_type.replace('_', ' ')}
                      </span>
                    </div>
                    <button 
                      onClick={() => deleteClient(client.id)}
                      className="text-secondary hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 top-0"
                      title="Eliminar cliente"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-5">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center text-sm gap-2">
                        <Calendar className="w-4 h-4 text-secondary" />
                        <span className="text-secondary">Entrega: {client.next_delivery || 'Sin fecha'}</span>
                        {client.next_delivery && (
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm font-semibold ${urgency.color.replace('bg-', 'text-').replace('-500', '-700').replace('-400', '-700')} ${urgency.color.replace('bg-', 'bg-').replace('500', '100').replace('400', '100')}`}>
                            {urgency.text}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center text-sm gap-2">
                      <FileText className="w-4 h-4 text-secondary" />
                      <span className="text-secondary">Pago: {client.billing_status || 'Pendiente'}</span>
                    </div>
                  </div>

                  {/* Tracker Web_Mantenimiento / NeuroAlly_PRO */}
                  {isWebOrNeuro && (
                    <div className="mb-5 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                      <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-400 mb-3">Mantenimiento Mensual</p>
                      
                      <div className="flex items-center justify-between bg-white dark:bg-card p-2 rounded-md border shadow-sm mb-3">
                        <div>
                          <span className="text-sm font-medium text-foreground">Newsletters</span>
                          <p className="text-xs text-secondary">{client.newsletters_count || 0} de 2 completadas</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant={(client.newsletters_count || 0) >= 2 ? "outline" : "secondary"}
                          className={`h-8 ${((client.newsletters_count || 0) >= 2) ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : ''}`}
                          onClick={() => updateClientField(client.id, 'newsletters_count', (client.newsletters_count || 0) + 1)}
                        >
                          <Plus size={14} className="mr-1" /> 1 Newsletter
                        </Button>
                      </div>

                      <div className="flex gap-4 px-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-600 w-4 h-4"
                            checked={client.blog_done || false}
                            onChange={() => updateClientField(client.id, 'blog_done', !client.blog_done)}
                          />
                          <span className="text-sm font-medium">Blog</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-600 w-4 h-4"
                            checked={client.banners_done || false}
                            onChange={() => updateClientField(client.id, 'banners_done', !client.banners_done)}
                          />
                          <span className="text-sm font-medium">Banners</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Checklist NeuroAlly PRO */}
                  {isNeuroPro && client.checklist && client.checklist.length > 0 && (
                    <div className="mb-5 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary flex items-center gap-1">
                        <CheckSquare size={12} /> Checklist Setup
                      </p>
                      <div className="space-y-1">
                        {client.checklist.map(item => (
                          <label key={item.id} className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-muted/50 rounded-md transition-colors">
                            <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-primary focus:ring-primary w-4 h-4 shrink-0"
                              checked={item.done}
                              onChange={() => toggleChecklistItem(client.id, client.checklist, item.id)}
                            />
                            <span className={`text-sm ${item.done ? 'text-secondary line-through' : 'font-medium'}`}>
                              {item.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Social Posts Tracker */}
                  {hasSocial && (
                    <div className="mb-5 bg-muted/20 p-3 rounded-lg border">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-secondary">RRSS Semanal</p>
                        <button 
                          onClick={() => resetWeeklyPosts(client.id, socialData)}
                          className="text-secondary hover:text-primary transition-colors flex items-center gap-1"
                          title="Poner contadores a 0"
                        >
                          <RotateCcw size={12} />
                          <span className="text-[10px] uppercase">Reset</span>
                        </button>
                      </div>
                      
                      <div className="space-y-3">
                        {Object.entries(socialData).map(([network, data]) => {
                          if (!data || data.target <= 0) return null;
                          const percent = Math.min(100, (data.completed / data.target) * 100);
                          const isComplete = data.completed >= data.target;
                          
                          return (
                            <div key={network} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-medium text-secondary">{networkLabels[network]}</span>
                                  <span className={isComplete ? "text-emerald-600 font-semibold" : "text-secondary"}>
                                    {data.completed} de {data.target}
                                  </span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-300 ${isComplete ? 'bg-emerald-500' : 'bg-primary'}`} 
                                    style={{ width: `${percent}%` }} 
                                  />
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                variant={isComplete ? "outline" : "secondary"} 
                                className={`h-7 w-20 shrink-0 text-xs ${isComplete ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : ''}`}
                                onClick={() => incrementPost(client.id, network, socialData)}
                              >
                                <Plus size={12} className="mr-1" /> 1 Post
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-4 mt-auto">
                    <p className="text-xs font-medium text-secondary mb-3 uppercase tracking-widest">Enlaces Rápidos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {client.url_promos && (
                        <a href={client.url_promos} target="_blank" rel="noreferrer" className="col-span-2 sm:col-span-4 mb-1">
                          <Button variant="outline" size="sm" className="w-full text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-400">
                            <ExternalLink size={12} className="mr-2" /> Promos del Mes
                          </Button>
                        </a>
                      )}
                      
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
                      {(!client.links || (!client.links.canva && !client.links.meta && !client.links.web && !client.links.other && !client.url_promos)) && (
                        <span className="text-xs text-secondary italic col-span-4">Sin enlaces configurados</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Añadir Cliente */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl rounded-xl border shadow-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between bg-muted/30">
              <h2 className="text-xl font-semibold">Añadir Nuevo Cliente</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <form id="client-form" onSubmit={handleSubmit} className="space-y-8">
                
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-secondary">Información Básica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Nombre del Proyecto *</label>
                      <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ej. Clínica Dental" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Servicio *</label>
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={formData.service_type} 
                        onChange={e => setFormData({...formData, service_type: e.target.value})}
                      >
                        <option value="RRSS">RRSS</option>
                        <option value="Web_Mantenimiento">Web Mantenimiento</option>
                        <option value="NeuroAlly_PRO">NeuroAlly PRO</option>
                      </select>
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
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-secondary">Objetivos Semanales de Contenido (RRSS)</h3>
                  <p className="text-xs text-secondary mb-3">Introduce cuántos posts quieres hacer a la semana. (Deja en 0 si no aplica)</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(networkLabels).map(([key, label]) => (
                      <div key={key} className="space-y-1.5 bg-muted/30 p-2 rounded-md border border-border/50">
                        <label className="text-xs font-medium">{label}</label>
                        <Input 
                          type="number" 
                          min="0" 
                          className="h-8 text-sm"
                          value={formData.social_posts[key].target} 
                          onChange={e => handleSocialTargetChange(key, e.target.value)} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-secondary">Enlaces Rápidos</h3>
                  
                  <div className="space-y-2 mb-4 bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    <label className="text-xs font-semibold text-blue-700 dark:text-blue-400">URL Promos del Mes</label>
                    <Input placeholder="https://..." value={formData.url_promos} onChange={e => setFormData({...formData, url_promos: e.target.value})} className="bg-white dark:bg-card" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Canva</label>
                      <Input placeholder="https://canva.com/..." value={formData.links.canva} onChange={e => handleLinkChange('canva', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Meta Business</label>
                      <Input placeholder="https://business.facebook.com/..." value={formData.links.meta} onChange={e => handleLinkChange('meta', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Página Web</label>
                      <Input placeholder="https://..." value={formData.links.web} onChange={e => handleLinkChange('web', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium">Otros (Drive, Edit...)</label>
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

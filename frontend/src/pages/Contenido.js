import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, Trash2, ArrowRight, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Contenido() {
  const [ideas, setIdeas] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
  const [quickIdea, setQuickIdea] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    status: 'idea',
    reusable: false,
    notes: '',
    reference_url: ''
  });

  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/content`, { withCredentials: true });
      setIdeas(res.data);
    } catch (e) {
      toast.error('Error al cargar contenido');
    }
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (!quickIdea.trim()) return;
    
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/content`, {
        title: quickIdea,
        status: 'idea',
        reusable: false,
        notes: '',
        reference_url: ''
      }, { withCredentials: true });
      toast.success('Idea capturada');
      setQuickIdea('');
      setIsQuickCaptureOpen(false);
      fetchIdeas();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) return;
    
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/content`, formData, { withCredentials: true });
      toast.success('Añadido correctamente');
      setIsModalOpen(false);
      setFormData({ title: '', status: 'idea', reusable: false, notes: '', reference_url: '' });
      fetchIdeas();
    } catch (e) {
      toast.error('Error al guardar');
    }
  };

  const deleteIdea = async (id) => {
    if (!window.confirm('¿Eliminar esto?')) return;
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/content/${id}`, { withCredentials: true });
      toast.success('Eliminado');
      fetchIdeas();
    } catch (e) {
      toast.error('Error al eliminar');
    }
  };

  const moveIdea = async (idea, newStatus) => {
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/content/${idea.id}`, { status: newStatus }, { withCredentials: true });
      fetchIdeas();
    } catch (e) {
      toast.error('Error al mover');
    }
  };

  const columns = [
    { id: 'idea', title: 'Ideas Rápidas', next: 'pending' },
    { id: 'pending', title: 'Pendiente', next: 'published' },
    { id: 'published', title: 'Publicado', next: null }
  ];

  return (
    <div className="space-y-8 h-[calc(100vh-120px)] flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contenido</h1>
          <p className="text-secondary text-sm mt-1">Tus ideas sin fricción.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick Capture Form Inline */}
          {isQuickCaptureOpen ? (
            <form onSubmit={handleQuickSubmit} className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
              <Input 
                autoFocus
                placeholder="Escribe una idea brillante..."
                className="w-64 border-primary/50 shadow-sm"
                value={quickIdea}
                onChange={e => setQuickIdea(e.target.value)}
                onBlur={() => { if(!quickIdea) setIsQuickCaptureOpen(false); }}
              />
              <Button type="submit" size="sm" className="px-4">Añadir</Button>
            </form>
          ) : (
            <Button onClick={() => setIsQuickCaptureOpen(true)} className="bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-200 shadow-none dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-900/50">
              <Zap className="mr-2 h-4 w-4" /> Captura Rápida de Emergencia
            </Button>
          )}

          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Idea Completa
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden min-h-0">
        {columns.map(col => (
          <div key={col.id} className="bg-muted/30 rounded-xl p-4 flex flex-col h-full border border-border/50 overflow-hidden">
            <h3 className="font-semibold mb-4 flex justify-between items-center text-sm uppercase tracking-widest text-secondary shrink-0">
              {col.title}
              <span className="bg-secondary/20 px-2.5 py-0.5 rounded-full text-xs text-foreground font-medium">{ideas.filter(i => i.status === col.id).length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {ideas.filter(i => i.status === col.id).length === 0 ? (
                <div className="text-center p-6 border border-dashed rounded-md bg-card/50 text-sm text-secondary">
                  Vacío
                </div>
              ) : (
                ideas.filter(i => i.status === col.id).map(idea => (
                  <div key={idea.id} className="bg-card p-4 rounded-xl border border-border shadow-sm group hover:border-primary/30 transition-colors relative">
                    <div className="pr-6">
                      <p className="font-medium text-sm leading-relaxed">{idea.title}</p>
                      {idea.reference_url && (
                        <a href={idea.reference_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline mt-1 block truncate">
                          Link de ref.
                        </a>
                      )}
                      {idea.notes && <p className="text-xs text-secondary mt-2 line-clamp-2">{idea.notes}</p>}
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        {idea.reusable && <span className="text-[10px] uppercase tracking-wider font-semibold bg-emerald-100 text-emerald-800 px-2 py-1 rounded-sm">Reutilizable</span>}
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-secondary hover:text-destructive hover:bg-destructive/10" onClick={() => deleteIdea(idea.id)}>
                          <Trash2 size={14} />
                        </Button>
                        {col.next && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 bg-secondary/10 hover:bg-primary hover:text-primary-foreground" onClick={() => moveIdea(idea, col.next)}>
                            <ArrowRight size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nueva Idea (Completa) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-xl border shadow-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Guardar Idea Rápida</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <form id="idea-form" onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Idea o Título *</label>
                <Input 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  required 
                  placeholder="Ej. Reel sobre 3 tips de branding..." 
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Link de Referencia (Opcional)</label>
                <Input 
                  value={formData.reference_url} 
                  onChange={e => setFormData({...formData, reference_url: e.target.value})} 
                  placeholder="https://instagram.com/..." 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Notas (Opcional)</label>
                <textarea 
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none h-20"
                  value={formData.notes} 
                  onChange={e => setFormData({...formData, notes: e.target.value})} 
                  placeholder="Audio trending, texto en pantalla..."
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="reusable" 
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  checked={formData.reusable}
                  onChange={e => setFormData({...formData, reusable: e.target.checked})}
                />
                <label htmlFor="reusable" className="text-sm font-medium">Marcar como contenido reutilizable</label>
              </div>
            </form>
            
            <div className="p-5 border-t bg-muted/20 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="idea-form">Guardar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

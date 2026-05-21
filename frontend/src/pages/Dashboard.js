import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Link2, Calendar, Mail, FileText, ExternalLink, Image, AlertCircle, Briefcase, X, Trash2, Receipt, Dices } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskData, setTaskData] = useState({
    title: '',
    category: 'priority',
  });

  const [diceInput, setDiceInput] = useState('');
  const [diceResult, setDiceResult] = useState('');
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchEvents();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/tasks`, { withCredentials: true });
      setTasks(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/calendar/events`, { withCredentials: true });
      if (Array.isArray(res.data)) {
        setEvents(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDiceRoll = () => {
    if (!diceInput.trim()) return;
    
    let options = diceInput.split(/(?:\s+vs\s+|\s+o\s+|-|,)/i).map(s => s.trim()).filter(Boolean);
    if (options.length < 2) {
       options = diceInput.split(' ').map(s => s.trim()).filter(Boolean);
       if (options.length < 2) {
         toast.error('Escribe al menos dos opciones (Ej: Framer vs WordPress)');
         return;
       }
    }
    
    setIsRolling(true);
    setDiceResult('🎲 Pensando...');
    
    let counter = 0;
    const interval = setInterval(() => {
      setDiceResult(options[counter % options.length]);
      counter++;
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      const winner = options[Math.floor(Math.random() * options.length)];
      setDiceResult(`Tu intuición dice: ${winner} ✨`);
      setIsRolling(false);
    }, 1000);
  };

  const priorities = tasks.filter(t => t.category === 'priority' && !t.completed).slice(0, 3);
  const urgent = tasks.filter(t => t.category === 'urgent' && !t.completed);

  const connectCalendar = () => {
    window.location.href = `${process.env.REACT_APP_BACKEND_URL}/api/auth/google/login`;
  };

  const toggleTask = async (task) => {
    try {
      await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/tasks/${task.id}`, { completed: !task.completed }, { withCredentials: true });
      fetchTasks();
    } catch (e) {
      toast.error("Error updating task");
    }
  };

  const deleteTask = async (id) => {
    try {
      await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/tasks/${id}`, { withCredentials: true });
      fetchTasks();
    } catch (e) {
      toast.error("Error al eliminar la tarea");
    }
  };

  const handleTaskSubmit = async (e) => {
    e.preventDefault();
    if (!taskData.title) return;
    
    try {
      await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/tasks`, taskData, { withCredentials: true });
      toast.success('Tarea añadida');
      setIsTaskModalOpen(false);
      setTaskData({ title: '', category: 'priority' });
      fetchTasks();
    } catch (e) {
      toast.error('Error al guardar la tarea');
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-primary">Buenos días</h1>
          <p className="text-secondary mt-2 text-lg">¿Qué necesitamos hacer hoy?</p>
        </div>
        <Button onClick={() => setIsTaskModalOpen(true)} className="shrink-0 h-12 px-6 shadow-none" data-testid="quick-add-btn">
          <Plus className="mr-2" size={20} /> Añadir tarea rápida
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Priorities */}
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4">Top 3 Prioridades</h2>
            <div className="space-y-4">
              {priorities.length === 0 ? (
                <div className="p-8 border border-dashed rounded-md text-center text-secondary bg-muted/50">
                  <p>No hay prioridades para hoy. ¡Todo listo!</p>
                </div>
              ) : (
                priorities.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 md:p-6 bg-card border rounded-md group hover:border-primary/50 transition-colors relative">
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.completed ? 'bg-primary border-primary' : 'border-primary/20 hover:border-primary'}`}
                    >
                    </button>
                    <span className="text-xl font-medium">{task.title}</span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="absolute right-6 opacity-0 group-hover:opacity-100 text-secondary hover:text-destructive transition-opacity"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section>
              <h2 className="text-sm font-semibold tracking-widest uppercase text-destructive mb-4 flex items-center gap-2">
                <AlertCircle size={16}/> Tareas Urgentes
              </h2>
              <div className="space-y-3">
                {urgent.length === 0 ? (
                  <p className="text-sm text-secondary">Nada urgente.</p>
                ) : (
                  urgent.map(task => (
                    <div key={task.id} className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-md group relative">
                      <span className="font-medium text-red-900 dark:text-red-400">{task.title}</span>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-700 transition-opacity"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4 flex items-center gap-2">
                <Calendar size={16}/> Recordatorio
              </h2>
              <div className="p-6 border rounded-md bg-card text-secondary text-sm">
                <p>Las entregas de clientes y tareas completadas se limpiarán al refrescar. Mantén tu lista enfocada.</p>
              </div>
            </section>
          </div>
        </div>

        {/* Right Column: Calendar & Quick Links */}
        <div className="space-y-8">
          
          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4">Próximas Reuniones</h2>
            <Card className="shadow-none">
              <CardContent className="p-6">
                {events.length === 0 ? (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-secondary">Aún no has conectado Google Calendar o no tienes eventos hoy.</p>
                    <Button variant="outline" size="sm" onClick={connectCalendar} className="w-full">
                      <Calendar className="mr-2 h-4 w-4" /> Conectar Calendar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event, i) => (
                      <div key={i} className="flex gap-4">
                        <div className="w-12 text-center shrink-0">
                          <div className="text-xs text-secondary font-medium uppercase">
                            {event.start?.dateTime ? format(new Date(event.start.dateTime), 'MMM dd') : ''}
                          </div>
                          <div className="text-sm font-semibold">
                            {event.start?.dateTime ? format(new Date(event.start.dateTime), 'HH:mm') : 'All Day'}
                          </div>
                        </div>
                        <div className="flex-1 bg-muted rounded-md p-3">
                          <p className="text-sm font-medium leading-tight">{event.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* DADO DE LA INTUICIÓN */}
          <section className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-indigo-800 dark:text-indigo-400 mb-3 flex items-center gap-2">
              <Dices size={16} /> Desbloqueador de Decisiones
            </h2>
            <div className="flex gap-2 mb-3">
               <Input 
                 placeholder="Ej: Framer vs WordPress" 
                 value={diceInput} 
                 onChange={e => setDiceInput(e.target.value)} 
                 className="bg-white dark:bg-card border-indigo-200 dark:border-indigo-800 shadow-none text-sm" 
                 onKeyDown={(e) => { if(e.key === 'Enter') handleDiceRoll(); }}
               />
               <Button onClick={handleDiceRoll} disabled={isRolling} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-none shrink-0">
                 Lanzar
               </Button>
            </div>
            {diceResult && (
               <div className="text-center p-3 bg-white/60 dark:bg-black/20 rounded-md text-sm font-medium text-indigo-900 dark:text-indigo-300 animate-in fade-in zoom-in duration-200">
                 {diceResult}
               </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4">Accesos Rápidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Factura Directa', icon: Receipt, url: 'https://app.facturadirecta.com' },
                { name: 'Canva', icon: Image, url: 'https://canva.com' },
                { name: 'Drive', icon: FileText, url: 'https://drive.google.com' },
                { name: 'Meta Business', icon: Briefcase, url: 'https://business.facebook.com/' },
                { name: 'Gmail', icon: Mail, url: 'https://mail.google.com' }
              ].map((link) => (
                <a 
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-4 border rounded-md bg-card hover:bg-muted transition-colors text-secondary hover:text-foreground"
                >
                  <link.icon size={24} className="mb-2" />
                  <span className="text-xs font-medium text-center">{link.name}</span>
                </a>
              ))}
            </div>
          </section>

        </div>
      </div>

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-xl border shadow-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Añadir Tarea</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsTaskModalOpen(false)}>
                <X size={20} />
              </Button>
            </div>
            
            <form id="task-form" onSubmit={handleTaskSubmit} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">¿Qué necesitas hacer?</label>
                <Input 
                  value={taskData.title} 
                  onChange={e => setTaskData({...taskData, title: e.target.value})} 
                  required 
                  placeholder="Ej. Revisar copys de Cliente X..." 
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Prioridad</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={taskData.category} 
                  onChange={e => setTaskData({...taskData, category: e.target.value})}
                >
                  <option value="priority">Top 3 Prioridades (Día)</option>
                  <option value="urgent">Urgente (Fuego)</option>
                </select>
                <p className="text-xs text-secondary mt-1">Recuerda: Solo debes tener un máximo de 3 prioridades al día para evitar sobrecarga.</p>
              </div>
            </form>
            
            <div className="p-5 border-t bg-muted/20 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="task-form">Guardar Tarea</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Calendar, Mail, FileText, Image, AlertCircle, Briefcase, X, Trash2, Receipt, Dices, Coins, Users, Sparkles, Activity, Headphones } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const mockChartData = [
  { name: 'L', energy: 30 },
  { name: 'M', energy: 50 },
  { name: 'X', energy: 45 },
  { name: 'J', energy: 80 },
  { name: 'V', energy: 60 },
  { name: 'S', energy: 90 },
  { name: 'D', energy: 40 },
];

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [adminTasks, setAdminTasks] = useState([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskData, setTaskData] = useState({
    title: '',
    category: 'dinero',
  });

  const [diceInput, setDiceInput] = useState('');
  const [diceResult, setDiceResult] = useState('');
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    fetchTasks();
    fetchEvents();
    fetchAdminTasks();
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

  const fetchAdminTasks = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin_tasks`, { withCredentials: true });
      setAdminTasks(res.data);
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
      setTaskData({ title: '', category: 'dinero' });
      fetchTasks();
    } catch (e) {
      toast.error('Error al guardar la tarea');
    }
  };

  const dineroTasks = tasks.filter(t => (t.category === 'dinero' || t.category === 'urgent' || t.category === 'priority') && !t.completed);
  const clientesTasks = tasks.filter(t => t.category === 'clientes' && !t.completed);
  const marcaTasks = tasks.filter(t => t.category === 'marca' && !t.completed);
  
  const urgentAdminTasks = adminTasks.filter(t => {
     if (!t.due_date) return false;
     const diff = new Date(t.due_date) - new Date();
     const diffDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
     return diffDays <= 7;
  });

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-primary">Buenos días</h1>
          <p className="text-secondary mt-2 text-lg">¿Qué necesitamos hacer hoy?</p>
        </div>
        <Button onClick={() => setIsTaskModalOpen(true)} className="shrink-0 h-12 px-6 shadow-none bg-blue-600 hover:bg-blue-700 text-white" data-testid="quick-add-btn">
          <Plus className="mr-2" size={20} /> Añadir tarea rápida
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Ordered Priorities (Spans 7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* PRIORIDAD 1: DINERO */}
          <section className="bg-red-50/40 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30 p-5 md:p-7 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 rounded-lg">
                 <Coins size={20} />
               </div>
               <div>
                 <h2 className="text-lg font-semibold tracking-tight text-red-900 dark:text-red-300">Prioridad 1: DINERO</h2>
                 <p className="text-xs font-medium text-red-700/70 dark:text-red-400/70 uppercase tracking-widest">Facturas pendientes de cobrar / Impuestos</p>
               </div>
            </div>
            
            <div className="mt-5 space-y-3">
              {urgentAdminTasks.map(at => (
                 <div key={at.id} className="p-4 bg-white dark:bg-card border border-red-200 dark:border-red-800/50 rounded-xl flex items-center justify-between shadow-sm">
                    <span className="text-sm font-medium text-foreground">{at.title}</span>
                    <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 px-2 py-1 rounded-md font-semibold">Vence: {at.due_date}</span>
                 </div>
              ))}
              {dineroTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 bg-white dark:bg-card border border-red-100 dark:border-red-900/20 rounded-xl group hover:border-red-300 transition-colors relative shadow-sm">
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors border-red-300 hover:border-red-500`}
                    ></button>
                    <span className="text-sm font-medium">{task.title}</span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="absolute right-4 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-600 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
              ))}
              {dineroTasks.length === 0 && urgentAdminTasks.length === 0 && (
                <p className="text-sm text-red-800/50 dark:text-red-300/50 italic py-2 px-2">No hay tareas financieras urgentes.</p>
              )}
            </div>
          </section>

          {/* PRIORIDAD 2: CLIENTES */}
          <section className="bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 p-5 md:p-7 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 rounded-lg">
                 <Users size={20} />
               </div>
               <div>
                 <h2 className="text-lg font-semibold tracking-tight text-blue-900 dark:text-blue-300">Prioridad 2: CLIENTES</h2>
                 <p className="text-xs font-medium text-blue-700/70 dark:text-blue-400/70 uppercase tracking-widest">Tareas de mantenimiento o NeuroAlly de este mes</p>
               </div>
            </div>
            
            <div className="mt-5 space-y-3">
              {clientesTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 bg-white dark:bg-card border border-blue-100 dark:border-blue-900/20 rounded-xl group hover:border-blue-300 transition-colors relative shadow-sm">
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors border-blue-300 hover:border-blue-500`}
                    ></button>
                    <span className="text-sm font-medium">{task.title}</span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="absolute right-4 opacity-0 group-hover:opacity-100 text-blue-300 hover:text-blue-600 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
              ))}
              {clientesTasks.length === 0 && (
                <p className="text-sm text-blue-800/50 dark:text-blue-300/50 italic py-2 px-2">No hay tareas de clientes pendientes.</p>
              )}
            </div>
          </section>

          {/* PRIORIDAD 3: MARCA */}
          <section className="bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100 dark:border-indigo-900/30 p-5 md:p-7 rounded-2xl">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-lg">
                 <Sparkles size={20} />
               </div>
               <div>
                 <h2 className="text-lg font-semibold tracking-tight text-indigo-900 dark:text-indigo-300">Prioridad 3: MARCA</h2>
                 <p className="text-xs font-medium text-indigo-700/70 dark:text-indigo-400/70 uppercase tracking-widest">Tus propios proyectos (Web / Redes)</p>
               </div>
            </div>
            
            <div className="mt-5 space-y-3">
              {marcaTasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 bg-white dark:bg-card border border-indigo-100 dark:border-indigo-900/20 rounded-xl group hover:border-indigo-300 transition-colors relative shadow-sm">
                    <button 
                      onClick={() => toggleTask(task)}
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors border-indigo-300 hover:border-indigo-500`}
                    ></button>
                    <span className="text-sm font-medium">{task.title}</span>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="absolute right-4 opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-indigo-600 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
              ))}
              {marcaTasks.length === 0 && (
                <p className="text-sm text-indigo-800/50 dark:text-indigo-300/50 italic py-2 px-2">No hay tareas de marca pendientes.</p>
              )}
            </div>
          </section>

        </div>

        {/* Right Column: Analytics, Image, Calendar & Quick Links (Spans 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* IMAGE CARD (NeuroAlly / Focus Mode) & MUSIC PLAYER */}
          <div className="bg-transparent flex flex-col items-center justify-center p-2 mb-4 space-y-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_studio-minimal-15/artifacts/fg0hd3z4_nat_nat2gostudio_neuroally.png" 
              alt="NeuroAlly Flow"
              className="w-full h-48 object-contain object-center opacity-90 hover:opacity-100 hover:scale-105 transition-all duration-500 drop-shadow-md"
            />
            {/* Spotify Lo-Fi Player for Focus */}
            <div className="w-full bg-blue-50/30 dark:bg-blue-900/10 p-2 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
              <iframe 
                style={{ borderRadius: '12px' }} 
                src="https://open.spotify.com/embed/playlist/37i9dQZF1DWWQRwui0ExPn?utm_source=generator&theme=0" 
                width="100%" 
                height="152" 
                frameBorder="0" 
                allowFullScreen="" 
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                loading="lazy"
                title="Lo-Fi Focus Playlist"
              ></iframe>
            </div>
          </div>

          {/* DYNAMIC CHART: Flujo de Energía */}
          <Card className="shadow-sm border-blue-100 dark:border-blue-900/30 rounded-2xl">
            <CardContent className="p-6">
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h2 className="text-sm font-semibold tracking-widest uppercase text-blue-900 dark:text-blue-400">Flujo de Energía</h2>
                   <p className="text-xs text-secondary mt-1">Balance visual de la semana</p>
                 </div>
                 <Activity className="text-blue-500 opacity-50" size={20} />
               </div>
               <div className="h-32 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={mockChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                         <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ color: '#1e3a8a', fontWeight: 600 }}
                       labelStyle={{ display: 'none' }}
                       formatter={(value) => [`${value}%`, 'Energía']}
                     />
                     <Area type="monotone" dataKey="energy" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorEnergy)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
            </CardContent>
          </Card>

          {/* DADO DE LA INTUICIÓN */}
          <section className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-900/30 shadow-sm">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
              <Dices size={16} /> Desbloqueador de Decisiones
            </h2>
            <div className="flex gap-2 mb-3">
               <Input 
                 placeholder="Ej: Framer vs WordPress" 
                 value={diceInput} 
                 onChange={e => setDiceInput(e.target.value)} 
                 className="bg-white dark:bg-card border-blue-200 dark:border-blue-800 shadow-none text-sm" 
                 onKeyDown={(e) => { if(e.key === 'Enter') handleDiceRoll(); }}
               />
               <Button onClick={handleDiceRoll} disabled={isRolling} className="bg-blue-600 hover:bg-blue-700 text-white shadow-none shrink-0">
                 Lanzar
               </Button>
            </div>
            {diceResult && (
               <div className="text-center p-3 bg-white/60 dark:bg-black/20 rounded-lg text-sm font-medium text-blue-900 dark:text-blue-300 animate-in fade-in zoom-in duration-200 border border-blue-100 dark:border-blue-800/50">
                 {diceResult}
               </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-3">Próximas Reuniones</h2>
            <Card className="shadow-sm rounded-2xl">
              <CardContent className="p-5">
                {events.length === 0 ? (
                  <div className="text-center space-y-3 py-2">
                    <p className="text-sm text-secondary">No hay eventos hoy.</p>
                    <Button variant="outline" size="sm" onClick={connectCalendar} className="w-full text-xs">
                      <Calendar className="mr-2 h-4 w-4" /> Conectar Calendar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event, i) => (
                      <div key={i} className="flex gap-4 items-center">
                        <div className="w-12 text-center shrink-0">
                          <div className="text-xs text-secondary font-medium uppercase">
                            {event.start?.dateTime ? format(new Date(event.start.dateTime), 'MMM dd') : ''}
                          </div>
                          <div className="text-sm font-semibold text-primary">
                            {event.start?.dateTime ? format(new Date(event.start.dateTime), 'HH:mm') : 'All Day'}
                          </div>
                        </div>
                        <div className="flex-1 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3">
                          <p className="text-sm font-medium leading-tight text-foreground">{event.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-3">Accesos Rápidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Spotify (BTS Chill)', icon: Headphones, url: 'https://open.spotify.com/search/bts%20chill/playlists' },
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
                  className="flex flex-col items-center justify-center p-4 border border-border/60 rounded-2xl bg-card hover:bg-blue-50 dark:hover:bg-blue-900/10 hover:border-blue-200 dark:hover:border-blue-800 transition-colors text-secondary hover:text-blue-600 dark:hover:text-blue-400 group shadow-sm"
                >
                  <link.icon size={24} className="mb-2 transition-transform group-hover:scale-110 duration-300" />
                  <span className="text-xs font-medium text-center">{link.name}</span>
                </a>
              ))}
            </div>
          </section>

        </div>
      </div>

      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-sm rounded-2xl border shadow-lg overflow-hidden flex flex-col">
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
                  placeholder="Ej. Revisar copys..." 
                  autoFocus
                  className="shadow-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Categoría / Prioridad</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={taskData.category} 
                  onChange={e => setTaskData({...taskData, category: e.target.value})}
                >
                  <option value="dinero">[Prioridad 1] DINERO - Facturas / Impuestos</option>
                  <option value="clientes">[Prioridad 2] CLIENTES - Entregas / Mantenimiento</option>
                  <option value="marca">[Prioridad 3] MARCA - Nat2Go Studio</option>
                </select>
              </div>
            </form>
            
            <div className="p-5 border-t bg-muted/20 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setIsTaskModalOpen(false)}>Cancelar</Button>
              <Button type="submit" form="task-form" className="bg-blue-600 hover:bg-blue-700 text-white">Guardar Tarea</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

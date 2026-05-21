import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Link2, Calendar, Mail, FileText, ExternalLink, PenTool, Image, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Dashboard() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  
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

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-primary">Buenos días</h1>
          <p className="text-secondary mt-2 text-lg">Qué necesitamos hacer hoy?</p>
        </div>
        <Button className="shrink-0 h-12 px-6 shadow-none" data-testid="quick-add-btn">
          <Plus className="mr-2" size={20} /> Añadir tarea rápida
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Priorities */}
        <div className="lg:col-span-2 space-y-8">
          {/* Top 3 Priorities */}
          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4">Top 3 Prioridades</h2>
            <div className="space-y-4">
              {priorities.length === 0 ? (
                <div className="p-8 border border-dashed rounded-md text-center text-secondary bg-muted/50">
                  <p>No hay prioridades para hoy. ¡Todo listo!</p>
                </div>
              ) : (
                priorities.map((task) => (
                  <div key={task.id} className="flex items-center gap-4 p-4 md:p-6 bg-card border rounded-md group hover:border-primary/50 transition-colors">
                    <button 
                      onClick={() => toggleTask(task)}
                      className="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 border-primary/20 hover:border-primary"
                    >
                    </button>
                    <span className="text-xl font-medium">{task.title}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Urgent & Deliveries */}
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
                    <div key={task.id} className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-md">
                      <span className="font-medium text-red-900 dark:text-red-400">{task.title}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4 flex items-center gap-2">
                <Calendar size={16}/> Próximas Entregas
              </h2>
              <div className="p-6 border rounded-md bg-card text-secondary text-sm">
                <p>Las entregas de clientes aparecerán aquí.</p>
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
                    <p className="text-sm text-secondary">No hay reuniones próximas, o no has conectado tu calendario.</p>
                    <Button variant="outline" size="sm" onClick={connectCalendar} className="w-full">
                      <Calendar className="mr-2 h-4 w-4" /> Conectar Google Calendar
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
                          <p className="text-sm font-medium">{event.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary mb-4">Accesos Rápidos</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { name: 'Canva', icon: Image, url: 'https://canva.com' },
                { name: 'Drive', icon: FileText, url: 'https://drive.google.com' },
                { name: 'Metricool', icon: PenTool, url: 'https://metricool.com' },
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
                  <span className="text-xs font-medium">{link.name}</span>
                </a>
              ))}
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

export default function Contenido() {
  const [ideas, setIdeas] = useState([]);
  
  useEffect(() => {
    fetchIdeas();
  }, []);

  const fetchIdeas = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/content`, { withCredentials: true });
      setIdeas(res.data);
    } catch (e) {
      toast.error('Failed to load content ideas');
    }
  };

  const columns = [
    { id: 'idea', title: 'Ideas Rápidas' },
    { id: 'pending', title: 'Pendiente' },
    { id: 'published', title: 'Publicado' }
  ];

  return (
    <div className="space-y-8 h-full flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Contenido</h1>
          <p className="text-secondary text-sm mt-1">Tus ideas sin fricción.</p>
        </div>
        <Button data-testid="add-idea-btn">
          <Plus className="mr-2 h-4 w-4" /> Nueva Idea
        </Button>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {columns.map(col => (
          <div key={col.id} className="bg-muted/30 rounded-lg p-4 flex flex-col h-full border">
            <h3 className="font-medium mb-4 flex justify-between items-center text-sm uppercase tracking-widest text-secondary">
              {col.title}
              <span className="bg-secondary/20 px-2 py-0.5 rounded-full text-xs">{ideas.filter(i => i.status === col.id).length}</span>
            </h3>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {ideas.filter(i => i.status === col.id).length === 0 ? (
                <div className="text-center p-4 border border-dashed rounded-md bg-card text-xs text-secondary">
                  Vacío
                </div>
              ) : (
                ideas.filter(i => i.status === col.id).map(idea => (
                  <div key={idea.id} className="bg-card p-4 rounded-md border group hover:border-primary/30 transition-colors">
                    <p className="font-medium text-sm">{idea.title}</p>
                    {idea.reusable && <span className="inline-block mt-2 text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-1 rounded-sm">Reutilizable</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Link2, Calendar, FileText, PenTool, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/clients`, { withCredentials: true });
      setClients(res.data);
    } catch (e) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
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
          <Button data-testid="add-client-btn">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <Card key={client.id} className="shadow-none">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-medium">{client.name}</h3>
                    <p className="text-xs text-secondary mt-1">{client.service_type}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-md ${client.project_status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-secondary/20 text-secondary'}`}>
                    {client.project_status || 'Active'}
                  </span>
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

                <div className="border-t pt-4 grid grid-cols-3 gap-2">
                  <Button variant="outline" size="sm" className="w-full text-xs">Canva</Button>
                  <Button variant="outline" size="sm" className="w-full text-xs">Drive</Button>
                  <Button variant="outline" size="sm" className="w-full text-xs">Links</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

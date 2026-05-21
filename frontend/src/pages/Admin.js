import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';

export default function Admin() {
  const [tasks, setTasks] = useState([]);
  
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/admin_tasks`, { withCredentials: true });
      setTasks(res.data);
    } catch (e) {
      toast.error('Failed to load admin tasks');
    }
  };

  const getIcon = (type) => {
    switch(type) {
      case 'iva':
      case 'irpf': return <AlertTriangle className="text-amber-500" size={20} />;
      default: return <AlertTriangle className="text-secondary" size={20} />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">No Olvidar</h1>
          <p className="text-secondary text-sm mt-1">Impuestos, cuotas y pagos críticos.</p>
        </div>
        <Button data-testid="add-admin-task-btn" variant="outline">
          <Plus className="mr-2 h-4 w-4" /> Añadir Recordatorio
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Taxes & Fees */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary">Obligaciones</h2>
          {tasks.filter(t => ['iva', 'irpf', 'cuota'].includes(t.type)).length === 0 ? (
            <Card className="shadow-none border-dashed bg-muted/20">
              <CardContent className="p-6 text-center text-sm text-secondary">
                Todo al día.
              </CardContent>
            </Card>
          ) : (
            tasks.filter(t => ['iva', 'irpf', 'cuota'].includes(t.type)).map(task => (
              <Card key={task.id} className="shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getIcon(task.type)}
                    <div>
                      <p className="font-medium text-sm">{task.title}</p>
                      <p className="text-xs text-secondary">Vence: {task.due_date || 'Sin fecha'}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="text-green-600 hover:bg-green-50 hover:text-green-700">
                    <CheckCircle size={18} />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        {/* Pending Invoices */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold tracking-widest uppercase text-secondary">Facturas Pendientes</h2>
          <Card className="shadow-none border-dashed bg-muted/20">
            <CardContent className="p-6 text-center text-sm text-secondary">
              No hay facturas pendientes.
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

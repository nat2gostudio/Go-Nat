import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, LayoutList, Wallet, LogOut, Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';

export default function Layout() {
  const { logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Clientes', path: '/clientes', icon: Users },
    { name: 'Contenido', path: '/contenido', icon: LayoutList },
    { name: 'No Olvidar', path: '/admin', icon: Wallet },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar - Minimalist */}
      <aside className="w-64 border-r border-border bg-card flex flex-col hidden md:flex">
        <div className="p-8">
          <h2 className="text-xl font-semibold tracking-tight">Nat2Go OS</h2>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-md transition-colors ${active ? 'bg-primary text-primary-foreground' : 'text-secondary hover:text-foreground hover:bg-muted'}`}
                data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon size={18} />
                <span className="font-medium text-sm">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-border flex justify-between items-center">
          <Button variant="ghost" size="icon" onClick={toggleTheme} data-testid="theme-toggle">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="text-secondary hover:text-destructive" data-testid="logout-button">
            <LogOut size={18} />
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-10 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

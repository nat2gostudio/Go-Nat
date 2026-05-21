import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();

  if (user) {
    return <Navigate to="/" />;
  }

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A] p-4 bg-cover bg-center" style={{ backgroundImage: "url('https://customer-assets.emergentagent.com/job_studio-minimal-15/artifacts/eyld4h45_nat2go_background_website.png')" }}>
      <div className="w-full max-w-md bg-card/95 backdrop-blur-md p-10 rounded-xl border border-border shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-primary mb-2">Nat2Go OS</h1>
          <p className="text-secondary text-sm">Minimalist studio operations</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              className="w-full shadow-none bg-background/50"
              data-testid="login-email-input"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              className="w-full shadow-none bg-background/50"
              data-testid="login-password-input"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-base mt-4 shadow-none" 
            disabled={loading}
            data-testid="login-submit-button"
          >
            {loading ? 'Entrando...' : 'Entrar al Sistema'}
          </Button>
        </form>
      </div>
    </div>
  );
}

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
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA] dark:bg-[#0A0A0A] p-4 bg-cover bg-center" style={{ backgroundImage: "url('https://static.prod-images.emergentagent.com/jobs/4ac57882-7fcd-4f10-960b-8f79615db45c/images/8ad91b778f25ea762203c108e5f480b6024f3529367fccb5850d37e4a7ddb0d0.png')" }}>
      <div className="w-full max-w-md bg-card p-10 rounded-md border border-border shadow-sm">
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
              className="w-full"
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
              className="w-full"
              data-testid="login-password-input"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full h-12 text-base mt-4" 
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

import { useState, useEffect } from 'react';
import Login from './components/Login';
import CustomerDashboard from './components/CustomerDashboard';
import AgentDashboard from './components/AgentDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user:', e);
      }
    }
  }, []);

  const handleLoginSuccess = (newToken: string, loggedInUser: any) => {
    setToken(newToken);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  if (!token || !user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  switch (user.role) {
    case 'CUSTOMER':
      return <CustomerDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'AGENT':
      return <AgentDashboard token={token} user={user} onLogout={handleLogout} />;
    case 'ADMIN':
      return <AdminDashboard token={token} user={user} onLogout={handleLogout} />;
    default:
      return (
        <div className="min-h-screen bg-lm-ink flex flex-col items-center justify-center text-white">
          <p className="mb-4">Unknown account role: {user.role}</p>
          <button onClick={handleLogout} className="bg-lm-amber text-lm-ink px-4 py-2 rounded font-bold">
            Sign Out
          </button>
        </div>
      );
  }
}

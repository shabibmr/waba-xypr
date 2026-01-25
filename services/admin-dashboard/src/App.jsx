// admin-dashboard/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Menu, X } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Tenants from './pages/Tenants';
import TenantOnboarding from './pages/TenantOnboarding';

function App() {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <Router>
      <div className="min-h-screen bg-gray-900 flex">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />

          {/* Page Content */}
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/tenants/new" element={<TenantOnboarding />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

function Sidebar({ isOpen, onToggle }) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/tenants', icon: Users, label: 'Tenants' },
    { path: '/settings', icon: Settings, label: 'Settings' }
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  if (!isOpen) {
    return (
      <div className="bg-gray-800 w-16 flex flex-col items-center py-4 gap-4 border-r border-gray-700">
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-700 rounded transition"
        >
          <Menu className="w-6 h-6" />
        </button>
        {navItems.map(({ path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`p-2 rounded transition ${isActive(path)
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
          >
            <Icon className="w-6 h-6" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 w-64 flex flex-col border-r border-gray-700">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Admin Portal</h1>
          <p className="text-xs text-gray-400 mt-1">WhatsApp-Genesys</p>
        </div>
        <button
          onClick={onToggle}
          className="p-1 hover:bg-gray-700 rounded transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive(path)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
          >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-xs text-gray-500">
          <div>Version 1.0.0</div>
          <div className="mt-1">© 2026 Integration Platform</div>
        </div>
      </div>
    </div>
  );
}

function Header({ onMenuClick }) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-700 rounded transition"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Administration Dashboard</h2>
            <p className="text-sm text-gray-400">Manage tenants and integrations</p>
          </div>
        </div>
      </div>
    </header>
  );
}

function SettingsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      <div className="card">
        <p className="text-gray-400">Settings page coming soon...</p>
      </div>
    </div>
  );
}

export default App;
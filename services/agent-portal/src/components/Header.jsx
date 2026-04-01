import React from 'react';
import { MessageSquare, User } from 'lucide-react';
import ViewSwitcher from './ViewSwitcher';
import { useNavigate } from 'react-router-dom';

function Header({ agent }) {
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-surface-200 px-6 py-4 shadow-sm-light">
      <div className="flex items-center justify-between">
        {/* Left: Logo/Title */}
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="text-xl font-bold text-surface-900">Agent Workspace</h1>
            <p className="text-sm text-surface-500">{agent?.name || 'Agent'}</p>
          </div>
        </div>

        {/* Right: View Switcher + User Menu */}
        <div className="flex items-center gap-4">
          <ViewSwitcher />

          {/* User Menu */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-surface-600 hover:bg-surface-100 hover:text-primary-600 transition"
            title="Profile"
          >
            <User className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;

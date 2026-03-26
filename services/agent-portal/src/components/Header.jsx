import React from 'react';
import { MessageSquare, User } from 'lucide-react';
import ViewSwitcher from './ViewSwitcher';
import { useNavigate } from 'react-router-dom';

function Header({ agent }) {
  const navigate = useNavigate();

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        {/* Left: Logo/Title */}
        <div className="flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-blue-500" />
          <div>
            <h1 className="text-xl font-bold">Agent Workspace</h1>
            <p className="text-sm text-gray-400">{agent?.name || 'Agent'}</p>
          </div>
        </div>

        {/* Right: View Switcher + User Menu */}
        <div className="flex items-center gap-4">
          <ViewSwitcher />

          {/* User Menu */}
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition"
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

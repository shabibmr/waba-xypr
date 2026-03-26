import React from 'react';
import { Users, Shield } from 'lucide-react';
import { useView } from '../contexts/ViewContext';

function ViewSwitcher() {
  const { currentView, setView } = useView();

  return (
    <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => setView('agent')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md transition-all
          ${currentView === 'agent'
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }
        `}
      >
        <Users className="w-4 h-4" />
        <span className="font-medium">Agent</span>
      </button>

      <button
        onClick={() => setView('admin')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md transition-all
          ${currentView === 'admin'
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }
        `}
      >
        <Shield className="w-4 h-4" />
        <span className="font-medium">Admin</span>
      </button>
    </div>
  );
}

export default ViewSwitcher;

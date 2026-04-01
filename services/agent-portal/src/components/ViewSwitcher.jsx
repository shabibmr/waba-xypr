import React from 'react';
import { Users, Shield } from 'lucide-react';
import { useView } from '../contexts/ViewContext';

function ViewSwitcher() {
  const { currentView, setView } = useView();

  return (
    <div className="flex items-center gap-2 bg-surface-100 rounded-lg p-1">
      <button
        onClick={() => setView('agent')}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-md transition-all
          ${currentView === 'agent'
            ? 'bg-primary-600 text-white shadow-md-light'
            : 'text-surface-500 hover:text-primary-600 hover:bg-surface-200'
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
            ? 'bg-primary-600 text-white shadow-md-light'
            : 'text-surface-500 hover:text-primary-600 hover:bg-surface-200'
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

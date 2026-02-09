import React, { createContext, useState, useCallback, useContext } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

const TOAST_ICONS = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info
};

const TOAST_COLORS = {
    success: 'bg-green-500/10 border-green-500 text-green-400',
    error: 'bg-red-500/10 border-red-500 text-red-400',
    warning: 'bg-yellow-500/10 border-yellow-500 text-yellow-400',
    info: 'bg-blue-500/10 border-blue-500 text-blue-400'
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = TOAST_TYPES.INFO, duration = 5000) => {
        const id = Date.now() + Math.random();
        const toast = { id, message, type, duration };

        setToasts(prev => [...prev, toast]);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    }, []);

    const success = useCallback((message, duration) => {
        return addToast(message, TOAST_TYPES.SUCCESS, duration);
    }, [addToast]);

    const error = useCallback((message, duration) => {
        return addToast(message, TOAST_TYPES.ERROR, duration);
    }, [addToast]);

    const warning = useCallback((message, duration) => {
        return addToast(message, TOAST_TYPES.WARNING, duration);
    }, [addToast]);

    const info = useCallback((message, duration) => {
        return addToast(message, TOAST_TYPES.INFO, duration);
    }, [addToast]);

    const clear = useCallback(() => {
        setToasts([]);
    }, []);

    const value = {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        warning,
        info,
        clear
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, removeToast }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
            ))}
        </div>
    );
};

const Toast = ({ toast, onClose }) => {
    const Icon = TOAST_ICONS[toast.type];
    const colorClass = TOAST_COLORS[toast.type];

    return (
        <div
            className={`${colorClass} border rounded-lg px-4 py-3 shadow-lg flex items-start gap-3 animate-slide-in-right`}
            role="alert"
        >
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{toast.message}</p>
            <button
                onClick={onClose}
                className="flex-shrink-0 hover:opacity-70 transition-opacity"
                aria-label="Close"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);

    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }

    return context;
};

export default ToastContext;

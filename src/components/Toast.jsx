import React, { useState, useEffect, useCallback } from 'react';

let toastId = 0;
let addToastGlobal = null;

export function useToast() {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'error', duration = 4000) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    useEffect(() => {
        addToastGlobal = addToast;
        return () => { addToastGlobal = null; };
    }, [addToast]);

    return { toasts, addToast };
}

export function showToast(message, type = 'error', duration = 4000) {
    if (addToastGlobal) addToastGlobal(message, type, duration);
}

const icons = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️'
};

const colors = {
    error: 'border-red-500/50 bg-red-500/10',
    success: 'border-emerald-500/50 bg-emerald-500/10',
    warning: 'border-amber-500/50 bg-amber-500/10',
    info: 'border-blue-500/50 bg-blue-500/10'
};

export default function ToastContainer({ toasts }) {
    return (
        <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`pointer-events-auto px-5 py-4 rounded-2xl border backdrop-blur-xl shadow-2xl text-white text-sm font-medium flex items-start gap-3 animate-[slideIn_0.3s_ease-out] ${colors[t.type] || colors.error}`}
                >
                    <span className="text-lg flex-shrink-0">{icons[t.type] || icons.error}</span>
                    <span className="break-words">{t.message}</span>
                </div>
            ))}
        </div>
    );
}

import React from 'react';

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div 
      id="toast-container" 
      className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-4"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const borderBg = isError
          ? 'bg-red-50 border-red-200 text-red-900 shadow-red-500/5'
          : 'bg-green-50 border-green-200 text-green-900 shadow-green-500/5';
        
        const textTitle = isError ? 'text-red-800' : 'text-green-800';
        
        const icon = isError ? (
          <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        ) : (
          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        );

        return (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`p-4 border rounded-xl flex items-start space-x-3 shadow-md transform transition-all duration-300 pointer-events-auto cursor-pointer hover:opacity-90 ${borderBg}`}
          >
            <div className="shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1">
              <h5 className={`text-xs font-bold leading-none ${textTitle}`}>{toast.title}</h5>
              <p className="text-[11px] text-slate-500 mt-1 leading-normal font-medium">{toast.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React from 'react';

export default function SharedPageLayout({ title, subtitle, children }) {
  return (
    <div className="flex flex-col w-full min-h-full p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary,#fff)]">{title}</h1>
          <p className="text-sm text-[var(--text-secondary,#94a3b8)] mt-1">{subtitle}</p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 px-4 py-2 text-sm rounded-lg bg-[var(--card-bg,#1e293b)] border border-[var(--border-color,#334155)] text-[var(--text-primary,#fff)] shadow-sm">
            <span className="flex items-center justify-center w-6 h-6 font-bold bg-blue-600 rounded-full text-xs text-white">A</span>
            <span className="font-medium">Admin008</span>
            <span className="px-2 py-0.5 text-xs text-blue-200 bg-blue-900/60 rounded">Admin</span>
          </div>
        </div>
      </div>
      <div className="w-full flex-1">
        {children}
      </div>
    </div>
  );
}

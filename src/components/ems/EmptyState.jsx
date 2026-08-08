import React from 'react';

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-20 text-center">
      {Icon && (
        <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center" style={{ background: 'var(--ems-primary)10', color: 'var(--ems-primary)' }}>
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="mt-5 text-lg font-medium text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
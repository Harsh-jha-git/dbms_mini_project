const tone = {
  Applied: 'border-rule text-mute', Shortlisted: 'border-ink text-ink', Interview: 'border-ink text-ink',
  Selected: 'border-moss text-moss', Accepted: 'border-moss text-moss', Offered: 'border-accent text-accent',
  Rejected: 'border-rule text-mute line-through', Withdrawn: 'border-rule text-mute', Declined: 'border-rule text-mute',
  Open: 'border-moss text-moss', Closed: 'border-rule text-mute', Pending: 'border-accent text-accent', Approved: 'border-moss text-moss',
};

export function Badge({ children }) {
  return <span className={`inline-block border px-1.5 text-xs ${tone[children] || 'border-rule text-mute'}`}>{children}</span>;
}

export function Flash({ sp }) {
  if (sp?.err) return <p className="mb-4 border-l-4 border-accent bg-card px-3 py-2 text-sm">{sp.err}</p>;
  if (sp?.ok) return <p className="mb-4 border-l-4 border-moss bg-card px-3 py-2 text-sm">{sp.ok}</p>;
  return null;
}

export function Title({ children, sub }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl">{children}</h1>
      {sub && <p className="mt-1 text-sm text-mute">{sub}</p>}
    </div>
  );
}

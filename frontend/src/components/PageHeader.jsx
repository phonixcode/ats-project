export default function PageHeader({ title, meta = [], actions = null }) {
  const facts = meta.filter(Boolean);
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {facts.length > 0 && (
          <p className="page-header-meta">
            {facts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </p>
        )}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

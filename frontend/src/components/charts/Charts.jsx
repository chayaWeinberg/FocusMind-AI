import './Charts.css';

// Small, dependency-free charts for FocusInsights. HTML/CSS bars follow the
// page's RTL direction (the first item is on the right), scale to any width,
// show the value on hover and keyboard focus, and always come with a table
// for screen readers. Colors are validated (see docs/insights.md).

export const STATE_COLORS = Object.freeze({
  ON_SCREEN: '#00909a',
  OFF_SCREEN: '#d9783f',
  FACE_ABSENT: '#7b5ea7',
  UNCERTAIN: '#a9b4b2',
  NOT_MEASURED: '#dfe5e3',
});

function DataTable({ caption, columns, rows }) {
  return (
    <table className="visually-hidden">
      <caption>{caption}</caption>
      <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody>
    </table>
  );
}

/**
 * Vertical bars over time. `data`: [{ key, label, value, display }] in
 * chronological order; `max` defaults to the largest value.
 */
export function BarChart({ title, data, valueName, emptyText = 'אין עדיין נתונים לתקופה הזו.', max }) {
  const top = max ?? Math.max(0, ...data.map((item) => item.value || 0));
  const hasData = data.some((item) => item.value > 0);
  return (
    <figure className="fm-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      {hasData ? (
        <div className="fm-bars" aria-hidden="true">
          {data.map((item) => {
            const height = top > 0 ? Math.max(item.value > 0 ? 3 : 0, (100 * (item.value || 0)) / top) : 0;
            return (
              <div key={item.key} className="fm-bar-slot" tabIndex={0} aria-label={`${item.label}: ${item.display}`}>
                <span className="fm-bar-tip" role="tooltip">{item.label} · {item.display}</span>
                <span className="fm-bar-track">
                  <span className={`fm-bar${item.muted ? ' is-muted' : ''}`} style={{ height: `${height}%` }} />
                </span>
                <span className="fm-bar-label">{item.short ?? item.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="fm-chart-empty">{emptyText}</p>
      )}
      <DataTable caption={title} columns={['תאריך', valueName]} rows={data.map((item) => [item.label, item.display])} />
    </figure>
  );
}

/** Horizontal bars for categories (e.g. learning time per course). */
export function HBarList({ title, data, valueName, emptyText }) {
  const top = Math.max(0, ...data.map((item) => item.value || 0));
  return (
    <figure className="fm-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      {data.length === 0 || top === 0 ? (
        <p className="fm-chart-empty">{emptyText}</p>
      ) : (
        <ul className="fm-hbars" aria-hidden="true">
          {data.map((item) => (
            <li key={item.key}>
              <span className="fm-hbar-name">{item.label}</span>
              <span className="fm-hbar-track">
                <span className="fm-hbar" style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (100 * item.value) / top)}%` }} />
              </span>
              <span className="fm-hbar-value">{item.display}</span>
            </li>
          ))}
        </ul>
      )}
      <DataTable caption={title} columns={['שם', valueName]} rows={data.map((item) => [item.label, item.display])} />
    </figure>
  );
}

/** One stacked bar of the attention-state distribution, with a legend. */
export function StateDistribution({ title, parts, emptyText }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const percent = (value) => (total ? Math.round((100 * value) / total) : 0);
  return (
    <figure className="fm-chart" aria-label={title}>
      <figcaption>{title}</figcaption>
      {total === 0 ? (
        <p className="fm-chart-empty">{emptyText}</p>
      ) : (
        <>
          <div className="fm-stack" aria-hidden="true">
            {parts.filter((part) => part.value > 0).map((part) => (
              <span
                key={part.key}
                className={`fm-stack-part fm-stack-part--${part.key}`}
                style={{ flexGrow: part.value, background: STATE_COLORS[part.key] }}
                title={`${part.label}: ${percent(part.value)}% (${part.display})`}
              >
                {percent(part.value) >= 10 && <span className="fm-stack-label">{percent(part.value)}%</span>}
              </span>
            ))}
          </div>
          <ul className="fm-legend">
            {parts.map((part) => (
              <li key={part.key}>
                <span className={`fm-swatch fm-swatch--${part.key}`} style={{ background: STATE_COLORS[part.key] }} aria-hidden="true" />
                <span>{part.label}</span>
                <b>{percent(part.value)}%</b>
                <small>{part.display}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <DataTable caption={title} columns={['מצב', 'אחוז', 'זמן']} rows={parts.map((part) => [part.label, `${percent(part.value)}%`, part.display])} />
    </figure>
  );
}

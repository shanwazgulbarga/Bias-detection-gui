// Small shared UI building blocks used across the views.

export function Spinner({ label }) {
  return (
    <span className="spinner-wrap">
      <span className="spinner" aria-hidden="true" />
      {label && <span className="spinner-label">{label}</span>}
    </span>
  )
}

// A pill that marks whether a trial used the biased or the neutral prompt.
export function VariantBadge({ biased }) {
  return (
    <span className={`badge ${biased ? 'badge-biased' : 'badge-neutral'}`}>
      {biased ? 'Biased prompt' : 'Neutral prompt'}
    </span>
  )
}

// A pill marking whether the agent persona itself is designed to be biased.
export function PersonaBadge({ biased }) {
  return (
    <span className={`badge ${biased ? 'badge-persona-biased' : 'badge-persona-neutral'}`}>
      {biased ? 'Biased persona' : 'Neutral persona'}
    </span>
  )
}

// Horizontal confidence bar. value is 0..1 (or null for parse failures).
export function ConfidenceBar({ value, biased }) {
  if (value == null || Number.isNaN(value)) {
    return <span className="conf-na">no value</span>
  }
  const pct = Math.round(value * 100)
  return (
    <div className="conf">
      <div className="conf-track">
        <div
          className={`conf-fill ${biased ? 'conf-biased' : 'conf-neutral'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="conf-num">{pct}%</span>
    </div>
  )
}

// Inline error / empty / loading states with consistent voice.
export function Notice({ kind = 'info', children }) {
  return <div className={`notice notice-${kind}`}>{children}</div>
}

// Short, copyable mono ID with the leading chars shown.
export function MonoId({ id }) {
  if (!id) return <span className="mono muted">—</span>
  return (
    <span className="mono muted" title={id}>
      {id.slice(0, 8)}…
    </span>
  )
}

import { useEffect, useState, type ReactNode } from 'react'

export type Route = 'inicio' | 'plano' | 'registrar' | 'fatura' | 'ajustes' | 'gastos'

const Svg = ({ children, size = 24 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

// oxlint-disable-next-line react/only-export-components -- mapa de ícones (componentes)
export const Icon = {
  home: () => <Svg><path d="M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z" /></Svg>,
  chart: () => <Svg><path d="M5 20V11M12 20V5M19 20v-6" /></Svg>,
  plus: () => <Svg size={26}><path d="M12 5v14M5 12h14" /></Svg>,
  calendar: () => <Svg><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>,
  sliders: () => <Svg><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></Svg>,
  chevron: () => <Svg size={18}><path d="M9 6l6 6-6 6" /></Svg>,
  close: () => <Svg size={20}><path d="M6 6l12 12M18 6L6 18" /></Svg>,
  check: () => <Svg size={26}><path d="M5 12l5 5 9-10" /></Svg>,
  trash: () => <Svg size={18}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Svg>,
}

export function Nav({ route }: { route: Route }) {
  const link = (r: Route, label: string, icon: ReactNode) => (
    <a href={`#${r}`} aria-current={route === r ? 'page' : undefined}>
      {icon}
      {label}
    </a>
  )
  return (
    <nav className="nav" aria-label="Navegação">
      <div className="nav-inner">
        {link('inicio', 'Início', <Icon.home />)}
        {link('plano', 'Plano', <Icon.chart />)}
        <a href="#registrar" className="fab" aria-label="Registrar gasto">
          <Icon.plus />
        </a>
        {link('fatura', 'Fatura', <Icon.calendar />)}
        {link('ajustes', 'Ajustes', <Icon.sliders />)}
      </div>
    </nav>
  )
}

/** Campo que salva quando sai do foco (ou Enter). */
export function AutoField(props: {
  label?: string
  value: string | number | null
  type?: 'text' | 'number' | 'month' | 'date'
  placeholder?: string
  compact?: boolean
  onSave: (v: string) => Promise<void> | void
  ariaLabel?: string
}) {
  const initial = props.value === null || props.value === undefined ? '' : String(props.value)
  const [v, setV] = useState(initial)
  const [synced, setSynced] = useState(initial)
  if (synced !== initial) {
    // o valor salvo mudou (ex.: depois de recarregar): mostra o novo
    setSynced(initial)
    setV(initial)
  }
  const commit = () => {
    if (v !== initial) void props.onSave(v)
  }
  const input = (
    <input
      className={'input' + (props.compact ? ' compact' : '')}
      type={props.type ?? 'text'}
      inputMode={props.type === 'number' ? 'decimal' : undefined}
      value={v}
      placeholder={props.placeholder}
      aria-label={props.label ? undefined : props.ariaLabel}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
  if (!props.label) return input
  return (
    <label className="field">
      {props.label}
      {input}
    </label>
  )
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [message, onDone])
  if (!message) return null
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

export function Progress({ value, max, over }: { value: number; max: number; over?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return (
    <div className={'bar' + (over ? ' over' : '')} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

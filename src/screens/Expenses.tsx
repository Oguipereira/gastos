import { Icon } from '../components'
import { deleteRow } from '../lib/data'
import { brl, dayLabel } from '../lib/format'
import type { AppData } from '../lib/types'

export function Expenses({ data, reload, notify }: { data: AppData; reload: () => Promise<void>; notify: (m: string) => void }) {
  const { expenses, categories } = data
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria'
  const byDay = new Map<string, typeof expenses>()
  for (const e of expenses) byDay.set(e.spent_on, [...(byDay.get(e.spent_on) ?? []), e])

  const remove = async (id: number) => {
    try {
      await deleteRow('expenses', id)
      await reload()
      notify('Gasto apagado')
    } catch (e) {
      notify((e as Error).message)
    }
  }

  return (
    <>
      <header className="between">
        <div className="col">
          <h1 className="display page-title">Gastos</h1>
          <span className="subtitle">{expenses.length} registrados</span>
        </div>
        <a href="#inicio" className="icon-btn" aria-label="Voltar" style={{ color: 'var(--ink)' }}><Icon.close /></a>
      </header>
      {expenses.length === 0 && <div className="card"><p className="muted">Nada por aqui ainda.</p></div>}
      {[...byDay.entries()].map(([day, list]) => (
        <section key={day} className="card tight" aria-label={dayLabel(day)}>
          <div className="between small muted" style={{ padding: '10px 0 2px' }}>
            <span>{dayLabel(day)}</span>
            <span>{brl(list.reduce((s, e) => s + e.amount, 0), { cents: true })}</span>
          </div>
          {list.map((e) => (
            <div className="list-item" key={e.id}>
              <div className="col" style={{ gap: 2, minWidth: 0 }}>
                <span className="title">{e.description || catName(e.category_id)}</span>
                <span className="small muted">{catName(e.category_id)} · {e.payment_method}</span>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: e.payment_method === 'Crédito' ? 'var(--warn)' : undefined }}>−{brl(e.amount, { cents: true })}</span>
                <button type="button" className="icon-btn" style={{ border: 'none', color: 'var(--muted)' }} aria-label={`Apagar ${e.description || 'gasto'}`} onClick={() => remove(e.id)}><Icon.trash /></button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </>
  )
}

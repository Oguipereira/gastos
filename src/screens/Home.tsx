import { Icon, Progress } from '../components'
import { brl, dayLabel, longToday, monthLabel } from '../lib/format'
import { nextClosing } from '../lib/cards'
import { addMonths, categoryTotal, computePlan, isoDate, monthStart, weekSummary } from '../lib/plan'
import type { AppData } from '../lib/types'

const MONTHS_UP = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

export function Home({ data, today }: { data: AppData; today: Date }) {
  const { settings, categories, expenses, cards, bills, items } = data
  const week = weekSummary(settings, categories, expenses, today)
  const plan = computePlan(settings, items, cards, bills)
  const catName = (id: number | null) => categories.find((c) => c.id === id)?.name ?? 'Sem categoria'

  const upcoming = cards
    .map((c) => ({ card: c, nc: nextClosing(c, today) }))
    .filter((x) => x.nc)
    .sort((a, b) => a.nc!.date.getTime() - b.nc!.date.getTime())[0]
  const upcomingBill = upcoming
    ? bills.find((b) => b.card_id === upcoming.card.id && monthStart(b.month) === upcoming.nc!.billMonth)?.amount ?? 0
    : 0

  const thisMonth = monthStart(isoDate(today))
  const curRow = plan.rows.find((r) => r.month === thisMonth) ?? plan.rows[0]
  const goal = settings.goal_amount
  // há um buraco pela frente e ainda não chegamos no mês em que ele fecha
  const inRed = plan.worst.month !== null && (plan.outOfRedMonth === null || thisMonth < plan.outOfRedMonth)
  const outside = categories.filter((c) => !c.in_weekly_limit)

  return (
    <>
      <header className="between" style={{ alignItems: 'flex-end' }}>
        <div className="col">
          <span className="small muted" style={{ fontSize: 13 }}>{longToday(today)}</span>
          <h1 className="display page-title">{settings.display_name ? `Oi, ${settings.display_name}` : 'Oi!'}</h1>
        </div>
        <span className="chip-date">Semana {dayLabel(week.start)}–{dayLabel(week.end)}</span>
      </header>

      <section className="card hero" aria-label="Limite da semana">
        <div className="col" style={{ gap: 2 }}>
          <span style={{ fontSize: 13, opacity: 0.9 }}>{week.left >= 0 ? 'Ainda pode gastar esta semana' : 'Passou do limite da semana'}</span>
          <span className="display big">{brl(week.left)}</span>
          <span style={{ fontSize: 13, opacity: 0.9 }}>de {brl(week.limit)} · gastou {brl(week.spent)}</span>
        </div>
        <Progress value={week.spent} max={week.limit} />
        {week.byCategory.length > 0 && (
          <div className="grid2" style={{ gap: '8px 16px', fontSize: 13 }}>
            {week.byCategory.map(({ category, spent }) => (
              <div className="between" key={category.id}>
                <span>{category.name}</span>
                <span style={{ fontWeight: 600, textDecoration: spent > category.weekly_cap && category.weekly_cap > 0 ? 'underline' : undefined }}>
                  {Math.round(spent)} / {Math.round(category.weekly_cap)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {upcoming && (
        <a href={`#fatura`} className="card warn" style={{ textDecoration: 'none', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warn)' }}>{MONTHS_UP[upcoming.nc!.date.getMonth()]}</span>
            <span className="display" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>{upcoming.nc!.date.getDate()}</span>
          </div>
          <div className="col" style={{ gap: 2, flexGrow: 1, color: 'var(--ink)' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Fatura {upcoming.card.name} fecha</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{brl(upcomingBill)} · veja se vai dar e simule</span>
          </div>
          <span style={{ color: 'var(--warn)' }}><Icon.chevron /></span>
        </a>
      )}

      {goal > 0 && (
        <section className="card" aria-label="Meta">
          <div className="between" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{settings.goal_name}</span>
            <span className="muted" style={{ fontSize: 13 }}>meta {brl(goal)}</span>
          </div>
          <Progress value={Math.max(0, curRow?.balance ?? 0)} max={goal} />
          <div className="grid3 small muted">
            <div className="col" style={{ gap: 2 }}>
              <span>Agora</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: inRed ? 'var(--warn)' : 'var(--accent)' }}>{inRed ? 'Sair do vermelho' : 'Guardando'}</span>
            </div>
            <div className="col" style={{ gap: 2 }}>
              <span>Zera em</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{plan.worst.month ? (plan.outOfRedMonth ? monthLabel(plan.outOfRedMonth) : 'depois') : '—'}</span>
            </div>
            <div className="col" style={{ gap: 2 }}>
              <span>Meta em</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{plan.goalMonth ? monthLabel(plan.goalMonth) : `depois de ${monthLabel(addMonths(settings.plan_start, settings.plan_months - 1))}`}</span>
            </div>
          </div>
        </section>
      )}

      {outside.map((c) => {
        const spent = categoryTotal(c.id, expenses)
        return (
          <section className="card" key={c.id} aria-label={c.name} style={{ gap: 8 }}>
            <div className="between">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{c.name}</span>
              <span className="muted" style={{ fontSize: 13 }}>{brl(spent)} de {brl(c.weekly_cap)}</span>
            </div>
            <Progress value={spent} max={c.weekly_cap} over={spent > c.weekly_cap} />
          </section>
        )
      })}

      <section className="card tight" aria-label="Últimos gastos">
        <div className="between" style={{ padding: '12px 0 4px' }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Últimos gastos</span>
          <a href="#gastos" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center' }}>Ver todos</a>
        </div>
        {expenses.length === 0 && <p className="muted" style={{ fontSize: 14, padding: '8px 0 16px' }}>Nenhum gasto ainda. Toque no + para registrar o primeiro.</p>}
        {expenses.slice(0, 5).map((e) => (
          <div className="list-item" key={e.id}>
            <div className="col" style={{ gap: 2 }}>
              <span className="title">{e.description || catName(e.category_id)}</span>
              <span className="small muted">{catName(e.category_id)} · {e.payment_method} · {dayLabel(e.spent_on)}</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: e.payment_method === 'Crédito' ? 'var(--warn)' : undefined }}>−{brl(e.amount, { cents: true })}</span>
          </div>
        ))}
      </section>
    </>
  )
}

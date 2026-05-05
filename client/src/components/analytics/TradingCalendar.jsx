import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../../api/analytics'

function getMonthRange(from) {
    const year = Number(from.slice(0, 4))
    const month = Number(from.slice(5, 7))

    const monthStart = `${from.slice(0, 8)}01`

    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

    return {monthStart, monthEnd}
}

function buildDays(from, to, pnlByDate) {
    const days = []
    const current = new Date(from)
    const end = new Date(to)

    while (current <= end) {
        const iso = current.toISOString().slice(0, 10)

        const existing = pnlByDate.get(iso)

        days.push({
            date: iso,
            pnlNet: existing?.pnlNet ?? 0,
            tradesCount: existing?.tradesCount ?? 0,
        })

        current.setDate(current.getDate() +1)
    }

    return days
}

function buildCalendarGrid(days, monthStart) {
    const firstDay = new Date(monthStart)
    const startOffset = firstDay.getDay()

    const grid = []

    for (let i =0; i < startOffset; i++) {
        grid.push(null)
    }

    days.forEach(day => grid.push(day))

    while (grid.length % 7 !== 0) {
        grid.push(null)
    }

    return grid
}

function getDayStyle(pnl) {
  if (pnl > 0) {
    return { backgroundColor: 'rgba(34, 197, 94, 0.14)', color: '#22C55E' }
  }
  if (pnl < 0) {
    return { backgroundColor: 'rgba(239, 68, 68, 0.14)', color: '#EF4444' }
  }
  return { backgroundColor: '#0B1220', color: '#64748B' }
}

export function TradingCalendar({ qParams }) {
    if (!qParams?.from) {
        return <div>Loading calendar...</div>
    }

    const { monthStart, monthEnd } = getMonthRange(qParams.from)

    const calendarParams = {
        ...qParams,
        from: monthStart,
        to: monthEnd,
    }

    const { data, isLoading, error } = useQuery ({
        queryKey: ['analytics', 'calendar', calendarParams],
        queryFn: () => analyticsApi.calendar(calendarParams),
    })
    
    if (isLoading || !data) return <div>Loading...</div>
    if (error) return <div>Error</div>
    
    const pnlByDate = new Map(
        data.days.map(d => [new Date(d.date).toISOString().slice(0, 10), d])
    )

    const days = buildDays(calendarParams.from, calendarParams.to, pnlByDate)
    const grid = buildCalendarGrid(days, calendarParams.from)
    const today = new Date().toISOString().slice(0, 10)

    return (

        <div style={{ padding: 16, background: '#111827', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(dayName => (
                    <div key={dayName} style={{ fontWeight: 600, textAlign: 'center', paddingBottom: 6, color: '#64748B', fontSize: 12,}}>
                        {dayName}
                    </div>
                ))}
                
                {grid.map((day, index) => {
                    const isToday = day?.date === today
                    const hasTrades = day?.tradesCount > 0
                    
                    return (
                        <div key={index} title={day ? `${day.pnlNet}$ • ${day.tradesCount} trades` : ''} style={{ minHeight: 90, padding: 8, borderRadius: 10, border: isToday ? '2px solid #3B82F6' : '1px solid #263244',
                    background: day ? getDayStyle(day.pnlNet).backgroundColor : '#0B1220',
                    color: day ? getDayStyle(day.pnlNet).color : '#CBD5E1',
                    opacity: day ? 1 : 0.45,
                    transition: 'all 0.15s ease',
                    cursor: day ? 'pointer' : 'default',
                    borderLeft: hasTrades
                    ? day.pnlNet > 0
                        ? '4px solid #22C55E'
                        : day.pnlNet < 0
                        ? '4px solid #EF4444'
                        : '4px solid #94A3B8'
                    : undefined,
                }}
                onMouseEnter={(e) => {
                    if (day) e.currentTarget.style.transform = 'scale(1.02)'
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)'
                }}
                >
                {day && (
                    <>
                    <div
                        style={{
                        fontSize: 11,
                        color: '#94A3B8',
                        fontWeight: 600,
                        }}
                    >
                        {day.date.slice(8, 10)}
                    </div>

                    <div
                        style={{
                        fontSize: 14,
                        fontWeight: 700,
                        marginTop: 8,
                        }}
                    >
                        {hasTrades ? `$${day.pnlNet.toLocaleString()}` : '—'}
                    </div>

                    {hasTrades && (
                        <div
                        style={{
                            fontSize: 10,
                            marginTop: 6,
                            color: '#64748B',
                        }}
                        >
                        {day.tradesCount} trades
                        </div>
                    )}
                    </>
                )}
                </div>
            )
            })}
        </div>
        </div>
    )
}
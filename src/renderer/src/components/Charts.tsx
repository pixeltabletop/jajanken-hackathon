import type { JSX } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MODALITY_SHORT_ES } from '../../../shared/catalog.ts'
import type { EquipmentRowView } from '../lib/filter.ts'
import { AGE_BUCKETS, ageBucket, countryLabel } from '../lib/labels.ts'

interface Point { name: string; value: number }

function sumBy(rows: EquipmentRowView[], keyOf: (r: EquipmentRowView) => string, order?: readonly string[]): Point[] {
  const m = new Map<string, number>()
  for (const r of rows) m.set(keyOf(r), (m.get(keyOf(r)) ?? 0) + r.eq.quantity)
  const pts = [...m.entries()].map(([name, value]) => ({ name, value }))
  if (order) return order.filter((k) => m.has(k)).map((k) => ({ name: k, value: m.get(k)! }))
  return pts.sort((a, b) => b.value - a.value)
}

function Chart({ title, data }: { title: string; data: Point[] }): JSX.Element {
  // Etiquetas inclinadas cuando hay muchas o son largas: evita que se pisen.
  const longest = data.reduce((m, d) => Math.max(m, d.name.length), 0)
  const tilt = data.length > 4 || longest > 10
  return (
    <div className="chart" role="img" aria-label={`${title}: ${data.map((d) => `${d.name} ${d.value}`).join(', ')}`}>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={tilt ? 230 : 200}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#e4ecf2" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#5b6f7f' }} interval={0} angle={tilt ? -28 : 0} textAnchor={tilt ? 'end' : 'middle'} height={tilt ? 64 : 28} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#5b6f7f' }} />
          <Tooltip cursor={{ fill: '#eaf6fd' }} formatter={(v) => [`${v} equipos`, '']} />
          <Bar dataKey="value" fill="#0076ce" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function Charts({ rows }: { rows: EquipmentRowView[] }): JSX.Element | null {
  if (!rows.length) return null
  return (
    <div className="charts">
      <Chart title="Equipos por modalidad" data={sumBy(rows, (r) => MODALITY_SHORT_ES[r.eq.modality])} />
      <Chart title="Equipos por país" data={sumBy(rows, (r) => (r.obs.country ? countryLabel(r.obs.country) : 'Sin país'))} />
      <Chart title="Equipos por antigüedad" data={sumBy(rows, (r) => ageBucket(r.eq.approxAgeYears), AGE_BUCKETS)} />
    </div>
  )
}

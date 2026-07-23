import { useRef, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import { attachMetrics } from '../utils/storage'

// ── JSON upload ───────────────────────────────────────────────────

export function MetricsUploader({ matchId, onAttached }) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  function handleFile(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        attachMetrics(matchId, data)
        setState('success')
        onAttached?.(data)
        setTimeout(() => setState('idle'), 2000)
      } catch {
        setState('error')
        setError('Invalid JSON file.')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div
      className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-8 text-center cursor-pointer transition-colors max-w-md"
      onClick={() => document.getElementById('metrics-json-input').click()}
      onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]) }}
      onDragOver={(e) => e.preventDefault()}
    >
      {state === 'idle' && (
        <>
          <p className="text-gray-300 text-sm">Drop pickleball_metrics.json here</p>
          <p className="text-gray-500 text-xs mt-1">or click to browse</p>
        </>
      )}
      {state === 'success' && <p className="text-emerald-400 text-sm">Metrics attached!</p>}
      {state === 'error' && <p className="text-red-400 text-sm">{error}</p>}
      <input id="metrics-json-input" type="file" accept=".json" className="hidden"
        onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────

const COMPONENT_META = [
  { key: 'shot_quality',    label: 'Shot Quality',  weight: '30%', color: '#34d399' },
  { key: 'conversion',      label: 'Conversion',    weight: '50%', color: '#60a5fa' },
  { key: 'in_attack',       label: 'In Attack',     weight: '20%', color: '#f59e0b' },
]

const ALL_STROKES = ['Serve', 'Return', 'Forehand', 'Backhand', 'Volley', 'Drop', 'Dink', 'Overhead']

const PLAYER_COLORS = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa']

const chartDefaults = {
  plugins: { legend: { labels: { color: '#9ca3af' } } },
  scales: {
    x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
    y: {
      ticks: { color: '#6b7280' }, grid: { color: '#1f2937' },
      min: 0, max: 10,
    },
  },
}

export default function MetricsTab({ metrics }) {
  const players = Object.keys(metrics)

  return (
    <div className="space-y-10">
      {/* ── Performance Rating ── */}
      <section>
        <h2 className="text-gray-200 font-semibold text-lg mb-5">Performance Rating</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {players.map((name, i) => {
            const { overall, components, raw } = metrics[name].performance_rating
            return (
              <div key={name} className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-gray-100 font-semibold">{name}</h3>
                  <OverallBadge value={overall} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} />
                </div>

                {/* Component bars */}
                <div className="space-y-2.5">
                  {COMPONENT_META.map(({ key, label, weight, color }) => {
                    const score = components[`${key}_score`] ?? components[key] ?? 0
                    return (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{label} <span className="text-gray-600">({weight})</span></span>
                          <span className="text-gray-200 font-medium">{score.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${(score / 10) * 100}%`, background: color }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Raw conversion stats */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-gray-800">
                  <RawStat label="Winners" value={raw.winners} />
                  <RawStat label="Errors" value={raw.errors} />
                  <RawStat label="Conv %" value={`${raw.conversion_pct}%`} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Shot Quality by Stroke ── */}
      <section>
        <h2 className="text-gray-200 font-semibold text-lg mb-5">Shot Quality by Stroke</h2>

        {/* Grouped bar chart — all players, one bar per stroke */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
          <Bar
            data={{
              labels: ALL_STROKES,
              datasets: players.map((name, i) => ({
                label: name,
                data: ALL_STROKES.map(
                  (stroke) => metrics[name].shot_quality_by_stroke[stroke] ?? null
                ),
                backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + 'cc',
                borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
                borderWidth: 1,
              })),
            }}
            options={{
              ...chartDefaults,
              plugins: {
                legend: { labels: { color: '#9ca3af' } },
                tooltip: {
                  callbacks: {
                    label: (ctx) =>
                      ctx.raw == null
                        ? `${ctx.dataset.label}: no data`
                        : `${ctx.dataset.label}: ${ctx.raw.toFixed(2)}`,
                  },
                },
              },
            }}
          />
        </div>

        {/* Per-player stroke breakdown cards */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {players.map((name, i) => {
            const byStroke = metrics[name].shot_quality_by_stroke
            const strokes = ALL_STROKES.filter((s) => byStroke[s] != null)
            const best = strokes.reduce((a, b) => (byStroke[a] > byStroke[b] ? a : b), strokes[0])
            const worst = strokes.reduce((a, b) => (byStroke[a] < byStroke[b] ? a : b), strokes[0])
            const color = PLAYER_COLORS[i % PLAYER_COLORS.length]

            return (
              <div key={name} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                <h3 className="text-gray-100 font-semibold text-sm mb-3">{name}</h3>
                {strokes.map((stroke) => {
                  const score = byStroke[stroke]
                  return (
                    <div key={stroke}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span className="text-gray-400">{stroke}</span>
                        <span className="text-gray-200">{score.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(score / 10) * 100}%`, background: color }}
                        />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-2 border-t border-gray-800 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500">Best</p>
                    <p className="text-emerald-400 font-medium">{best}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Weakest</p>
                    <p className="text-red-400 font-medium">{worst}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

function OverallBadge({ value, color }) {
  return (
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold border-2"
      style={{ borderColor: color, color }}
    >
      {value.toFixed(1)}
    </div>
  )
}

function RawStat({ label, value }) {
  return (
    <div className="text-center">
      <p className="text-gray-500 text-xs">{label}</p>
      <p className="text-gray-100 font-semibold text-sm">{value}</p>
    </div>
  )
}

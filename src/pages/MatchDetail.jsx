import { useParams, Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend,
} from 'chart.js'
import { Bar, Doughnut, Line } from 'react-chartjs-2'

import { getMatch } from '../utils/storage'
import { playerStats, thirdShotStats, rallyStats, computeMetrics } from '../utils/analytics'
import CourtPlot from '../components/CourtPlot'
import MetricsTab, { MetricsUploader } from '../components/MetricsTab'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend,
)

const TABS = ['Court', 'Players', 'Third Shot', 'Rally', 'Patterns', 'Metrics']

const chartDefaults = {
  plugins: { legend: { labels: { color: '#9ca3af' } } },
  scales: {
    x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
    y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
  },
}

export default function MatchDetail() {
  const { id } = useParams()
  const [match, setMatch] = useState(() => getMatch(id))
  const [tab, setTab] = useState('Court')

  function handleMetricsAttached(data) {
    setMatch((m) => ({ ...m, metrics: data }))
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className="text-lg">Match not found.</p>
          <Link to="/" className="text-emerald-400 text-sm mt-2 inline-block hover:underline">← Back</Link>
        </div>
      </div>
    )
  }

  const pStats = useMemo(() => playerStats(match.shots), [match.shots])
  const tStats = useMemo(() => thirdShotStats(match.shots), [match.shots])
  const rStats = useMemo(() => rallyStats(match.shots), [match.shots])
  // Use uploaded JSON metrics if present, otherwise compute from shots
  const metrics = useMemo(
    () => match.metrics ?? computeMetrics(match.shots),
    [match.metrics, match.shots],
  )

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-gray-400 hover:text-emerald-400 text-sm transition-colors">← Matches</Link>
        <h1 className="text-lg font-semibold text-gray-100">{match.label}</h1>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-gray-500 text-sm">{match.shotCount} shots · {match.players?.join(' vs ')}</span>
          {match.metrics && (
            <span className="text-xs text-emerald-400 border border-emerald-800 bg-emerald-950 px-2 py-1 rounded-lg">
              ✓ Custom metrics
            </span>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-800 px-6">
        <nav className="flex gap-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 text-sm font-medium transition-colors ${tab === t ? 'tab-active' : 'tab-inactive'}`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {tab === 'Court' && <CourtTab shots={match.shots} />}
        {tab === 'Players' && <PlayersTab stats={pStats} />}
        {tab === 'Third Shot' && <ThirdShotTab stats={tStats} />}
        {tab === 'Rally' && <RallyTab stats={rStats} />}
        {tab === 'Patterns' && <PatternsTab stats={pStats} shots={match.shots} />}
        {tab === 'Metrics' && (
          <div className="space-y-8">
            <MetricsTab metrics={metrics} />
            <details className="text-sm text-gray-500">
              <summary className="cursor-pointer hover:text-gray-300 transition-colors">
                Override with pre-computed metrics JSON
              </summary>
              <div className="mt-3">
                <MetricsUploader matchId={id} onAttached={handleMetricsAttached} />
              </div>
            </details>
          </div>
        )}
      </main>
    </div>
  )
}

// ── Tab: Court ────────────────────────────────────────────────────

function CourtTab({ shots }) {
  return (
    <div>
      <h2 className="text-gray-200 font-semibold mb-4">Bounce Placement</h2>
      <CourtPlot shots={shots} />
    </div>
  )
}

// ── Tab: Players ──────────────────────────────────────────────────

function PlayersTab({ stats }) {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {stats.map((p) => (
        <div key={p.player} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
          <h3 className="text-gray-100 font-semibold text-base mb-4">{p.player}</h3>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat label="Shots" value={p.total} />
            <Stat label="Error Rate" value={`${(p.errorRate * 100).toFixed(0)}%`} />
            <Stat label="Winners" value={p.winners} />
            <Stat label="Avg Speed" value={p.avgSpeed ? `${p.avgSpeed.toFixed(0)} mph` : '—'} />
            <Stat label="Max Speed" value={p.maxSpeed ? `${p.maxSpeed} mph` : '—'} />
            <Stat label="Errors" value={p.errors} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <MiniBar
              title="Strokes"
              data={p.strokeCounts}
              colors={['#34d399','#60a5fa','#f59e0b','#a78bfa','#fb923c']}
            />
            <MiniBar
              title="Direction"
              data={p.directionCounts}
              colors={['#60a5fa','#f472b6','#fbbf24']}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <p className="text-gray-400 text-xs">{label}</p>
      <p className="text-gray-100 font-semibold text-lg mt-0.5">{value}</p>
    </div>
  )
}

function MiniBar({ title, data, colors }) {
  const labels = Object.keys(data)
  const values = Object.values(data)
  return (
    <div>
      <p className="text-gray-400 text-xs mb-2">{title}</p>
      <Bar
        data={{
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors ?? '#34d399',
          }],
        }}
        options={{
          ...chartDefaults,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' } },
            y: { ticks: { color: '#6b7280', font: { size: 10 } }, grid: { color: '#1f2937' } },
          },
        }}
        height={150}
      />
    </div>
  )
}

// ── Tab: Third Shot ───────────────────────────────────────────────

function ThirdShotTab({ stats }) {
  if (!stats) {
    return <p className="text-gray-400">No third-shot data found in this match.</p>
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 className="text-gray-200 font-semibold mb-4">Third Shot Mix</h3>
        <Doughnut
          data={{
            labels: ['Drops', 'Drives', 'Other'],
            datasets: [{
              data: [stats.drops, stats.drives, stats.other],
              backgroundColor: ['#34d399', '#60a5fa', '#9ca3af'],
              borderWidth: 0,
            }],
          }}
          options={{
            plugins: { legend: { labels: { color: '#9ca3af' } } },
          }}
        />
      </div>

      <div className="grid gap-3 content-start">
        <Stat label="Total 3rd Shots" value={stats.total} />
        <Stat label="Drop Rate" value={`${(stats.dropRate * 100).toFixed(0)}%`} />
        <Stat label="Kitchen Landing Rate" value={`${(stats.kitchenRate * 100).toFixed(0)}%`} />
        <Stat label="Kitchen Lands" value={stats.kitchenLands} />
      </div>
    </div>
  )
}

// ── Tab: Rally ────────────────────────────────────────────────────

function RallyTab({ stats }) {
  if (!stats) {
    return <p className="text-gray-400">Not enough rally data.</p>
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 className="text-gray-200 font-semibold mb-4">
          Rally Length Distribution
          <span className="ml-2 text-gray-400 text-sm font-normal">(avg {stats.avgLength.toFixed(1)} shots)</span>
        </h3>
        <Bar
          data={{
            labels: stats.dist.map((d) => d.length),
            datasets: [{
              label: 'Rallies',
              data: stats.dist.map((d) => d.count),
              backgroundColor: '#60a5fa',
            }],
          }}
          options={chartDefaults}
        />
      </div>

      <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
        <h3 className="text-gray-200 font-semibold mb-4">Avg Speed by Shot #</h3>
        <Line
          data={{
            labels: stats.speedByShot.map((d) => `Shot ${d.shot}`),
            datasets: [{
              label: 'Avg Speed (mph)',
              data: stats.speedByShot.map((d) => d.avgSpeed.toFixed(1)),
              borderColor: '#34d399',
              backgroundColor: 'rgba(52,211,153,0.1)',
              tension: 0.3,
              fill: true,
            }],
          }}
          options={chartDefaults}
        />
      </div>
    </div>
  )
}

// ── Tab: Patterns ─────────────────────────────────────────────────

function PatternsTab({ stats, shots }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {stats.map((p) => {
        const topStroke = topKey(p.strokeCounts)
        const topDir = topKey(p.directionCounts)
        const topSpin = topKey(p.spinCounts)

        const strengths = []
        const warnings = []

        if (p.errorRate < 0.1) strengths.push('Low error rate (<10%)')
        if (p.errorRate > 0.25) warnings.push('High error rate (>25%)')
        if (p.winners > 0) strengths.push(`${p.winners} winners`)
        if (p.avgSpeed && p.avgSpeed > 30) strengths.push(`High avg speed (${p.avgSpeed.toFixed(0)} mph)`)

        return (
          <div key={p.player} className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4">
            <h3 className="text-gray-100 font-semibold">{p.player}</h3>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-500 text-xs">Fav. Stroke</p>
                <p className="text-gray-200 font-medium mt-1">{topStroke ?? '—'}</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-500 text-xs">Fav. Direction</p>
                <p className="text-gray-200 font-medium mt-1">{topDir ?? '—'}</p>
              </div>
              <div className="bg-gray-800 rounded p-3">
                <p className="text-gray-500 text-xs">Fav. Spin</p>
                <p className="text-gray-200 font-medium mt-1">{topSpin ?? '—'}</p>
              </div>
            </div>

            {strengths.length > 0 && (
              <div>
                <p className="text-emerald-400 text-xs font-semibold uppercase mb-1">Strengths</p>
                <ul className="space-y-1">
                  {strengths.map((s) => (
                    <li key={s} className="text-gray-300 text-sm flex items-center gap-2">
                      <span className="text-emerald-400">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {warnings.length > 0 && (
              <div>
                <p className="text-red-400 text-xs font-semibold uppercase mb-1">Watch out</p>
                <ul className="space-y-1">
                  {warnings.map((w) => (
                    <li key={w} className="text-gray-300 text-sm flex items-center gap-2">
                      <span className="text-red-400">!</span> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function topKey(obj) {
  if (!obj || !Object.keys(obj).length) return null
  return Object.entries(obj).sort((a, b) => b[1] - a[1])[0][0]
}

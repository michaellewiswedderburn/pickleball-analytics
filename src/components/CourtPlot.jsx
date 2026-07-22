import { useMemo, useState } from 'react'
import { COURT } from '../utils/analytics'

// SVG layout constants
const PAD = 24
const SCALE = 38 // px per meter
const W = Math.round(COURT.width * SCALE) + PAD * 2   // ~280
const H = Math.round(COURT.length * SCALE) + PAD * 2  // ~553

function courtY(y) { return PAD + (COURT.length - y) * SCALE }
function courtX(x) { return PAD + (-x + COURT.halfWidth) * SCALE } // negate x

const RESULT_COLORS = {
  winner: '#34d399',
  error: '#f87171',
  'in play': '#60a5fa',
  out: '#fb923c',
  net: '#a78bfa',
}

function resultColor(result = '') {
  const r = result.toLowerCase()
  if (r.includes('winner')) return RESULT_COLORS.winner
  if (r.includes('error') || r.includes('fault')) return RESULT_COLORS.error
  if (r.includes('out')) return RESULT_COLORS.out
  if (r.includes('net')) return RESULT_COLORS.net
  return RESULT_COLORS['in play']
}

export default function CourtPlot({ shots }) {
  const players = useMemo(() => [...new Set(shots.map((s) => s.player).filter(Boolean))], [shots])
  const strokes = useMemo(() => [...new Set(shots.map((s) => s.stroke).filter(Boolean))], [shots])
  const results = useMemo(() => [...new Set(shots.map((s) => s.result).filter(Boolean))], [shots])

  const [filterPlayer, setFilterPlayer] = useState('All')
  const [filterStroke, setFilterStroke] = useState('All')
  const [filterResult, setFilterResult] = useState('All')
  const [showTrajectory, setShowTrajectory] = useState(false)
  const [hovered, setHovered] = useState(null)

  const visible = useMemo(() => {
    return shots.filter((s) => {
      if (filterPlayer !== 'All' && s.player !== filterPlayer) return false
      if (filterStroke !== 'All' && s.stroke !== filterStroke) return false
      if (filterResult !== 'All' && s.result !== filterResult) return false
      return s.bounce.x != null && s.bounce.y != null
    })
  }, [shots, filterPlayer, filterStroke, filterResult])

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 text-sm">
        <FilterSelect label="Player" value={filterPlayer} onChange={setFilterPlayer} options={['All', ...players]} />
        <FilterSelect label="Stroke" value={filterStroke} onChange={setFilterStroke} options={['All', ...strokes]} />
        <FilterSelect label="Result" value={filterResult} onChange={setFilterResult} options={['All', ...results]} />
        <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrajectory}
            onChange={(e) => setShowTrajectory(e.target.checked)}
            className="accent-emerald-400"
          />
          Show trajectories
        </label>
      </div>

      <div className="flex gap-6 flex-wrap">
        {/* Court SVG */}
        <div className="relative">
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            className="rounded overflow-hidden"
            style={{ background: '#2d6a4f' }}
          >
            <CourtLines />
            {visible.map((s, i) => {
              const bx = courtX(s.bounce.x)
              const by = courtY(s.bounce.y)
              const color = resultColor(s.result)
              return (
                <g key={i}>
                  {showTrajectory && s.hit.x != null && s.hit.y != null && (
                    <line
                      x1={courtX(s.hit.x)} y1={courtY(s.hit.y)}
                      x2={bx} y2={by}
                      stroke={color} strokeOpacity={0.35} strokeWidth={1}
                    />
                  )}
                  <circle
                    cx={bx} cy={by} r={4}
                    fill={color} fillOpacity={0.85} stroke="#000" strokeWidth={0.5}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(s)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              )
            })}
          </svg>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-300 bg-black/50 px-2 py-0.5 rounded">
            Net ↑ · Near baseline ↓
          </div>
        </div>

        {/* Legend + tooltip */}
        <div className="flex flex-col gap-3 justify-start pt-1">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Result</p>
          {Object.entries(RESULT_COLORS).map(([label, color]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
              <span className="capitalize text-gray-300">{label}</span>
            </div>
          ))}

          <p className="text-xs text-gray-500 mt-2">{visible.length} shots shown</p>

          {hovered && (
            <div className="mt-2 bg-gray-800 rounded p-3 text-xs space-y-1 min-w-[160px]">
              <p className="font-semibold text-gray-100">{hovered.player}</p>
              <p><span className="text-gray-400">Stroke:</span> {hovered.stroke}</p>
              <p><span className="text-gray-400">Result:</span> {hovered.result}</p>
              <p><span className="text-gray-400">Speed:</span> {hovered.speedMph ? `${hovered.speedMph} mph` : '—'}</p>
              <p><span className="text-gray-400">Spin:</span> {hovered.spin || '—'}</p>
              <p><span className="text-gray-400">Direction:</span> {hovered.direction || '—'}</p>
              <p><span className="text-gray-400">Shot #:</span> {hovered.shot}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CourtLines() {
  const netY = courtY(COURT.net)
  const knY = courtY(COURT.kitchenNear)
  const kfY = courtY(COURT.kitchenFar)
  const left = PAD
  const right = PAD + COURT.width * SCALE
  const top = PAD
  const bottom = PAD + COURT.length * SCALE
  const centerX = courtX(0)

  return (
    <g stroke="white" strokeWidth={1.5} fill="none">
      {/* Outer boundary */}
      <rect x={left} y={top} width={COURT.width * SCALE} height={COURT.length * SCALE} stroke="white" strokeWidth={2} />
      {/* Net */}
      <line x1={left} y1={netY} x2={right} y2={netY} stroke="#e5e7eb" strokeWidth={2.5} />
      {/* Kitchen lines */}
      <line x1={left} y1={knY} x2={right} y2={knY} strokeDasharray="4 3" strokeOpacity={0.7} />
      <line x1={left} y1={kfY} x2={right} y2={kfY} strokeDasharray="4 3" strokeOpacity={0.7} />
      {/* Center line (full length) */}
      <line x1={centerX} y1={top} x2={centerX} y2={bottom} strokeDasharray="4 3" strokeOpacity={0.5} />

      {/* Kitchen fill (subtle) */}
      <rect
        x={left} y={knY}
        width={COURT.width * SCALE} height={kfY - knY}
        fill="rgba(0,0,0,0.15)" stroke="none"
      />

      {/* Labels */}
      <text x={left + 4} y={netY - 5} fill="#d1fae5" fontSize={10} stroke="none">Net</text>
      <text x={left + 4} y={knY - 4} fill="#fde68a" fontSize={9} stroke="none">Kitchen</text>
      <text x={left + 4} y={kfY + 12} fill="#fde68a" fontSize={9} stroke="none">Kitchen</text>
    </g>
  )
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-gray-400">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1 text-sm"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

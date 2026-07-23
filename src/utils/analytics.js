// ── Court geometry ────────────────────────────────────────────────
// y=0 near baseline, y=13.411 far baseline, net at y=6.705
// kitchen lines at y=4.571 (near) and y=8.840 (far)
// x=0 center, court width ±3.048 m
// IMPORTANT: negate x when plotting

export const COURT = {
  width: 6.096,   // m (20 ft)
  length: 13.411, // m (44 ft)
  net: 6.705,
  kitchenNear: 4.571,   // 6.705 - 2.134
  kitchenFar: 8.840,    // 6.705 + 2.134
  halfWidth: 3.048,
}

// ── Per-player summaries ──────────────────────────────────────────

// Build a Set of shot keys that are the final shot of each rally.
// Winner = last shot of rally with result "In" (opponent couldn't return).
// Error  = last shot of rally with result "Out" or "Net".
function rallyEndingShots(shots) {
  const byPoint = groupBy(shots, 'point')
  const winners = new Set()
  const errors = new Set()
  Object.values(byPoint).forEach((pts) => {
    const last = pts[pts.length - 1]
    const key = `${last.point}-${last.shot}`
    if (last.result === 'In') winners.add(key)
    else if (last.result === 'Out' || last.result === 'Net') errors.add(key)
  })
  return { winners, errors }
}

export function playerStats(shots) {
  const { winners: winnerKeys, errors: errorKeys } = rallyEndingShots(shots)
  const players = [...new Set(shots.map((s) => s.player).filter(Boolean))]
  return players.map((player) => {
    const ps = shots.filter((s) => s.player === player)
    const total = ps.length
    const errors = ps.filter((s) => errorKeys.has(`${s.point}-${s.shot}`)).length
    const winners = ps.filter((s) => winnerKeys.has(`${s.point}-${s.shot}`)).length
    const speeds = ps.map((s) => s.speedMph).filter((v) => v != null)
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null
    const maxSpeed = speeds.length ? Math.max(...speeds) : null

    const strokeCounts = countBy(ps, 'stroke')
    const directionCounts = countBy(ps, 'direction')
    const spinCounts = countBy(ps, 'spin')

    return {
      player,
      total,
      errors,
      winners,
      errorRate: total ? errors / total : 0,
      avgSpeed,
      maxSpeed,
      strokeCounts,
      directionCounts,
      spinCounts,
    }
  })
}

// ── Third-shot analysis ───────────────────────────────────────────

function calcThirdShotSummary(thirds) {
  const drops = thirds.filter((s) => /drop/i.test(s.stroke))
  const drives = thirds.filter((s) => /drive/i.test(s.stroke))
  const kitchenLands = thirds.filter(
    (s) =>
      s.bounce.y != null &&
      s.bounce.y >= COURT.kitchenFar - 0.05 &&
      s.bounce.y <= COURT.kitchenFar + 2.134,
  )
  return {
    total: thirds.length,
    drops: drops.length,
    drives: drives.length,
    other: thirds.length - drops.length - drives.length,
    dropRate: thirds.length ? drops.length / thirds.length : 0,
    kitchenLands: kitchenLands.length,
    kitchenRate: thirds.length ? kitchenLands.length / thirds.length : 0,
  }
}

export function thirdShotStats(shots) {
  const thirds = shots.filter((s) => s.shot === 3)
  if (!thirds.length) return null

  const players = [...new Set(thirds.map((s) => s.player).filter(Boolean))]
  const byPlayer = players.map((player) => ({
    player,
    ...calcThirdShotSummary(thirds.filter((s) => s.player === player)),
  }))

  return {
    ...calcThirdShotSummary(thirds),
    shots: thirds,
    byPlayer,
  }
}

// ── Rally analysis ────────────────────────────────────────────────

export function rallyStats(shots) {
  // Group into rallies by point id
  const byPoint = groupBy(shots, 'point')
  const lengths = Object.values(byPoint).map((pts) => pts.length)
  if (!lengths.length) return null

  const dist = Array.from({ length: Math.max(...lengths) + 1 }, (_, i) => ({
    length: i,
    count: lengths.filter((l) => l === i).length,
  })).filter((d) => d.count > 0)

  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length

  // Speed by shot number (avg across all rallies)
  const speedByShotNum = {}
  shots.forEach((s) => {
    if (s.speedMph != null) {
      if (!speedByShotNum[s.shot]) speedByShotNum[s.shot] = []
      speedByShotNum[s.shot].push(s.speedMph)
    }
  })
  const speedByShot = Object.entries(speedByShotNum)
    .map(([shot, speeds]) => ({
      shot: Number(shot),
      avgSpeed: speeds.reduce((a, b) => a + b, 0) / speeds.length,
    }))
    .sort((a, b) => a.shot - b.shot)

  return { dist, avgLength, speedByShot }
}

// ── Performance metrics (computed from shots) ─────────────────────

const ATTACK_STROKES = new Set(['Forehand', 'Backhand', 'Overhead', 'Volley'])

// Shot quality score for a single shot (0–10).
function shotQualityScore(shot, isWinner, isError) {
  if (isWinner) {
    if (shot.shot === 1 || shot.shot === 2) return 9.5          // ace or return ace
    if (shot.stroke === 'Volley' || shot.stroke === 'Overhead') return 8.5
    return 9.0                                                   // groundstroke winner
  }
  if (isError) return (shot.shot === 1 || shot.shot === 2) ? 3.0 : 2.5

  const isDropOrDink = /drop|dink/i.test(shot.stroke)
  const isServe = shot.shot === 1

  // Drops/dinks start at 5 (placement-driven); all other shots start at 7
  let score = isDropOrDink ? 5.0 : 7.0

  // Speed: drops/dinks are naturally slow — don't penalise them.
  // Other shots: small penalty for slow, moderate bonus for fast.
  if (shot.speedMph != null && !isDropOrDink) {
    const norm = Math.min(1, Math.max(0, (shot.speedMph - 10) / 45))
    score += norm * 3 - 0.5  // range: −0.5 (slow) to +2.5 (fast)
  }

  // Placement: increased influence (×0.7 vs former ×0.5).
  if (shot.bounce.x != null && shot.bounce.y != null) {
    const p = isServe
      ? servePlacementScore(shot.bounce.x, shot.bounce.y)
      : bouncePlacementScore(shot.bounce.x, shot.bounce.y, shot.stroke)
    score += (p - 5) * 0.7
  }

  return Math.min(10, Math.max(0, score))
}

// Serve placement: rewards depth (close to far baseline) and width (close to sideline).
// Valid serve area on the far side: kitchen line (8.840) to far baseline (13.411).
function servePlacementScore(x, y) {
  if (y < COURT.kitchenFar || y > COURT.length) return 2.0  // fault
  const depthRatio = (y - COURT.kitchenFar) / (COURT.length - COURT.kitchenFar)
  const depthScore = depthRatio * 10        // deeper = higher
  const widthScore = (Math.abs(x) / COURT.halfWidth) * 10   // wider = higher
  return Math.min(10, depthScore * 0.6 + widthScore * 0.4)
}

// Score placement 0–10 based on where the ball bounced and what stroke was used.
function bouncePlacementScore(x, y, stroke) {
  const isDropOrDink = /drop|dink/i.test(stroke)

  if (isDropOrDink) {
    const kitchenHalf = (COURT.kitchenFar - COURT.kitchenNear) / 2
    if (y >= COURT.kitchenNear && y <= COURT.kitchenFar) {
      const distFromLine = Math.min(
        Math.abs(y - COURT.kitchenNear),
        Math.abs(y - COURT.kitchenFar),
      )
      return 6 + (1 - distFromLine / kitchenHalf) * 4
    }
    return Math.max(1, 5 - Math.min(Math.abs(y - COURT.kitchenNear), Math.abs(y - COURT.kitchenFar)) * 1.5)
  }

  // Groundstrokes / volleys: reward depth and width
  const depthRatio = y < COURT.net
    ? 1 - y / COURT.net
    : (y - COURT.net) / (COURT.length - COURT.net)
  const depthScore = (1 - depthRatio) * 10
  const widthScore = (Math.abs(x) / COURT.halfWidth) * 8
  return Math.min(10, depthScore * 0.6 + widthScore * 0.4)
}

export function computeMetrics(shots) {
  const { winners: winnerKeys, errors: errorKeys } = rallyEndingShots(shots)
  const players = [...new Set(shots.map((s) => s.player).filter(Boolean))]

  return Object.fromEntries(players.map((player) => {
    const ps = shots.filter((s) => s.player === player)

    // Winners / errors / conversion
    const wins = ps.filter((s) => winnerKeys.has(`${s.point}-${s.shot}`)).length
    const errs = ps.filter((s) => errorKeys.has(`${s.point}-${s.shot}`)).length
    const convPct = (wins + errs) > 0 ? (wins / (wins + errs)) * 100 : 0

    // In-attack % — share of shots that are offensive strokes
    const inAttackPct = ps.length
      ? (ps.filter((s) => ATTACK_STROKES.has(s.stroke)).length / ps.length) * 100
      : 0

    // Shot quality per stroke with Bayesian shrinkage.
    // Low-sample strokes are pulled toward PRIOR_MEAN; high-sample strokes are unaffected.
    const PRIOR_MEAN = 6.5   // neutral prior across all shot types
    const PRIOR_WEIGHT = 5   // equivalent to 5 virtual shots at the prior
    const byStroke = {}
    const strokeGroups = groupBy(ps.filter((s) => s.stroke), 'stroke')
    Object.entries(strokeGroups).forEach(([stroke, ss]) => {
      const scores = ss.map((s) =>
        shotQualityScore(s, winnerKeys.has(`${s.point}-${s.shot}`), errorKeys.has(`${s.point}-${s.shot}`))
      )
      const n = scores.length
      const rawAvg = avg(scores)
      byStroke[stroke] = (n * rawAvg + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT)
    })

    // Serve (shot 1) and Return (shot 2) as position-based categories, also shrunk
    const serveShots = ps.filter((s) => s.shot === 1)
    const returnShots = ps.filter((s) => s.shot === 2)
    if (serveShots.length) {
      const scores = serveShots.map((s) =>
        shotQualityScore(s, winnerKeys.has(`${s.point}-${s.shot}`), errorKeys.has(`${s.point}-${s.shot}`))
      )
      const n = scores.length
      byStroke['Serve'] = (n * avg(scores) + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT)
    }
    if (returnShots.length) {
      const scores = returnShots.map((s) =>
        shotQualityScore(s, winnerKeys.has(`${s.point}-${s.shot}`), errorKeys.has(`${s.point}-${s.shot}`))
      )
      const n = scores.length
      byStroke['Return'] = (n * avg(scores) + PRIOR_WEIGHT * PRIOR_MEAN) / (n + PRIOR_WEIGHT)
    }

    // Overall shot quality = weighted avg across all strokes by shot count
    const allScores = ps.map((s) =>
      shotQualityScore(s, winnerKeys.has(`${s.point}-${s.shot}`), errorKeys.has(`${s.point}-${s.shot}`))
    )
    const sqScore = avg(allScores)
    const convScore = convPct / 10
    const attackScore = inAttackPct / 10
    const overall = 0.3 * sqScore + 0.5 * convScore + 0.2 * attackScore

    return [player, {
      performance_rating: {
        overall: round2(overall),
        components: {
          shot_quality: round2(sqScore),
          conversion_score: round2(convScore),
          in_attack_score: round2(attackScore),
        },
        raw: {
          winners: wins,
          errors: errs,
          conversion_pct: round1(convPct),
          in_attack_pct: round1(inAttackPct),
        },
        weights: { shot_quality: 0.3, conversion: 0.5, in_attack: 0.2 },
      },
      shot_quality_by_stroke: Object.fromEntries(
        Object.entries(byStroke).map(([k, v]) => [k, round2(v)])
      ),
    }]
  }))
}

// ── Helpers ───────────────────────────────────────────────────────

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function round1(n) { return Math.round(n * 10) / 10 }
function round2(n) { return Math.round(n * 100) / 100 }

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    const v = item[key] || 'Unknown'
    acc[v] = (acc[v] || 0) + 1
    return acc
  }, {})
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const v = item[key]
    if (!acc[v]) acc[v] = []
    acc[v].push(item)
    return acc
  }, {})
}

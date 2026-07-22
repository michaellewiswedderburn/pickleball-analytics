const MATCHES_KEY = 'pb_matches'

export function getMatches() {
  try {
    return JSON.parse(localStorage.getItem(MATCHES_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function getMatch(id) {
  return getMatches().find((m) => m.id === id) ?? null
}

export function saveMatch(match) {
  const matches = getMatches()
  const idx = matches.findIndex((m) => m.id === match.id)
  if (idx >= 0) {
    matches[idx] = match
  } else {
    matches.push(match)
  }
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches))
}

export function deleteMatch(id) {
  const matches = getMatches().filter((m) => m.id !== id)
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches))
}

export function attachMetrics(id, metricsData) {
  const match = getMatch(id)
  if (!match) return
  saveMatch({ ...match, metrics: metricsData })
}

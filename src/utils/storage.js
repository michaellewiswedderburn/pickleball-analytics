import { supabase } from './supabase'

export async function getMatches() {
  const { data, error } = await supabase
    .from('matches')
    .select('id, label, uploaded_at, shot_count, players, metrics')
    .order('uploaded_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getMatch(id) {
  const { data: match, error: mErr } = await supabase
    .from('matches')
    .select('*')
    .eq('id', id)
    .single()
  if (mErr) throw mErr

  const { data: shots, error: sErr } = await supabase
    .from('shots')
    .select('*')
    .eq('match_id', id)
    .order('point', { ascending: true })
  if (sErr) throw sErr

  return {
    ...match,
    shots: shots.map(normalizeShot),
  }
}

export async function saveMatch(match) {
  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error: mErr } = await supabase
    .from('matches')
    .insert({
      id: match.id,
      user_id: user.id,
      label: match.label,
      uploaded_at: match.uploadedAt,
      shot_count: match.shotCount,
      players: match.players,
      metrics: match.metrics ?? null,
    })
    .select()
    .single()
  if (mErr) throw mErr

  const shotRows = match.shots.map((s) => ({
    match_id: row.id,
    point: s.point,
    game: s.game,
    set_num: s.set,
    shot: s.shot,
    type: s.type,
    player: s.player,
    stroke: s.stroke,
    result: s.result,
    direction: s.direction,
    spin: s.spin,
    speed_mph: s.speedMph,
    hit_x: s.hit?.x ?? null,
    hit_y: s.hit?.y ?? null,
    hit_z: s.hit?.z ?? null,
    bounce_x: s.bounce?.x ?? null,
    bounce_y: s.bounce?.y ?? null,
    bounce_zone: s.bounceZone,
    bounce_side: s.bounceSide,
    hit_zone: s.hitZone,
    video_time: s.videoTime ?? null,
  }))

  const { error: sErr } = await supabase.from('shots').insert(shotRows)
  if (sErr) throw sErr

  return row
}

export async function deleteMatch(id) {
  const { error } = await supabase.from('matches').delete().eq('id', id)
  if (error) throw error
}

export async function saveVideoOffset(id, offset) {
  const { error } = await supabase
    .from('matches')
    .update({ video_offset: offset })
    .eq('id', id)
  if (error) throw error
}

export async function saveRallyBuffers(id, rallyBuffers) {
  const { error } = await supabase
    .from('matches')
    .update({ rally_buffers: rallyBuffers })
    .eq('id', id)
  if (error) throw error
}

export async function saveVideoUrl(id, videoUrl) {
  const { error } = await supabase
    .from('matches')
    .update({ video_url: videoUrl })
    .eq('id', id)
  if (error) throw error
}

export async function attachMetrics(id, metricsData) {
  const { error } = await supabase
    .from('matches')
    .update({ metrics: metricsData })
    .eq('id', id)
  if (error) throw error
}

// Map DB row back to the shape the rest of the app expects
export async function deleteShot(shotId) {
  const { error } = await supabase.from('shots').delete().eq('id', shotId)
  if (error) throw error
}

function normalizeShot(s) {
  return {
    id: s.id,
    point: s.point,
    game: s.game,
    set: s.set_num,
    shot: s.shot,
    type: s.type ?? '',
    player: s.player ?? '',
    stroke: s.stroke ?? '',
    result: s.result ?? '',
    direction: s.direction ?? '',
    spin: s.spin ?? '',
    speedMph: s.speed_mph,
    hit: { x: s.hit_x, y: s.hit_y, z: s.hit_z },
    bounce: { x: s.bounce_x, y: s.bounce_y },
    bounceZone: s.bounce_zone ?? '',
    bounceSide: s.bounce_side ?? '',
    hitZone: s.hit_zone ?? '',
    videoTime: s.video_time ?? null,
  }
}

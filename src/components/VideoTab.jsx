import { useRef, useState, useEffect, useCallback } from 'react'
import { deleteShot, saveVideoUrl, saveRallyBuffers, saveVideoOffset, updateShotNumbers, updateShotRally } from '../utils/storage'

const DEFAULT_PRE = 0.5
const DEFAULT_POST = 0.5

export default function VideoTab({ matchId, videoUrl: savedUrl, shots, rallyBuffers: savedBuffers, videoOffset: savedOffset, onShotDeleted, onVideoSaved, onBuffersSaved, onOffsetSaved, onShotsReordered, onShotMoved }) {
  const videoRef = useRef()
  const [videoSrc, setVideoSrc] = useState(savedUrl || null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [mode, setMode] = useState('rally')
  const [selectedPoint, setSelectedPoint] = useState('')
  const [selectedShotKey, setSelectedShotKey] = useState('')
  const [rallyBuffers, setRallyBuffers] = useState(savedBuffers ?? {})
  const [unsaved, setUnsaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [offset, setOffset] = useState(savedOffset ?? 0)
  const [syncMode, setSyncMode] = useState(false)
  const [syncShot, setSyncShot] = useState('')
  const [savingOffset, setSavingOffset] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [reorderedShots, setReorderedShots] = useState([])
  const [savingOrder, setSavingOrder] = useState(false)
  const endTimeRef = useRef(null)
  const localObjUrl = useRef(null)

  // Helpers to get/set per-rally buffers, falling back to defaults
  function getBuf(point) {
    return {
      pre: rallyBuffers[point]?.pre ?? DEFAULT_PRE,
      post: rallyBuffers[point]?.post ?? DEFAULT_POST,
    }
  }

  function setBuf(point, key, val) {
    setRallyBuffers((prev) => ({
      ...prev,
      [point]: { ...getBuf(point), [key]: val },
    }))
    setUnsaved(true)
  }

  function handleMarkSync() {
    const video = videoRef.current
    if (!video || !syncShot) return
    const [point, shot] = syncShot.split('-').map(Number)
    const s = timedShots.find((s) => s.point === point && s.shot === shot)
    if (!s) return
    const newOffset = video.currentTime - s.videoTime
    setOffset(newOffset)
  }

  async function handleSaveOffset() {
    setSavingOffset(true)
    try {
      await saveVideoOffset(matchId, offset)
      onOffsetSaved?.(offset)
      setSyncMode(false)
    } catch (err) {
      alert('Failed to save offset: ' + err.message)
    } finally {
      setSavingOffset(false)
    }
  }

  async function handleSaveBuffers() {
    setSaving(true)
    try {
      await saveRallyBuffers(matchId, rallyBuffers)
      onBuffersSaved?.(rallyBuffers)
      setUnsaved(false)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Deduplicate by id, normalize point to number, sort by (point, shot)
  const timedShots = Object.values(
    shots
      .filter((s) => s.videoTime != null)
      .reduce((acc, s) => { acc[s.id] = { ...s, point: Number(s.point), shot: Number(s.shot) }; return acc }, {})
  ).sort((a, b) => a.point !== b.point ? a.point - b.point : a.shot - b.shot)

  // Group by CSV point value — each unique point is one rally
  const points = [...new Set(timedShots.map((s) => s.point))].sort((a, b) => a - b)
  const rallies = points.map((p) => timedShots.filter((s) => s.point === p))

  async function handleVideoFile(file) {
    if (!file) return
    setUploadError('')

    // Show local preview immediately while uploading
    if (localObjUrl.current) URL.revokeObjectURL(localObjUrl.current)
    const objUrl = URL.createObjectURL(file)
    localObjUrl.current = objUrl
    setVideoSrc(objUrl)
    setSelectedPoint('')
    setSelectedShotKey('')

    // Upload to R2
    setUploading(true)
    setUploadProgress(0)
    try {
      const res = await fetch('/api/get-upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      if (!res.ok) throw new Error('Failed to get upload URL')
      const { uploadUrl, publicUrl } = await res.json()

      await uploadWithProgress(file, uploadUrl, setUploadProgress)

      await saveVideoUrl(matchId, publicUrl)
      onVideoSaved?.(publicUrl)
      setVideoSrc(publicUrl)
    } catch (err) {
      setUploadError('Upload failed: ' + err.message)
      // Keep local preview usable even if upload failed
    } finally {
      setUploading(false)
    }
  }

  function seekAndPlay(startTime, stopTime) {
    const video = videoRef.current
    if (!video) return
    endTimeRef.current = stopTime + offset
    video.currentTime = Math.max(0, startTime + offset)
    video.play()
  }

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (endTimeRef.current != null && video.currentTime >= endTimeRef.current) {
      video.pause()
      endTimeRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [handleTimeUpdate])

  function handlePointSelect(val) {
    setSelectedPoint(val)
    setSelectedShotKey('')
    setReorderMode(false)
    setReorderedShots([])
    if (val === '') return
    const rallyShots = timedShots.filter((s) => s.point === Number(val))
    if (!rallyShots.length) return
    const { pre, post } = getBuf(val)
    seekAndPlay(rallyShots[0].videoTime - pre, rallyShots[rallyShots.length - 1].videoTime + post)
  }

  function handleShotSelect(val) {
    setSelectedShotKey(val)
    if (!val) return
    const [point, shot] = val.split('-').map(Number)
    const s = timedShots.find((s) => s.point === point && s.shot === shot)
    if (s) {
      const { pre, post } = getBuf(selectedPoint)
      seekAndPlay(s.videoTime - pre, s.videoTime + post)
    }
  }

  const selectedShots = (() => {
    if (mode === 'rally' && selectedPoint !== '')
      return timedShots.filter((s) => s.point === Number(selectedPoint))
    if (mode === 'shot' && selectedShotKey) {
      const [point, shot] = selectedShotKey.split('-').map(Number)
      return timedShots.filter((s) => s.point === point && s.shot === shot)
    }
    return []
  })()

  async function handleSaveOrder() {
    setSavingOrder(true)
    try {
      const updates = reorderedShots.map((s, i) => ({ id: s.id, shot: i + 1 }))
      await updateShotNumbers(updates)
      onShotsReordered?.(updates)
      setReorderMode(false)
      setReorderedShots([])
    } catch (err) {
      alert('Failed to save order: ' + err.message)
    } finally {
      setSavingOrder(false)
    }
  }

  async function handleMoveShot(shot, destRallyIndex) {
    const maxPoint = Math.max(...shots.map((s) => s.point ?? 0))
    let destPoint, destShotNum

    if (destRallyIndex === 'new') {
      destPoint = maxPoint + 1
      destShotNum = 1
    } else {
      destPoint = points[destRallyIndex]
      destShotNum = rallies[destRallyIndex].length + 1
    }

    await updateShotRally(shot.id, destPoint, destShotNum)

    // Renumber remaining shots in the source rally
    const sourceRally = rallies.find((r) => r.some((s) => s.id === shot.id))
    if (sourceRally) {
      const remaining = sourceRally.filter((s) => s.id !== shot.id)
      if (remaining.length) {
        await updateShotNumbers(remaining.map((s, i) => ({ id: s.id, shot: i + 1 })))
      }
    }

    onShotMoved?.({ id: shot.id, point: destPoint, shot: destShotNum }, sourceRally?.filter((s) => s.id !== shot.id).map((s, i) => ({ id: s.id, shot: i + 1 })) ?? [])
  }

  function moveShot(index, dir) {
    setReorderedShots((prev) => {
      const next = [...prev]
      const swap = index + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  const noTimingData = timedShots.length === 0

  return (
    <div className="space-y-5">
      {!videoSrc ? (
        <VideoDropzone onFile={handleVideoFile} />
      ) : (
        <div className="space-y-4">
          {noTimingData && (
            <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3 text-yellow-300 text-sm">
              No Video Time data found. Re-upload the CSV to include timing.
            </div>
          )}

          {uploading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Uploading to cloud…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-2 text-red-300 text-sm">
              {uploadError}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-3">
              <video ref={videoRef} src={videoSrc} controls className="w-full rounded-xl bg-black" />
              <div className="flex items-center gap-4">
                <button
                  onClick={() => document.getElementById('video-replace-input').click()}
                  className="text-xs text-gray-500 hover:text-emerald-400 transition-colors"
                >
                  Replace video
                </button>
                <input
                  id="video-replace-input" type="file" accept="video/*" className="hidden"
                  onChange={(e) => handleVideoFile(e.target.files[0])}
                />
              </div>
            </div>

            <div className="space-y-4">
              {/* Sync panel */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Video sync</p>
                  <div className="flex items-center gap-2">
                    {offset !== 0 && (
                      <span className="text-xs text-emerald-400">{offset > 0 ? '+' : ''}{offset.toFixed(2)}s</span>
                    )}
                    <button
                      onClick={() => setSyncMode((v) => !v)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${syncMode ? 'bg-emerald-700 text-white' : 'bg-gray-700 text-gray-300 hover:text-white'}`}
                    >
                      {syncMode ? 'Cancel' : 'Sync timing'}
                    </button>
                  </div>
                </div>

                {syncMode && (
                  <div className="space-y-3">
                    <p className="text-gray-500 text-xs">Scrub the video to the exact moment a shot starts, then select that shot and click Mark.</p>
                    <select
                      value={syncShot}
                      onChange={(e) => setSyncShot(e.target.value)}
                      className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Select reference shot…</option>
                      {timedShots.map((s) => (
                        <option key={`${s.point}-${s.shot}`} value={`${s.point}-${s.shot}`}>
                          Rally {points.indexOf(s.point) + 1} · Shot {s.shot} — {s.player} {s.stroke}
                        </option>
                      ))}
                    </select>
                    {/* Frame-by-frame controls */}
                    <div className="space-y-1">
                      <p className="text-gray-600 text-xs">Frame step (1/30s)</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const v = videoRef.current
                            if (!v) return
                            v.pause()
                            v.currentTime = Math.max(0, v.currentTime - 1 / 30)
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
                        >
                          ◀ Prev frame
                        </button>
                        <button
                          onClick={() => {
                            const v = videoRef.current
                            if (!v) return
                            v.pause()
                            v.currentTime = v.currentTime + 1 / 30
                          }}
                          className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors"
                        >
                          Next frame ▶
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleMarkSync}
                        disabled={!syncShot}
                        className="flex-1 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors disabled:opacity-40"
                      >
                        Mark current position
                      </button>
                      <button
                        onClick={handleSaveOffset}
                        disabled={savingOffset}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {savingOffset ? 'Saving…' : 'Save sync'}
                      </button>
                    </div>
                    {offset !== 0 && (
                      <p className="text-gray-500 text-xs text-center">
                        Offset: {offset > 0 ? '+' : ''}{offset.toFixed(2)}s applied to all shots
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {['rally', 'shot'].map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setSelectedPoint(''); setSelectedShotKey('') }}
                    className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      mode === m ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    By {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              {mode === 'rally' ? (
                <select
                  value={selectedPoint}
                  onChange={(e) => handlePointSelect(e.target.value)}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a rally…</option>
                  {points.map((p, i) => (
                    <option key={p} value={p}>
                      Rally {i + 1} — {rallies[i].length} shots
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedShotKey}
                  onChange={(e) => handleShotSelect(e.target.value)}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a shot…</option>
                  {timedShots.map((s) => (
                    <option key={`${s.point}-${s.shot}`} value={`${s.point}-${s.shot}`}>
                      Rally {s.point} · Shot {s.shot} — {s.player} {s.stroke} ({s.result})
                    </option>
                  ))}
                </select>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                    {selectedPoint !== '' ? `Rally ${points.indexOf(Number(selectedPoint)) + 1} clip buffers` : 'Clip buffers'}
                  </p>
                  {selectedPoint && (
                    <span className="text-gray-600 text-xs">
                      {rallyBuffers[selectedPoint] ? 'Custom' : 'Default'}
                    </span>
                  )}
                </div>
                <BufferInput
                  label="Pre-shot (s)"
                  value={selectedPoint ? getBuf(selectedPoint).pre : DEFAULT_PRE}
                  onChange={(fn) => selectedPoint && setBuf(selectedPoint, 'pre', typeof fn === 'function' ? fn(getBuf(selectedPoint).pre) : fn)}
                  disabled={!selectedPoint}
                />
                <BufferInput
                  label="Post-shot (s)"
                  value={selectedPoint ? getBuf(selectedPoint).post : DEFAULT_POST}
                  onChange={(fn) => selectedPoint && setBuf(selectedPoint, 'post', typeof fn === 'function' ? fn(getBuf(selectedPoint).post) : fn)}
                  disabled={!selectedPoint}
                />
                {unsaved && (
                  <button
                    onClick={handleSaveBuffers}
                    disabled={saving}
                    className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save clip settings'}
                  </button>
                )}
              </div>

              {selectedShots.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
                      {mode === 'rally'
                        ? `Rally ${points.indexOf(Number(selectedPoint)) + 1} — ${selectedShots.length} shots`
                        : 'Shot detail'}
                    </p>
                    {mode === 'rally' && (
                      <button
                        onClick={() => {
                          if (reorderMode) {
                            setReorderMode(false)
                            setReorderedShots([])
                          } else {
                            setReorderMode(true)
                            setReorderedShots([...selectedShots])
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded transition-colors ${reorderMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
                      >
                        {reorderMode ? 'Cancel' : 'Reorder'}
                      </button>
                    )}
                  </div>

                  {reorderMode ? (
                    <div className="space-y-1">
                      <p className="text-gray-500 text-xs mb-2">Use arrows to reorder, then save to renumber shots 1, 2, 3…</p>
                      {reorderedShots.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-0">
                          <div className="flex flex-col gap-0.5">
                            <button
                              onClick={() => moveShot(i, -1)}
                              disabled={i === 0}
                              className="text-gray-500 hover:text-gray-200 disabled:opacity-20 leading-none"
                            >▲</button>
                            <button
                              onClick={() => moveShot(i, 1)}
                              disabled={i === reorderedShots.length - 1}
                              className="text-gray-500 hover:text-gray-200 disabled:opacity-20 leading-none"
                            >▼</button>
                          </div>
                          <div className="text-xs flex-1">
                            <span className="text-gray-500">#{i + 1} </span>
                            <span className="text-gray-200">{s.player}</span>
                            <span className="text-gray-500"> · {s.stroke} · </span>
                            <span className={s.result === 'In' ? 'text-emerald-400' : 'text-red-400'}>{s.result}</span>
                          </div>
                        </div>
                      ))}
                      <button
                        onClick={handleSaveOrder}
                        disabled={savingOrder}
                        className="w-full mt-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        {savingOrder ? 'Saving…' : 'Save order'}
                      </button>
                    </div>
                  ) : (
                    selectedShots.map((s) => {
                      const { pre, post } = getBuf(selectedPoint)
                      return (
                        <ShotRow
                          key={s.id ?? `${s.point}-${s.shot}`}
                          shot={s}
                          rallies={rallies}
                          currentRallyIndex={points.indexOf(Number(selectedPoint))}
                          onSeek={() => {
                            setMode('shot')
                            setSelectedShotKey(`${s.point}-${s.shot}`)
                            seekAndPlay(s.videoTime - pre, s.videoTime + post)
                          }}
                          onDeleted={onShotDeleted}
                          onMove={(destIndex) => handleMoveShot(s, destIndex)}
                        />
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function VideoDropzone({ onFile }) {
  return (
    <div
      onClick={() => document.getElementById('video-file-input').click()}
      onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]) }}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-12 text-center cursor-pointer transition-colors"
    >
      <p className="text-gray-300 text-sm">Drop match video here</p>
      <p className="text-gray-500 text-xs mt-1">or click to browse · MP4, MOV, etc.</p>
      <p className="text-gray-600 text-xs mt-2">Video will be saved to the cloud automatically</p>
      <input
        id="video-file-input" type="file" accept="video/*" className="hidden"
        onChange={(e) => onFile(e.target.files[0])}
      />
    </div>
  )
}

function ShotRow({ shot: s, onSeek, onDeleted, onMove, rallies, currentRallyIndex }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [moving, setMoving] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteShot(s.id)
      onDeleted?.(s.id)
    } catch (err) {
      alert('Failed to delete shot: ' + err.message)
      setDeleting(false)
      setConfirming(false)
    }
  }

  async function handleMove() {
    if (moveTarget === '') return
    setMoving(true)
    try {
      await onMove?.(moveTarget === 'new' ? 'new' : Number(moveTarget))
    } catch (err) {
      alert('Failed to move shot: ' + err.message)
    } finally {
      setMoving(false)
      setMoveTarget('')
    }
  }

  return (
    <div className="text-xs py-2 border-b border-gray-800 last:border-0">
      <div
        onClick={onSeek}
        className="grid grid-cols-2 gap-x-3 gap-y-0.5 cursor-pointer hover:bg-gray-800 rounded px-2 -mx-2 pb-1 transition-colors"
      >
        <span className="text-gray-500">Shot {s.shot}</span>
        <span className="text-gray-200">{s.player}</span>
        <span className="text-gray-500">Stroke</span>
        <span className="text-gray-200">{s.stroke || '—'}</span>
        <span className="text-gray-500">Result</span>
        <span className={s.result === 'In' ? 'text-emerald-400' : 'text-red-400'}>{s.result || '—'}</span>
        {s.speedMph != null && (
          <>
            <span className="text-gray-500">Speed</span>
            <span className="text-gray-200">{s.speedMph} mph</span>
          </>
        )}
      </div>
      <div className="mt-1.5 px-2 -mx-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {!confirming ? (
          <button onClick={() => setConfirming(true)} className="text-red-500 hover:text-red-400 text-xs transition-colors">
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Remove?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Yes'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-gray-500 hover:text-gray-300">No</button>
          </div>
        )}
        <div className="flex items-center gap-1">
          <select
            value={moveTarget}
            onChange={(e) => setMoveTarget(e.target.value)}
            className="bg-gray-800 text-gray-400 border border-gray-700 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-emerald-500"
          >
            <option value="">Move to…</option>
            {rallies.map((_, i) => i !== currentRallyIndex && (
              <option key={i} value={i}>Rally {i + 1}</option>
            ))}
            <option value="new">+ New rally</option>
          </select>
          {moveTarget !== '' && (
            <button
              onClick={handleMove}
              disabled={moving}
              className="text-emerald-400 hover:text-emerald-300 font-medium disabled:opacity-50 text-xs"
            >
              {moving ? 'Moving…' : 'Go'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function BufferInput({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange((v) => Math.max(0, Math.round((v - 0.5) * 10) / 10))}
          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm flex items-center justify-center"
        >−</button>
        <span className="text-gray-200 text-sm w-8 text-center">{value.toFixed(1)}</span>
        <button
          onClick={() => onChange((v) => Math.min(10, Math.round((v + 0.5) * 10) / 10))}
          className="w-6 h-6 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm flex items-center justify-center"
        >+</button>
      </div>
    </div>
  )
}

function uploadWithProgress(file, url, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => xhr.status < 300 ? resolve() : reject(new Error(`Status ${xhr.status}`)))
    xhr.addEventListener('error', () => reject(new Error('Network error')))
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}

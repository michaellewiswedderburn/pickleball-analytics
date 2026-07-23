import { useRef, useState, useEffect, useCallback } from 'react'
import { deleteShot } from '../utils/storage'

export default function VideoTab({ shots, onShotDeleted }) {
  const videoRef = useRef()
  const [videoSrc, setVideoSrc] = useState(null)
  const [mode, setMode] = useState('rally')       // 'rally' | 'shot'
  const [selectedPoint, setSelectedPoint] = useState('')
  const [selectedShotKey, setSelectedShotKey] = useState('')
  const [preBuf, setPreBuf] = useState(0.5)
  const [postBuf, setPostBuf] = useState(0.5)
  const endTimeRef = useRef(null)

  const timedShots = shots.filter((s) => s.videoTime != null)
  const points = [...new Set(timedShots.map((s) => s.point))].sort((a, b) => a - b)

  function handleVideoFile(file) {
    if (!file) return
    if (videoSrc) URL.revokeObjectURL(videoSrc)
    setVideoSrc(URL.createObjectURL(file))
    setSelectedPoint('')
    setSelectedShotKey('')
  }

  function seekAndPlay(startTime, stopTime) {
    const video = videoRef.current
    if (!video) return
    endTimeRef.current = stopTime
    video.currentTime = Math.max(0, startTime)
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
    if (!val) return
    const rallyShots = timedShots.filter((s) => s.point === Number(val))
    if (!rallyShots.length) return
    const first = rallyShots[0]
    const last = rallyShots[rallyShots.length - 1]
    seekAndPlay(first.videoTime - preBuf, last.videoTime + postBuf)
  }

  function handleShotSelect(val) {
    setSelectedShotKey(val)
    if (!val) return
    const [point, shot] = val.split('-').map(Number)
    const s = timedShots.find((s) => s.point === point && s.shot === shot)
    if (!s) return
    seekAndPlay(s.videoTime - preBuf, s.videoTime + postBuf)
  }

  // Current shot details to show in the info panel
  const selectedShots = (() => {
    if (mode === 'rally' && selectedPoint) {
      return timedShots.filter((s) => s.point === Number(selectedPoint))
    }
    if (mode === 'shot' && selectedShotKey) {
      const [point, shot] = selectedShotKey.split('-').map(Number)
      return timedShots.filter((s) => s.point === point && s.shot === shot)
    }
    return []
  })()

  const noTimingData = timedShots.length === 0

  return (
    <div className="space-y-5">
      {/* Video upload */}
      {!videoSrc ? (
        <div
          onClick={() => document.getElementById('video-file-input').click()}
          onDrop={(e) => { e.preventDefault(); handleVideoFile(e.dataTransfer.files[0]) }}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-12 text-center cursor-pointer transition-colors"
        >
          <p className="text-gray-300 text-sm">Drop match video here</p>
          <p className="text-gray-500 text-xs mt-1">or click to browse · MP4, MOV, etc.</p>
          <input
            id="video-file-input" type="file" accept="video/*" className="hidden"
            onChange={(e) => handleVideoFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {noTimingData && (
            <div className="bg-yellow-950 border border-yellow-800 rounded-lg px-4 py-3 text-yellow-300 text-sm">
              No Video Time data found in this match's shots. Re-upload the CSV to include timing.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            {/* Video player */}
            <div className="space-y-3">
              <video
                ref={videoRef}
                src={videoSrc}
                controls
                className="w-full rounded-xl bg-black"
              />
              <button
                onClick={() => { URL.revokeObjectURL(videoSrc); setVideoSrc(null) }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Remove video
              </button>
            </div>

            {/* Controls panel */}
            <div className="space-y-4">
              {/* Mode toggle */}
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

              {/* Dropdown */}
              {mode === 'rally' ? (
                <select
                  value={selectedPoint}
                  onChange={(e) => handlePointSelect(e.target.value)}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a rally…</option>
                  {points.map((p) => {
                    const rallyShots = timedShots.filter((s) => s.point === p)
                    return (
                      <option key={p} value={p}>
                        Rally {p} — {rallyShots.length} shots
                      </option>
                    )
                  })}
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

              {/* Buffer controls */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Clip buffers</p>
                <BufferInput label="Pre-shot (s)" value={preBuf} onChange={setPreBuf} />
                <BufferInput label="Post-shot (s)" value={postBuf} onChange={setPostBuf} />
              </div>

              {/* Shot info panel */}
              {selectedShots.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
                    {mode === 'rally' ? `Rally ${selectedPoint} — ${selectedShots.length} shots` : 'Shot detail'}
                  </p>
                  {selectedShots.map((s) => (
                    <ShotRow
                      key={`${s.point}-${s.shot}`}
                      shot={s}
                      preBuf={preBuf}
                      postBuf={postBuf}
                      onSeek={() => {
                        setMode('shot')
                        setSelectedShotKey(`${s.point}-${s.shot}`)
                        seekAndPlay(s.videoTime - preBuf, s.videoTime + postBuf)
                      }}
                      onDeleted={onShotDeleted}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShotRow({ shot: s, onSeek, onDeleted }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
      <div className="mt-1.5 px-2 -mx-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-red-500 hover:text-red-400 text-xs transition-colors"
          >
            Delete shot
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Remove this shot?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-gray-500 hover:text-gray-300"
            >
              No
            </button>
          </div>
        )}
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

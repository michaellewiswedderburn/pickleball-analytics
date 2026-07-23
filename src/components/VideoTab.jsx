import { useRef, useState, useEffect, useCallback } from 'react'
import { deleteShot, saveVideoUrl } from '../utils/storage'

export default function VideoTab({ matchId, videoUrl: savedUrl, shots, onShotDeleted, onVideoSaved }) {
  const videoRef = useRef()
  const [videoSrc, setVideoSrc] = useState(savedUrl || null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  const [mode, setMode] = useState('rally')
  const [selectedPoint, setSelectedPoint] = useState('')
  const [selectedShotKey, setSelectedShotKey] = useState('')
  const [preBuf, setPreBuf] = useState(0.5)
  const [postBuf, setPostBuf] = useState(0.5)
  const endTimeRef = useRef(null)
  const localObjUrl = useRef(null)

  const timedShots = shots.filter((s) => s.videoTime != null)
  const points = [...new Set(timedShots.map((s) => s.point))].sort((a, b) => a - b)

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
    seekAndPlay(rallyShots[0].videoTime - preBuf, rallyShots[rallyShots.length - 1].videoTime + postBuf)
  }

  function handleShotSelect(val) {
    setSelectedShotKey(val)
    if (!val) return
    const [point, shot] = val.split('-').map(Number)
    const s = timedShots.find((s) => s.point === point && s.shot === shot)
    if (s) seekAndPlay(s.videoTime - preBuf, s.videoTime + postBuf)
  }

  const selectedShots = (() => {
    if (mode === 'rally' && selectedPoint)
      return timedShots.filter((s) => s.point === Number(selectedPoint))
    if (mode === 'shot' && selectedShotKey) {
      const [point, shot] = selectedShotKey.split('-').map(Number)
      return timedShots.filter((s) => s.point === point && s.shot === shot)
    }
    return []
  })()

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
                  {points.map((p) => (
                    <option key={p} value={p}>
                      Rally {p} — {timedShots.filter((s) => s.point === p).length} shots
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
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Clip buffers</p>
                <BufferInput label="Pre-shot (s)" value={preBuf} onChange={setPreBuf} />
                <BufferInput label="Post-shot (s)" value={postBuf} onChange={setPostBuf} />
              </div>

              {selectedShots.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-3">
                    {mode === 'rally' ? `Rally ${selectedPoint} — ${selectedShots.length} shots` : 'Shot detail'}
                  </p>
                  {selectedShots.map((s) => (
                    <ShotRow
                      key={`${s.point}-${s.shot}`}
                      shot={s}
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
          <button onClick={() => setConfirming(true)} className="text-red-500 hover:text-red-400 text-xs transition-colors">
            Delete shot
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Remove this shot?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-red-400 hover:text-red-300 font-medium disabled:opacity-50">
              {deleting ? 'Deleting…' : 'Yes'}
            </button>
            <button onClick={() => setConfirming(false)} className="text-gray-500 hover:text-gray-300">No</button>
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

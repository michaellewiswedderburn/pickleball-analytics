import { useRef, useState } from 'react'
import { parseSwingVisionCSV } from '../utils/csvParser'
import { saveMatch } from '../utils/storage'
import { v4 as uuidv4 } from 'uuid'

export default function CSVUploader({ onImported }) {
  const inputRef = useRef()
  const [state, setState] = useState('idle') // idle | parsing | saving | error | success
  const [error, setError] = useState('')
  const [label, setLabel] = useState('')

  async function handleFile(file) {
    if (!file) return
    setState('parsing')
    setError('')
    try {
      const shots = await parseSwingVisionCSV(file)
      if (!shots.length) throw new Error('No shots found — check the CSV format.')

      setState('saving')
      const players = [...new Set(shots.map((s) => s.player).filter(Boolean))]
      const match = {
        id: uuidv4(),
        label: label.trim() || file.name.replace(/\.csv$/i, ''),
        uploadedAt: new Date().toISOString(),
        shotCount: shots.length,
        players,
        shots,
      }
      await saveMatch(match)
      setState('success')
      onImported?.(match)
      setTimeout(() => { setState('idle'); setLabel('') }, 2000)
    } catch (e) {
      setState('error')
      setError(e.message)
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  const busy = state === 'parsing' || state === 'saving'

  return (
    <div className="w-full max-w-lg">
      <input
        type="text"
        placeholder="Match label (optional)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={busy}
        className="w-full mb-3 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
      />
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !busy && document.getElementById('csv-file-input').click()}
        className="border-2 border-dashed border-gray-600 hover:border-emerald-500 rounded-xl p-10 text-center cursor-pointer transition-colors"
      >
        {state === 'idle' && (
          <>
            <p className="text-gray-300 text-sm">Drop a SwingVision CSV here</p>
            <p className="text-gray-500 text-xs mt-1">or click to browse</p>
          </>
        )}
        {state === 'parsing' && <p className="text-emerald-400 text-sm animate-pulse">Parsing CSV…</p>}
        {state === 'saving'  && <p className="text-emerald-400 text-sm animate-pulse">Saving to database…</p>}
        {state === 'success' && <p className="text-emerald-400 text-sm">Imported successfully!</p>}
        {state === 'error'   && <p className="text-red-400 text-sm">{error}</p>}
      </div>
      <input
        id="csv-file-input"
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
    </div>
  )
}

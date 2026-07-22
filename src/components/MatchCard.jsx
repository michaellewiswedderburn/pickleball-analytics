import { Link } from 'react-router-dom'
import { deleteMatch } from '../utils/storage'

export default function MatchCard({ match, onDeleted }) {
  const date = new Date(match.uploadedAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })

  function handleDelete(e) {
    e.preventDefault()
    if (confirm(`Delete "${match.label}"?`)) {
      deleteMatch(match.id)
      onDeleted?.()
    }
  }

  return (
    <Link
      to={`/match/${match.id}`}
      className="block bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-emerald-600 rounded-xl p-5 transition-colors group"
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-gray-100 font-semibold text-base group-hover:text-emerald-300 transition-colors">
            {match.label}
          </h2>
          <p className="text-gray-400 text-xs mt-0.5">{date}</p>
        </div>
        <button
          onClick={handleDelete}
          className="text-gray-600 hover:text-red-400 text-xs ml-4 transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex gap-4 text-sm text-gray-400">
        <span><span className="text-gray-200">{match.shotCount}</span> shots</span>
        <span><span className="text-gray-200">{match.players?.join(' vs ') || '—'}</span></span>
      </div>
    </Link>
  )
}

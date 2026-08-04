import { useState, useMemo } from 'react'
import PlayerTable from '../components/PlayerTable'
import { fetchEntry, fetchEventPicks } from '../services/fplApi'

function getCurrentGw(events) {
  const current = events.find(e => e.is_current)
  if (current) return current.id
  const previous = events.find(e => e.is_previous)
  if (previous) return previous.id
  const finished = events.filter(e => e.finished).sort((a, b) => b.id - a.id)
  return finished[0]?.id ?? null
}

function PlayerCard({ pick, playerMap }) {
  const player = playerMap[pick.element]
  if (!player) return null
  const price = (player.now_cost / 10).toFixed(1)

  return (
    <div className="relative flex flex-col items-center">
      {pick.is_captain && (
        <span className="absolute -top-2 -right-2 z-10 bg-yellow-400 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          C
        </span>
      )}
      {pick.is_vice_captain && (
        <span className="absolute -top-2 -right-2 z-10 bg-gray-300 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow">
          V
        </span>
      )}
      <div className="bg-white rounded-lg px-3 py-2 shadow text-center min-w-[72px]">
        <p className="text-xs font-bold leading-tight truncate max-w-[72px]">{player.web_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">£{price}m</p>
      </div>
    </div>
  )
}

function LineupView({ picks, bootstrap }) {
  const playerMap = useMemo(
    () => Object.fromEntries(bootstrap.elements.map(e => [e.id, e])),
    [bootstrap.elements]
  )

  const starters = picks.filter(p => p.position <= 11)
  const bench = picks.filter(p => p.position > 11).sort((a, b) => a.position - b.position)

  const rows = [
    starters.filter(p => playerMap[p.element]?.element_type === 4),
    starters.filter(p => playerMap[p.element]?.element_type === 3),
    starters.filter(p => playerMap[p.element]?.element_type === 2),
    starters.filter(p => playerMap[p.element]?.element_type === 1),
  ].filter(row => row.length > 0)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Pitch */}
      <div className="bg-green-700 rounded-t-xl px-6 pt-6 pb-4 relative overflow-hidden">
        {/* Pitch markings */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-white/20" />
        <div className="absolute inset-x-12 top-0 h-16 border-b border-x border-white/20 rounded-b-xl" />
        <div className="absolute inset-x-12 bottom-0 h-16 border-t border-x border-white/20 rounded-t-xl" />

        <div className="relative flex flex-col gap-8 py-2">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-center gap-4 flex-wrap">
              {row.map(p => (
                <PlayerCard key={p.element} pick={p} playerMap={playerMap} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Bench */}
      <div className="bg-gray-100 rounded-b-xl px-6 py-4 border border-t-0 border-gray-200">
        <p className="text-xs text-gray-400 text-center uppercase tracking-wider mb-4">Bench</p>
        <div className="flex justify-center gap-4 flex-wrap">
          {bench.map(p => (
            <PlayerCard key={p.element} pick={p} playerMap={playerMap} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function MyTeam({ bootstrap, fixtures }) {
  const [teamIdInput, setTeamIdInput] = useState('')
  const [managerData, setManagerData] = useState(null)
  const [picks, setPicks] = useState(null)
  const [view, setView] = useState('lineup')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const currentGw = useMemo(() => getCurrentGw(bootstrap.events), [bootstrap.events])

  async function handleSubmit(e) {
    e.preventDefault()
    const id = teamIdInput.trim()
    if (!id || isNaN(Number(id))) {
      setError('Please enter a valid numeric team ID.')
      return
    }
    if (!currentGw) {
      setError('No gameweek data is available yet — come back once the season has started.')
      return
    }

    setLoading(true)
    setError(null)
    setManagerData(null)
    setPicks(null)

    try {
      const [entry, picksData] = await Promise.all([
        fetchEntry(id),
        fetchEventPicks(id, currentGw),
      ])
      setManagerData(entry)
      setPicks(picksData.picks)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const teamBootstrap = useMemo(() => {
    if (!picks) return null
    const teamIds = new Set(picks.map(p => p.element))
    return { ...bootstrap, elements: bootstrap.elements.filter(p => teamIds.has(p.id)) }
  }, [picks, bootstrap])

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Team ID form */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Enter your FPL team ID..."
          value={teamIdInput}
          onChange={e => setTeamIdInput(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 min-w-[220px]"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-1.5 text-sm font-medium bg-purple-700 text-white rounded hover:bg-purple-800 disabled:opacity-60 transition-colors"
        >
          {loading ? 'Loading...' : 'Load Team'}
        </button>
      </form>

      <p className="text-xs text-gray-400 -mt-4 mb-6">
        Find your team ID in the URL when viewing your team on the FPL website:
        fantasy.premierleague.com/entry/<strong>XXXXXX</strong>/
      </p>

      {error && (
        <p className="text-red-500 text-sm mb-4">{error}</p>
      )}

      {managerData && picks && (
        <>
          {/* Manager info */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">{managerData.name}</h2>
            <p className="text-sm text-gray-500">
              {managerData.player_first_name} {managerData.player_last_name}
              {currentGw && ` · Gameweek ${currentGw}`}
            </p>
          </div>

          {/* View toggle */}
          <div className="flex gap-1 mb-6">
            <button
              onClick={() => setView('lineup')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                view === 'lineup'
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Lineup View
            </button>
            <button
              onClick={() => setView('table')}
              className={`px-4 py-1.5 text-sm font-medium rounded transition-colors ${
                view === 'table'
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Table View
            </button>
          </div>

          {view === 'lineup' && (
            <LineupView picks={picks} bootstrap={bootstrap} />
          )}

          {view === 'table' && (
            <PlayerTable bootstrap={teamBootstrap} fixtures={fixtures} />
          )}
        </>
      )}
    </div>
  )
}

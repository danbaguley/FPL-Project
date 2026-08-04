import { useState, useMemo, useCallback } from 'react'

const POSITION_LABELS = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' }

const POSITION_FILTERS = [
  { label: 'All', value: 0 },
  { label: 'GK', value: 1 },
  { label: 'DEF', value: 2 },
  { label: 'MID', value: 3 },
  { label: 'FWD', value: 4 },
]

const FDR_STYLES = {
  1: { backgroundColor: '#375523', color: '#fff' },
  2: { backgroundColor: '#01fc7a', color: '#000' },
  3: { backgroundColor: '#c0c0c0', color: '#000' },
  4: { backgroundColor: '#f0546e', color: '#fff' },
  5: { backgroundColor: '#80072d', color: '#fff' },
}

function getAvailabilityStyle(player) {
  const { status, chance_of_playing_next_round: chance } = player
  if (status === 'u' || chance === 0) return { bg: '#fef2f2', border: '#ef4444' }
  if (chance === 25) return { bg: '#fff7ed', border: '#f97316' }
  if (chance === 50 || chance === 75) return { bg: '#fefce8', border: '#eab308' }
  return null
}

function computeLast5Stats(history) {
  if (!history || history.length === 0) return null
  const last5 = history.slice(-5)
  const sum = (field, parse = false) =>
    last5.reduce((s, h) => s + (parse ? parseFloat(h[field] || 0) : (h[field] || 0)), 0)
  const minutes = sum('minutes')
  return {
    starts: last5.reduce((s, h) => s + (h.starts ?? (h.minutes >= 45 ? 1 : 0)), 0),
    minutes,
    total_points: sum('total_points'),
    goals_scored: sum('goals_scored'),
    assists: sum('assists'),
    clean_sheets: sum('clean_sheets'),
    expected_goals: sum('expected_goals', true),
    expected_assists: sum('expected_assists', true),
    expected_goal_involvements: sum('expected_goal_involvements', true),
    defensive_contribution: sum('defensive_contribution'),
  }
}

function fmtStat(value, minutes, per90) {
  const num = parseFloat(value)
  if (isNaN(num)) return '-'
  if (!per90) return Number.isInteger(num) ? String(num) : num.toFixed(2)
  if (!minutes) return '-'
  return (num / (minutes / 90)).toFixed(2)
}

function SortArrow({ sortCol, col, sortDir }) {
  if (sortCol !== col) return <span className="ml-0.5 text-gray-400 text-xs">↕</span>
  return <span className="ml-0.5 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

export default function PlayerTable({ bootstrap, fixtures }) {
  const [search, setSearch] = useState('')
  const [posFilter, setPosFilter] = useState(0)
  const [sortCol, setSortCol] = useState('total_points')
  const [sortDir, setSortDir] = useState('desc')
  const [per90, setPer90] = useState(false)
  const [formMode, setFormMode] = useState(false)
  const [playerHistories, setPlayerHistories] = useState({})
  const [loadingForm, setLoadingForm] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [formError, setFormError] = useState(null)

  const teamMap = useMemo(
    () => Object.fromEntries(bootstrap.teams.map(t => [t.id, t])),
    [bootstrap.teams]
  )

  const fixturesByTeam = useMemo(() => {
    const upcoming = fixtures.filter(f => !f.finished)
    const map = {}
    for (const f of upcoming) {
      if (!map[f.team_h]) map[f.team_h] = []
      if (!map[f.team_a]) map[f.team_a] = []
      map[f.team_h].push({ opponent: f.team_a, difficulty: f.team_h_difficulty, home: true, gw: f.event })
      map[f.team_a].push({ opponent: f.team_h, difficulty: f.team_a_difficulty, home: false, gw: f.event })
    }
    for (const id of Object.keys(map)) {
      map[id].sort((a, b) => a.gw - b.gw)
    }
    return map
  }, [fixtures])

  const formStats = useMemo(() => {
    const result = {}
    for (const [id, data] of Object.entries(playerHistories)) {
      const stats = computeLast5Stats(data.history)
      if (stats) result[id] = stats
    }
    return result
  }, [playerHistories])

  // Returns the stats to display for a player — form (last 5) or season totals
  function getEffectiveStats(player) {
    if (formMode && formStats[player.id]) return { ...player, ...formStats[player.id] }
    return player
  }

  const players = useMemo(() => {
    let list = bootstrap.elements.filter(p => {
      if (posFilter !== 0 && p.element_type !== posFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const full = `${p.first_name} ${p.second_name} ${p.web_name}`.toLowerCase()
        if (!full.includes(q)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      const ea = getEffectiveStats(a)
      const eb = getEffectiveStats(b)
      let av = ea[sortCol]
      let bv = eb[sortCol]
      if (av != null && !isNaN(parseFloat(av))) av = parseFloat(av)
      if (bv != null && !isNaN(parseFloat(bv))) bv = parseFloat(bv)
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })

    return list
  }, [bootstrap.elements, posFilter, search, sortCol, sortDir, formMode, formStats])

  const toggleFormMode = useCallback(async () => {
    if (formMode) { setFormMode(false); return }
    if (Object.keys(playerHistories).length > 0) { setFormMode(true); return }

    setLoadingForm(true)
    setLoadingProgress(0)
    setFormError(null)
    console.log('Form button clicked — starting fetch for', bootstrap.elements.length, 'players')
    try {
      const ids = bootstrap.elements.map(p => p.id)
      const CHUNK = 50
      const PARALLEL = 5
      const chunks = []
      for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))

      const histories = {}
      for (let i = 0; i < chunks.length; i += PARALLEL) {
        const group = chunks.slice(i, i + PARALLEL)
        await Promise.all(
          group.map(async chunk => {
            const results = await Promise.all(
              chunk.map(id =>
                fetch(`/api/fpl/element-summary/${id}/`)
                  .then(r => r.json())
                  .catch(() => ({ history: [] }))
              )
            )
            chunk.forEach((id, j) => { histories[id] = results[j] })
          })
        )
        setLoadingProgress(prev => Math.min(prev + group.length * CHUNK, ids.length))
      }

      setPlayerHistories(histories)
      setFormMode(true)
      console.log('Form data loaded successfully')
    } catch (err) {
      console.error('Failed to load form data:', err)
      setFormError(`Error: ${err.message}`)
    } finally {
      setLoadingForm(false)
      setLoadingProgress(0)
    }
  }, [formMode, playerHistories, bootstrap.elements])

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  function Th({ col, children, className = '', center = false }) {
    const clickable = !!col
    return (
      <th
        onClick={() => clickable && handleSort(col)}
        className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide whitespace-nowrap select-none ${center ? 'text-center' : 'text-left'} ${clickable ? 'cursor-pointer hover:bg-gray-200' : ''} ${className}`}
      >
        {children}
        {col && <SortArrow sortCol={sortCol} col={col} sortDir={sortDir} />}
      </th>
    )
  }

  return (
    <div className="p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search player..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 min-w-[180px]"
        />
        <div className="flex gap-1">
          {POSITION_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setPosFilter(f.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                posFilter === f.value
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleFormMode}
          disabled={loadingForm}
          className={`px-4 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-60 disabled:cursor-wait ${
            formMode
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {loadingForm
            ? `Loading ${loadingProgress}/${bootstrap.elements.length}...`
            : formMode ? 'Form: last 5' : 'Form'
          }
        </button>
        <button
          onClick={() => setPer90(p => !p)}
          className={`px-4 py-1.5 text-sm font-medium rounded border transition-colors ${
            per90
              ? 'bg-purple-700 text-white border-purple-700'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {per90 ? 'Per 90 mins' : 'Season total'}
        </button>
      </div>

      {formError && (
        <p className="text-red-500 text-sm mb-3">{formError}</p>
      )}
      {formMode && Object.keys(formStats).length === 0 && (
        <p className="text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm mb-3">
          No match history available yet — form stats will appear once the season starts.
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <Th col="web_name" className="sticky left-0 z-20 bg-gray-100 border-r border-gray-200 min-w-[140px]">
                Player
              </Th>
              <Th col="element_type" center>Pos</Th>
              <Th>Team</Th>
              <Th col="now_cost" center>Price</Th>
              <Th col="starts" center>MS</Th>
              <Th col="minutes" center>Min</Th>
              <th className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-center whitespace-nowrap">
                Min/M
              </th>
              <Th col="total_points" center>Pts</Th>
              <Th col="defensive_contribution" center>Defcon</Th>
              <Th col="expected_goal_involvements" center>xGI</Th>
              <Th col="expected_goals" center>xG</Th>
              <Th col="expected_assists" center>xA</Th>
              <Th col="goals_scored" center>G</Th>
              <Th col="assists" center>A</Th>
              <Th col="clean_sheets" center>CS</Th>
              <th
                className="px-2 py-2 text-xs font-semibold uppercase tracking-wide text-center whitespace-nowrap border-l border-gray-200"
                colSpan={6}
              >
                Next 6 Fixtures
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {players.map(player => {
              const stats = getEffectiveStats(player)
              const team = teamMap[player.team]
              const upcomingFix = (fixturesByTeam[player.team] || []).slice(0, 6)
              const isGK = player.element_type === 1
              const minPerMatch = stats.starts > 0 ? Math.round(stats.minutes / stats.starts) : '-'
              const price = (player.now_cost / 10).toFixed(1)
              const avail = getAvailabilityStyle(player)
              const rowStyle = avail
                ? { backgroundColor: avail.bg, borderLeft: `4px solid ${avail.border}` }
                : {}

              return (
                <tr key={player.id} style={rowStyle}>
                  <td
                    className="px-2 py-1.5 font-medium sticky left-0 z-10 border-r border-gray-200 whitespace-nowrap"
                    style={{ backgroundColor: avail?.bg ?? '#fff' }}
                  >
                    {player.web_name}
                    {player.news && (
                      <span className="ml-1 text-xs text-gray-400" title={player.news}>⚑</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 text-center">
                    {POSITION_LABELS[player.element_type]}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500 whitespace-nowrap">{team?.short_name}</td>
                  <td className="px-2 py-1.5 text-center text-gray-600">£{price}m</td>
                  <td className="px-2 py-1.5 text-center">{stats.starts ?? '-'}</td>
                  <td className="px-2 py-1.5 text-center">{stats.minutes}</td>
                  <td className="px-2 py-1.5 text-center">{minPerMatch}</td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.total_points, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {isGK
                      ? <span className="text-gray-300">N/A</span>
                      : fmtStat(stats.defensive_contribution, stats.minutes, per90)
                    }
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.expected_goal_involvements, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.expected_goals, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.expected_assists, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.goals_scored, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.assists, stats.minutes, per90)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {fmtStat(stats.clean_sheets, stats.minutes, per90)}
                  </td>

                  {Array.from({ length: 6 }, (_, i) => {
                    const fix = upcomingFix[i]
                    if (!fix) {
                      return <td key={i} className={`px-0.5 py-1 ${i === 0 ? 'border-l border-gray-200' : ''}`} />
                    }
                    const opp = teamMap[fix.opponent]
                    const fdrStyle = FDR_STYLES[fix.difficulty] ?? FDR_STYLES[3]
                    return (
                      <td key={i} className={`px-0.5 py-1 ${i === 0 ? 'border-l border-gray-200' : ''}`}>
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-xs font-bold whitespace-nowrap"
                          style={fdrStyle}
                        >
                          {opp?.short_name} {fix.home ? 'H' : 'A'}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {players.length} players · MS = Matches Started · Min/M = Minutes per match started
        {formMode && ' · Showing stats for last 5 games'}
      </p>
    </div>
  )
}

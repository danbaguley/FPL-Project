import { useState, useMemo, useCallback } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchPlayersForm } from '../services/fplApi'

const POSITIONS = [
  { label: 'GK', value: 1 },
  { label: 'DEF', value: 2 },
  { label: 'MID', value: 3 },
  { label: 'FWD', value: 4 },
]

const STATS = [
  { key: 'expected_goal_involvements', label: 'xGI' },
  { key: 'defensive_contribution', label: 'Defcon' },
  { key: 'clean_sheets', label: 'Clean Sheets' },
  { key: 'total_points', label: 'Points' },
]

function CustomDot(props) {
  const { cx, cy } = props
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill="#7c3aed"
      fillOpacity={0.65}
      stroke="#5b21b6"
      strokeWidth={1}
    />
  )
}

function CustomTooltip({ active, payload, statLabel, per90 }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded shadow-lg px-3 py-2 text-sm">
      <p className="font-bold text-gray-800">{d.name}</p>
      <p className="text-gray-400 text-xs mb-2">{d.team}</p>
      <p className="text-gray-600">
        Minutes: <span className="font-medium text-gray-800">{d.x}</span>
      </p>
      <p className="text-gray-600">
        {statLabel}{per90 ? ' per 90' : ''}:{' '}
        <span className="font-medium text-gray-800">{d.y.toFixed(2)}</span>
      </p>
    </div>
  )
}

export default function Charts({ bootstrap }) {
  const [posFilter, setPosFilter] = useState(2)
  const [activeStat, setActiveStat] = useState(STATS[0])
  const [per90, setPer90] = useState(false)
  const [formMode, setFormMode] = useState(false)
  const [formStats, setFormStats] = useState({})
  const [loadingForm, setLoadingForm] = useState(false)
  const [formError, setFormError] = useState(null)

  const teamMap = useMemo(
    () => Object.fromEntries(bootstrap.teams.map(t => [t.id, t])),
    [bootstrap.teams]
  )

  function getEffectiveStats(player) {
    if (formMode && formStats[String(player.id)]) {
      return { ...player, ...formStats[String(player.id)] }
    }
    return player
  }

  const toggleFormMode = useCallback(async () => {
    if (formMode) { setFormMode(false); return }
    if (Object.keys(formStats).length > 0) { setFormMode(true); return }

    setLoadingForm(true)
    setFormError(null)
    try {
      const data = await fetchPlayersForm()
      setFormStats(data)
      setFormMode(true)
    } catch (err) {
      setFormError(`Error: ${err.message}`)
    } finally {
      setLoadingForm(false)
    }
  }, [formMode, formStats])

  const isGkDefcon = posFilter === 1 && activeStat.key === 'defensive_contribution'

  const chartData = useMemo(() => {
    return bootstrap.elements
      .filter(p => p.element_type === posFilter)
      .map(p => {
        const s = getEffectiveStats(p)
        const minutes = s.minutes || 0
        const rawVal = isGkDefcon ? 0 : (parseFloat(s[activeStat.key]) || 0)
        const y = per90 && minutes > 0 ? rawVal / (minutes / 90) : rawVal
        return {
          id: p.id,
          name: p.web_name,
          team: teamMap[p.team]?.short_name ?? '',
          x: minutes,
          y,
        }
      })
      .sort((a, b) => b.y - a.y)
      .slice(0, 30)
  }, [bootstrap.elements, posFilter, activeStat, per90, formMode, formStats, teamMap, isGkDefcon])

  const posLabel = POSITIONS.find(p => p.value === posFilter)?.label ?? ''
  const yAxisLabel = `${activeStat.label}${per90 ? ' per 90' : ''}`

  return (
    <div className="p-4 max-w-5xl mx-auto">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {POSITIONS.map(p => (
            <button
              key={p.value}
              onClick={() => setPosFilter(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                posFilter === p.value
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <div className="flex gap-1">
          {STATS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveStat(s)}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                activeStat.key === s.key
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-200" />

        <button
          onClick={toggleFormMode}
          disabled={loadingForm}
          className={`px-4 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-60 disabled:cursor-wait ${
            formMode
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {loadingForm ? 'Loading...' : formMode ? 'Form: last 5' : 'Form'}
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
        <p className="text-red-500 text-sm mb-4">{formError}</p>
      )}
      {isGkDefcon && (
        <p className="text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm mb-4">
          Defcon is not available for goalkeepers.
        </p>
      )}

      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-4">
          Minutes Played vs {yAxisLabel} — Top 30 {posLabel}s
          {formMode && <span className="ml-2 text-green-600">(last 5 games)</span>}
        </h2>
        <ResponsiveContainer width="100%" height={480}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 50, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              type="number"
              dataKey="x"
              name="Minutes"
              tick={{ fontSize: 11, fill: '#6b7280' }}
              label={{
                value: 'Minutes Played',
                position: 'insideBottom',
                offset: -30,
                fontSize: 12,
                fill: '#6b7280',
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name={activeStat.label}
              tick={{ fontSize: 11, fill: '#6b7280' }}
              width={55}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                offset: 15,
                fontSize: 12,
                fill: '#6b7280',
              }}
            />
            <Tooltip
              content={<CustomTooltip statLabel={activeStat.label} per90={per90} />}
              cursor={{ strokeDasharray: '3 3', stroke: '#d1d5db' }}
            />
            <Scatter data={chartData} shape={<CustomDot />} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Showing top 30 {posLabel}s by {yAxisLabel}
        {formMode && ' · Stats from last 5 games'}
      </p>
    </div>
  )
}

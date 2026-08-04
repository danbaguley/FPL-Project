const BASE = '/api/fpl'

export async function fetchBootstrapStatic() {
  const res = await fetch(`${BASE}/bootstrap-static/`)
  if (!res.ok) throw new Error('Failed to fetch FPL data')
  return res.json()
}

export async function fetchFixtures() {
  const res = await fetch(`${BASE}/fixtures/`)
  if (!res.ok) throw new Error('Failed to fetch fixtures')
  return res.json()
}

export async function fetchEntry(teamId) {
  const res = await fetch(`${BASE}/entry/${teamId}/`)
  if (!res.ok) throw new Error('Team not found — check your team ID and try again')
  return res.json()
}

export async function fetchEventPicks(teamId, gw) {
  const res = await fetch(`${BASE}/entry/${teamId}/event/${gw}/picks/`)
  if (!res.ok) throw new Error(`Could not load picks for gameweek ${gw}`)
  return res.json()
}

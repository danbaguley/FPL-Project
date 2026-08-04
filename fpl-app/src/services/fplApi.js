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

import { useState, useEffect } from 'react'
import { fetchBootstrapStatic, fetchFixtures } from '../services/fplApi'

export function useFplData() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([fetchBootstrapStatic(), fetchFixtures()])
      .then(([bootstrap, fixtures]) => setData({ bootstrap, fixtures }))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

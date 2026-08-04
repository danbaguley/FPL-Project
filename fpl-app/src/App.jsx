import { useFplData } from './hooks/useFplData'
import PlayerTable from './components/PlayerTable'

export default function App() {
  const { data, loading, error } = useFplData()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500 text-sm">
        Loading FPL data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500 text-sm">
        Error: {error}
      </div>
    )
  }

  const seasonStarted = data.bootstrap.events.some(e => e.finished)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-800 text-white px-4 py-3 shadow">
        <h1 className="text-lg font-bold tracking-tight">FPL Analytics</h1>
      </header>
      {!seasonStarted && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
          The new season has not started yet — stats shown are from the previous season.
        </div>
      )}
      <main>
        <PlayerTable bootstrap={data.bootstrap} fixtures={data.fixtures} />
      </main>
    </div>
  )
}

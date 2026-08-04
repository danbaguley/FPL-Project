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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-800 text-white px-4 py-3 shadow">
        <h1 className="text-lg font-bold tracking-tight">FPL Analytics</h1>
      </header>
      <main>
        <PlayerTable bootstrap={data.bootstrap} fixtures={data.fixtures} />
      </main>
    </div>
  )
}

import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { useFplData } from './hooks/useFplData'
import Players from './pages/Players'
import MyTeam from './pages/MyTeam'

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
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-purple-800 text-white px-4 py-3 shadow">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold tracking-tight">FPL Analytics</h1>
            <nav className="flex gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
                  }`
                }
              >
                Players
              </NavLink>
              <NavLink
                to="/my-team"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
                  }`
                }
              >
                My Team
              </NavLink>
            </nav>
          </div>
        </header>

        {!seasonStarted && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 text-sm text-blue-700">
            The new season has not started yet — stats shown are from the previous season.
          </div>
        )}

        <main>
          <Routes>
            <Route
              path="/"
              element={<Players bootstrap={data.bootstrap} fixtures={data.fixtures} />}
            />
            <Route
              path="/my-team"
              element={<MyTeam bootstrap={data.bootstrap} fixtures={data.fixtures} />}
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

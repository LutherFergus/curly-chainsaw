import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Viewer } from './components/Viewer'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="workspace">
        <Toolbar />
        <Viewer />
      </main>
    </div>
  )
}

export default App

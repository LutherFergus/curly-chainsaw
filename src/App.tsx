import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Viewer } from './components/Viewer'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Viewer />
      <Sidebar />
      <Toolbar />
    </div>
  )
}

export default App

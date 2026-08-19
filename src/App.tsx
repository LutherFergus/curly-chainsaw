import { Sidebar } from './components/Sidebar'
import { Toolbar } from './components/Toolbar'
import { Viewer } from './components/Viewer'
import { ViewCube } from './components/ViewCube'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Viewer />
      <Sidebar />
      <Toolbar />
      <ViewCube />
    </div>
  )
}

export default App

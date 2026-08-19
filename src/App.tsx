import { Sidebar } from './components/Sidebar'
import { BuildMenu } from './components/BuildMenu'
import { Viewer } from './components/Viewer'
import { ViewCube } from './components/ViewCube'
import './App.css'

function App() {
  return (
    <div className="app-shell">
      <Viewer />
      <Sidebar />
      <BuildMenu />
      <ViewCube />
    </div>
  )
}

export default App

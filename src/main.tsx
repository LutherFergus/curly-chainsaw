import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useBuilderStore } from './store/builderStore'

if (import.meta.env.DEV) {
  ;(window as unknown as { __knexStore?: typeof useBuilderStore }).__knexStore = useBuilderStore
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

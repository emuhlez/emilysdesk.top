import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

if (import.meta.env.DEV) {
  void import('./store/dockingStore').then(({ useDockingStore }) => {
    ;(window as Window & { __dockDev?: typeof useDockingStore }).__dockDev = useDockingStore
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)






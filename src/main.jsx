import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function showError(msg) {
  document.getElementById('root').innerHTML = `
    <div style="min-height:100vh;background:#030712;display:flex;align-items:center;justify-content:center;padding:2rem">
      <div style="text-align:center;max-width:40rem">
        <p style="color:#f87171;font-weight:600;margin-bottom:.5rem">App failed to start</p>
        <p style="color:#9ca3af;font-size:.875rem;font-family:monospace;background:#111827;border-radius:.5rem;padding:1rem;text-align:left;word-break:break-all">${msg}</p>
      </div>
    </div>`
}

let App
try {
  App = (await import('./App.jsx')).default
} catch (err) {
  showError(err.message)
  throw err
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

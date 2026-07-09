import ReactDOM from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: '#1a1a1a',
      color: 'white',
      padding: '40px',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: '#e67e22', marginBottom: '20px' }}>Component Gallery</h1>
      <p>Testing basic rendering...</p>
      <button 
        style={{
          padding: '10px 20px',
          background: '#e67e22',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer',
          marginTop: '20px'
        }}
        onClick={() => alert('Button clicked!')}
      >
        Click me!
      </button>
    </div>
  )
}

const rootElement = document.getElementById('root')
console.log('Root element:', rootElement)

if (rootElement) {
  console.log('Rendering app...')
  ReactDOM.createRoot(rootElement).render(<App />)
  console.log('App rendered!')
} else {
  console.error('Root element not found!')
  document.body.innerHTML = '<h1 style="color: red; padding: 20px;">ERROR: Root element not found!</h1>'
}

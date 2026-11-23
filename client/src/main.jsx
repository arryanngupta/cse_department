import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './App.jsx'

// No HelmetProvider: react-helmet-async is incompatible with React 19 and was
// emitting nothing. The head is managed by lib/head.js, which needs no
// provider. See the comment at the top of that file.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)

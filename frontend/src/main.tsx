import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider><ToastProvider><App /></ToastProvider></ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

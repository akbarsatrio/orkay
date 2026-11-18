import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AuthGate from './AuthGate.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { BalanceVisibilityProvider } from './context/BalanceVisibilityContext.jsx'
import { ConfirmProvider } from './context/ConfirmContext.jsx'
import { UiVersionProvider } from './context/UiVersionContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <UiVersionProvider>
        <ThemeProvider>
          <BalanceVisibilityProvider>
            <ConfirmProvider>
              <AuthGate />
            </ConfirmProvider>
          </BalanceVisibilityProvider>
        </ThemeProvider>
      </UiVersionProvider>
    </BrowserRouter>
  </React.StrictMode>
)

import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DEFAULT_THEME } from './assets/themes.ts'
import { setTheme } from './lib/theme.ts'

// Los tokens de color se aplican ANTES del primer render: las hojas de estilo no
// llevan ningún color propio. El tema guardado del usuario lo carga App al leer
// settings.json; esto solo evita una primera pintada sin variables.
setTheme(DEFAULT_THEME)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

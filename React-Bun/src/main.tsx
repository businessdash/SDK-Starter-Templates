import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// SDK form styles: file-upload box, multi-step progress header, and
// availability/choice chips rendered by <BiabForm>. The container background
// is intentionally omitted by the SDK — this template owns it via index.css.
import '@businessdash/sdk/biab-forms.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

console.log('🚀 Iniciando React App en main.jsx...');

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('❌ No se encontró el elemento #root en el DOM');
  } else {
    console.log('✅ Elemento #root encontrado, renderizando...');
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    console.log('✨ Render inicial enviado');
  }
} catch (error) {
  console.error('💥 Error fatal durante el renderizado inicial:', error);
}

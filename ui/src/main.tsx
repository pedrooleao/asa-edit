import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans-condensed/400.css';
import '@fontsource/ibm-plex-sans-condensed/500.css';
import '@fontsource/ibm-plex-sans-condensed/600.css';
import './estilo.css';
import { carregarEsquema, conectarServidor } from './store';
import { App } from './App';

carregarEsquema();
conectarServidor();
createRoot(document.getElementById('raiz')!).render(<App />);

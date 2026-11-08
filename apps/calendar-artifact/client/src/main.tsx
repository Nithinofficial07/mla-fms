import React from 'react';
import ReactDOM from 'react-dom/client';
import { SnackbarProvider } from 'notistack';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import { ThemeModeProvider } from '@/app/ThemeModeProvider';
import { CalendarStoreProvider } from '@/data/CalendarStore';
import { App } from '@/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} autoHideDuration={4000}>
        <CalendarStoreProvider>
          <App />
        </CalendarStoreProvider>
      </SnackbarProvider>
    </ThemeModeProvider>
  </React.StrictMode>,
);

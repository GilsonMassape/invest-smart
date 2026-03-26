import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { AuthGate } from './app/AuthGate';
import './styles/globals.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found.');
}

ReactDOM.createRoot(rootElement).render(
  <React.Fragment>
    <AuthGate>
      <App />
    </AuthGate>
  </React.Fragment>,
);
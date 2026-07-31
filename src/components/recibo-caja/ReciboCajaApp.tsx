import React from 'react';
import ReactDOM from 'react-dom/client';
import ReciboCajaComponent from './ReciboCajaComponent';
import '../../index.css';

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <ReciboCajaComponent />
    </React.StrictMode>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(<App />);
}

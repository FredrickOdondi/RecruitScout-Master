import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../dashboard/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-50 p-6">
      <App />
    </div>
  </React.StrictMode>
);

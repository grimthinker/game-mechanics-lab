import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';
import { DragDropProvider } from './dnd/DragDropContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DragDropProvider>
      <App />
    </DragDropProvider>
  </React.StrictMode>
);

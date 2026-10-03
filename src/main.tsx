import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.css';
import './fonts.css';
import { DragDropProvider } from './dnd/DragDropContext';
import { SettingsManager } from './config/SettingsManager';

// Инициализируем настройки из localStorage до монтирования движка и UI
SettingsManager.load();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DragDropProvider>
      <App />
    </DragDropProvider>
  </React.StrictMode>
);

import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/responsive.css';
import './styles/rtl.css';

// Hash-based URLs keep route resolution in the browser, which is reliable on
// static hosts such as Vercel even when a route is opened or refreshed directly.
createRoot(document.getElementById('root')).render(<React.StrictMode><HashRouter><App /></HashRouter></React.StrictMode>);

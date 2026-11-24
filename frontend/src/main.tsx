import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import './styles/index.css';
import './styles/taxonomy.css';

const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false }, mutations: { retry: 0 } } });
    createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={client}><BrowserRouter><App /><a className="dev-floater" href="https://ashwanisingh-portfolio.netlify.app" target="_blank" aria-label="Open developer portfolio">&lt;/Dev&gt;</a></BrowserRouter></QueryClientProvider></StrictMode>);

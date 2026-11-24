import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../app/App';
describe('safe startup', () => {
  it('shows the password-based project landing page', () => {
    render(<QueryClientProvider client={new QueryClient()}><BrowserRouter><App /></BrowserRouter></QueryClientProvider>);
    expect(screen.getByText('Effort Tracker')).toBeInTheDocument();
  });
});

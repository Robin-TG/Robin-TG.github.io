import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./router.js', () => ({
  initRouter: vi.fn(() => Promise.resolve({})),
  classify: vi.fn(() => Promise.resolve('[LLM_QUESTION] "mocked"')),
  setRouterProgressHandler: vi.fn(),
  percentFromRouterProgress: vi.fn(() => null),
}));

import App from './App.jsx';
import * as router from './router.js';

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(router.classify).mockResolvedValue('[LLM_QUESTION] "mocked"');
    vi.mocked(router.initRouter).mockResolvedValue({});
  });

  it('shows title after router finishes loading', async () => {
    render(<App />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: /green sieve/i })).toBeInTheDocument();
  });

  it('sends a message and shows classifier output', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const input = screen.getByPlaceholderText(/type your message/i);
    await user.type(input, 'hello world');
    await user.click(screen.getByRole('button', { name: /^send$/i }));

    await waitFor(() => {
      expect(router.classify).toHaveBeenCalledWith('hello world');
    });
    expect(screen.getByText('hello world')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('[LLM_QUESTION] "mocked"')).toBeInTheDocument();
    });
  });

  it('toggles conversations panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(screen.queryByLabelText(/^conversations$/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /conversations/i }));
    expect(screen.getByLabelText(/^conversations$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /conversations/i }));
    expect(screen.queryByLabelText(/^conversations$/i)).not.toBeInTheDocument();
  });

  it('toggles settings modal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
    await user.click(screen.getByTitle('Settings'));
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it('shows default silence timeout value', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await user.click(screen.getByTitle('Settings'));
    const input = screen.getByLabelText(/speech silence timeout/i);
    expect(input).toHaveValue(2500);
  });

  it('uses persisted silence timeout value', async () => {
    localStorage.setItem('sieveSilenceTimeoutMs', '3000');
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getByTitle('Settings')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(localStorage.getItem('sieveSilenceTimeoutMs')).toBe('3000');
    });
  });

  it('closes settings modal when clicking overlay', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await user.click(screen.getByTitle('Settings'));
    expect(screen.getByRole('heading', { name: /^settings$/i })).toBeInTheDocument();
    await user.click(screen.getByRole('heading', { name: /^settings$/i }).closest('.modal-overlay'));
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
  });
});

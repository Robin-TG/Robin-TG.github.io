import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./router.ts', () => ({
  initRouter: vi.fn(() => Promise.resolve({})),
  classify: vi.fn(() => Promise.resolve('[LLM_QUESTION] "mocked"')),
  setRouterProgressHandler: vi.fn(),
  percentFromRouterProgress: vi.fn(() => null),
}));

import App from './App.tsx';
import * as router from './router.ts';

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
    expect(screen.getAllByRole('heading', { name: /green sieve/i })[0]).toBeInTheDocument();
  });

  it('sends a message and shows classifier output', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    const input = screen.getAllByPlaceholderText(/type your message/i)[0];
    await user.type(input, 'hello world');
    await user.click(screen.getAllByRole('button', { name: /^send$/i })[0]);

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
    await user.click(screen.getAllByRole('button', { name: /conversations/i })[0]);
    expect(screen.getByLabelText(/^conversations$/i)).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /conversations/i })[0]);
    expect(screen.queryByLabelText(/^conversations$/i)).not.toBeInTheDocument();
  });

  it('toggles settings modal', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
    await user.click(screen.getAllByTitle('Settings')[0]);
    expect(screen.getAllByRole('heading', { name: /^settings$/i })[0]).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /^close$/i })[0]);
    expect(screen.queryByRole('heading', { name: /^settings$/i })).not.toBeInTheDocument();
  });

  it('shows default silence timeout value', async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await user.click(screen.getAllByTitle('Settings')[0]);
    const input = screen.getByLabelText(/speech silence timeout/i);
    expect(input).toHaveValue(2500);
  });

  it('uses persisted silence timeout value', async () => {
    localStorage.setItem('sieveSilenceTimeoutMs', '3000');
    render(<App />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());

    await waitFor(() => {
      expect(screen.getAllByTitle('Settings')[0]).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(localStorage.getItem('sieveSilenceTimeoutMs')).toBe('3000');
    });
  });
});

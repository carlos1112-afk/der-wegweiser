// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchInput } from './SearchInput';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => [],
  });
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

it('ruft Nominatim nicht auf bei ungültigem Suchbegriff', async () => {
  const onSelect = vi.fn();
  render(<SearchInput onSelect={onSelect} />);
  const input = screen.getByPlaceholderText(/Ziel eingeben/);
  fireEvent.change(input, { target: { value: 'foo\x01bar' } });
  await new Promise((r) => setTimeout(r, 600));
  expect(mockFetch).not.toHaveBeenCalled();
  screen.getByText(/unzulässige Steuerzeichen/);
});

it('leistet eine Anfrage bei gültigem Suchbegriff', async () => {
  const onSelect = vi.fn();
  render(<SearchInput onSelect={onSelect} />);
  const input = screen.getByPlaceholderText(/Ziel eingeben/);
  fireEvent.change(input, { target: { value: 'Berlin' } });
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  const url = mockFetch.mock.calls[0][0] as string;
  expect(url).toContain('nominatim.openstreetmap.org');
  expect(url).toContain('q=Berlin');
});

it('ignoriert leeren Suchbegriff ohne Anfrage', async () => {
  const onSelect = vi.fn();
  render(<SearchInput onSelect={onSelect} />);
  const input = screen.getByPlaceholderText(/Ziel eingeben/);
  fireEvent.change(input, { target: { value: 'Berlin' } });
  await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  mockFetch.mockClear();
  fireEvent.change(input, { target: { value: '' } });
  await new Promise((r) => setTimeout(r, 600));
  expect(mockFetch).not.toHaveBeenCalled();
});

it('fokussiert das Suchfeld, wenn die Routenplanung es anfordert', () => {
  const onSelect = vi.fn();
  render(<SearchInput onSelect={onSelect} focusRequest={1} />);
  expect(document.activeElement).toBe(screen.getByPlaceholderText(/Ziel eingeben/));
});

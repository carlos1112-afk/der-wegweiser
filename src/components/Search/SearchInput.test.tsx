// @vitest-environment jsdom
import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { SearchInput } from './SearchInput';
import { PlaceSearchService } from '../../services/placeSearchService';
vi.mock('../../services/placeSearchService', () => ({ PlaceSearchService: { search: vi.fn() } }));
const search = vi.mocked(PlaceSearchService.search);
beforeEach(() => { cleanup(); search.mockReset(); search.mockResolvedValue([]); });
const type = (value: string) => fireEvent.change(screen.getByLabelText('Zielsuche'), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Ziel suchen' }));
it('sucht erst nach bewusstem Absenden und übernimmt die Auswahl ohne Folgeanfrage', async () => {
  const onSelect = vi.fn(); search.mockResolvedValue([{ id: 'osm:node:1', lat: 52.5, lng: 13.4, label: 'Berlin, Deutschland' }]);
  render(<SearchInput onSelect={onSelect} />); type('Berlin'); expect(search).not.toHaveBeenCalled(); submit();
  fireEvent.click(await screen.findByRole('button', { name: 'Berlin, Deutschland' }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ lat: 52.5, lng: 13.4 })); expect(search).toHaveBeenCalledTimes(1);
});
it('weist Steuerzeichen und leere Eingaben vor der Anfrage zurück', async () => {
  render(<SearchInput onSelect={vi.fn()} />); type('foo\x01bar'); submit();
  expect(await screen.findByText(/unzulässige Steuerzeichen/)).toBeTruthy(); expect(search).not.toHaveBeenCalled();
  type(''); submit(); expect(search).not.toHaveBeenCalled();
});
it('verwirft alte Antworten auch wenn der Transport Abort ignoriert', async () => {
  let resolve: (value: any) => void = () => {}; search.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  render(<SearchInput onSelect={vi.fn()} />); type('Berlin'); submit();
  const firstSignal = search.mock.calls[0][1]; type('Potsdam'); submit();
  await screen.findByText('Keine Ergebnisse gefunden.');
  await act(async () => { resolve([{ id: 'old', lat: 52.5, lng: 13.4, label: 'Altes Ergebnis' }]); });
  expect(firstSignal.aborted).toBe(true); expect(screen.queryByText('Altes Ergebnis')).toBeNull();
});
it('Löschen und Unmount brechen laufende Suche ab', async () => {
  search.mockImplementation(() => new Promise(() => {})); const view = render(<SearchInput onSelect={vi.fn()} />);
  type('Berlin'); submit(); fireEvent.click(screen.getByLabelText('Eingabe löschen'));
  expect(search.mock.calls[0][1].aborted).toBe(true);
  type('Potsdam'); submit(); view.unmount(); expect(search.mock.calls[1][1].aborted).toBe(true);
});
it('zeigt einen sichtbaren Fehler und fokussiert auf Anforderung', async () => {
  search.mockRejectedValue(new Error('offline')); render(<SearchInput onSelect={vi.fn()} focusRequest={1} />);
  expect(document.activeElement).toBe(screen.getByLabelText('Zielsuche')); type('Berlin'); submit();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('derzeit nicht verfügbar'));
});

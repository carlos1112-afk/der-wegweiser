// @vitest-environment jsdom
import { createElement } from 'react';
import { it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AnticipationModal } from '../../src/components/AiAssistant/AnticipationModal';
import type { Route } from '../../src/types/navigation';
it('does not start guidance from serialized validation flags and shows unknown metrics honestly', () => {
  const onAcceptRoute = vi.fn(), onClose = vi.fn();
  const route = { title: 'Gespeicherter Track', aiStory: 'Spur', distanceKm: 2, elevationGainM: null,
    validatedRoute: { validationVersion: 1, guidanceCapability: 'turn_by_turn' } } as Route;
  render(createElement(AnticipationModal, { route, onAcceptRoute, onClose, onRegenerate: vi.fn() }));
  expect((screen.getByRole('button', { name: 'Track übernehmen' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('Unbekannt')).toBeTruthy();
  expect(screen.getByText('Alte oder importierte Spur · ungeprüft')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Track übernehmen' })); expect(onAcceptRoute).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Schließen' }));
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' }); expect(onClose).toHaveBeenCalledTimes(1);
  cleanup();
});

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LoungeModal } from './LoungeModal';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/soundFxService', () => ({
  SoundFxService: {
    playClick: vi.fn(),
    playSuccessChime: vi.fn(),
    playWarningTone: vi.fn(),
    playTurnChime: vi.fn(),
  },
}));

vi.mock('../../services/spatialTelemetrySanitizerService', () => ({
  SpatialTelemetrySanitizerService: {
    sanitizeAndMergeTrack: vi.fn(),
  },
}));

vi.mock('../../services/surveyWallService', () => ({
  SurveyWallService: {
    getAvailableSurveys: vi.fn(() => []),
    getOfferwallUrl: vi.fn(() => Promise.resolve('')),
  },
}));

vi.mock('../../services/userIdentity', () => ({
  UserIdentity: {
    getUserId: vi.fn(() => 'test-user'),
  },
}));

vi.mock('../../services/consentService', () => ({
  ConsentService: {
    allowsSurveys: true,
  },
}));

vi.mock('./PartnerModal', () => ({
  PartnerModal: () => <div data-testid="partner-modal">PartnerModal</div>,
}));

vi.mock('../../services/adService', () => ({
  SPONSOR_ADS: [{ id: 'test-ad', rewardTokens: 20, sponsorName: 'Test', headline: 'Test Ad', tagline: 'A Test Ad', url: '#', buttonText: 'Click Here' }],
}));

vi.mock('../../firebase', () => ({
  functions: {} as any,
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn((_functions: unknown, name: string) => vi.fn(async () => ({
    data: name === 'getTokenQuizChallenge'
      ? { challengeId: 'challenge-1', questionId: 'test-question', question: 'Test?', options: [{ label: 'A', text: 'Answer' }], explanation: 'Because', rewardTokens: 6, completed: false }
      : name === 'submitTokenQuizAnswer'
        ? { correct: true, balance: 56, correctAnswerLabel: 'A', explanation: 'Because', rewardTokens: 6 }
        : { success: true, code: 'server-issued-test-code' },
  }))),
}));

describe('LoungeModal - Redemption Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  const renderModalAndGoToShop = (tokenBalance: number, onTokenBalanceRefresh = vi.fn().mockResolvedValue(undefined)) => {
    render(<LoungeModal tokenBalance={tokenBalance} onTokenBalanceRefresh={onTokenBalanceRefresh} onClose={vi.fn()} />);

    const shopTab = screen.getByText(/Shop/i);
    fireEvent.click(shopTab);
  };

  it('prevents redemption when balance is insufficient', () => {
    renderModalAndGoToShop(10);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();
    expect(redeemButton.disabled).toBe(true);

    fireEvent.click(redeemButton);
  });

  it('allows redemption when balance is sufficient', async () => {
    const onTokenBalanceRefresh = vi.fn().mockResolvedValue(undefined);
    renderModalAndGoToShop(50, onTokenBalanceRefresh);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();
    expect(redeemButton.disabled).toBe(false);

    await fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(onTokenBalanceRefresh).toHaveBeenCalled();
    });
  });

  it('prevents double-redemption by displaying the code after first redemption', async () => {
    renderModalAndGoToShop(100);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    let redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();

    await fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByText('server-issued-test-code')).toBeTruthy();
    });

    const codeContainer = await screen.findByText('server-issued-test-code');
    expect(codeContainer).toBeTruthy();
  });

  it('awards quiz tokens only after the server verifies the answer', async () => {
    const onTokenBalanceRefresh = vi.fn().mockResolvedValue(undefined);
    render(<LoungeModal tokenBalance={0} onTokenBalanceRefresh={onTokenBalanceRefresh} onClose={vi.fn()} />);
    fireEvent.click(screen.getByText(/Quiz/i));
    const answer = await screen.findByRole('button', { name: /A\) Answer/ });
    fireEvent.click(answer);
    await waitFor(() => expect(onTokenBalanceRefresh).toHaveBeenCalled());
  });
});

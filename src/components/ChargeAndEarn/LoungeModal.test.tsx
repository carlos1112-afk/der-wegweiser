import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  httpsCallable: vi.fn(() => vi.fn(async () => ({
    data: { success: true, code: 'WEGWEISER-KAFFEE-2026' },
  }))),
}));

describe('LoungeModal - Redemption Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModalAndGoToShop = (tokenBalance: number, onAddTokens = vi.fn()) => {
    render(<LoungeModal tokenBalance={tokenBalance} onAddTokens={onAddTokens} onClose={vi.fn()} />);

    const shopTab = screen.getByText(/Shop/i);
    fireEvent.click(shopTab);
  };

  it('prevents redemption when balance is insufficient', () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(10, onAddTokens);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();
    expect(redeemButton.disabled).toBe(true);

    fireEvent.click(redeemButton);
    expect(onAddTokens).not.toHaveBeenCalled();
  });

  it('allows redemption when balance is sufficient', async () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(50, onAddTokens);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();
    expect(redeemButton.disabled).toBe(false);

    await fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(onAddTokens).toHaveBeenCalledWith(-40);
    });
  });

  it('prevents double-redemption by displaying the code after first redemption', async () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(100, onAddTokens);

    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');
    let redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();

    await fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(onAddTokens).toHaveBeenCalledWith(-40);
    });

    const codeContainer = await screen.findByText('WEGWEISER-KAFFEE-2026');
    expect(codeContainer).toBeTruthy();
  });
});

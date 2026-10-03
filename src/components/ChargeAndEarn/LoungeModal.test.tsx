import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoungeModal } from './LoungeModal';

// Mock dependencies
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
    getOfferwallUrl: vi.fn(() => ''),
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

// Mock SPONSOR_ADS
vi.mock('../../services/adService', () => ({
  SPONSOR_ADS: [{ id: 'test-ad', rewardTokens: 20, sponsorName: 'Test', headline: 'Test Ad', tagline: 'A Test Ad', url: '#', buttonText: 'Click Here' }],
}));

describe('LoungeModal - Redemption Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModalAndGoToShop = (tokenBalance: number, onAddTokens = vi.fn()) => {
    render(<LoungeModal tokenBalance={tokenBalance} onAddTokens={onAddTokens} onClose={vi.fn()} />);

    // Click on "Shop" tab
    const shopTab = screen.getByText(/Shop/i);
    fireEvent.click(shopTab);
  };

  it('prevents redemption when balance is insufficient', () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(10, onAddTokens); // 10 tokens, item costs 40 (coffee-pass)

    // Find the item
    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');

    // Find the redeem button
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();

    // Try to click it
    expect(redeemButton.disabled).toBe(true);

    // Even if we force click, it shouldn't deduct tokens since the button is disabled
    fireEvent.click(redeemButton);
    expect(onAddTokens).not.toHaveBeenCalled();

    // It should play a warning tone (but actually handleRedeemItem checks the balance and plays a warning tone if we bypassed disabled somehow,
    // but the button itself is disabled so the event might not fire depending on how testing-library handles it. Let's make sure it handles it if clicked)
  });

  it('allows redemption when balance is sufficient', () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(50, onAddTokens); // 50 tokens, item costs 40 (coffee-pass)

    // Find the item
    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');

    // Find the redeem button
    const redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();
    expect(redeemButton.disabled).toBe(false);

    // Click it
    fireEvent.click(redeemButton);

    // Should deduct cost
    expect(onAddTokens).toHaveBeenCalledWith(-40);
  });

  it('prevents double-redemption by displaying the code after first redemption', () => {
    const onAddTokens = vi.fn();
    renderModalAndGoToShop(100, onAddTokens); // 100 tokens, plenty to buy

    // Find the item
    const itemTitle = screen.getByText('1x Bio-Kaffee im Bike-Café');
    const itemContainer = itemTitle.closest('.glass-panel');

    // Find the redeem button
    let redeemButton = itemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).not.toBeNull();

    // First click
    fireEvent.click(redeemButton);
    expect(onAddTokens).toHaveBeenCalledWith(-40);

    // Check that button is gone and code is displayed
    const codeContainer = screen.getByText('WEGWEISER-KAFFEE-2026');
    expect(codeContainer).toBeTruthy();

    // The redeem button should no longer exist for this item
    const currentItemContainer = screen.getByText('1x Bio-Kaffee im Bike-Café').closest('.glass-panel');
    redeemButton = currentItemContainer?.querySelector('button') as HTMLButtonElement;
    expect(redeemButton).toBeNull();
  });
});
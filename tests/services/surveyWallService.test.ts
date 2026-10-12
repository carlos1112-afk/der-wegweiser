import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SurveyWallService } from '../../src/services/surveyWallService';
import { UserIdentity } from '../../src/services/userIdentity';

describe('SurveyWallService', () => {
  beforeEach(() => {

  });

  it('should not include the internal userId in the BitLabs URL', () => {
    const userId = 'internal-firebase-uid-123';
    const url = SurveyWallService.getOfferwallUrl(userId);
    expect(url).not.toContain(userId);
  });

  it('should not include the internal userId in the CPX URL', () => {
    const userId = 'internal-firebase-uid-123';
    const url = SurveyWallService.getCpxOfferwallUrl(userId);
    expect(url).not.toContain(userId);
  });
});

import { HttpsError, onCall } from 'firebase-functions/v2/https';
/** Retain the legacy endpoint name to reject old clients explicitly, without provider spend or stub results. */
export const computeRoute = onCall({ region: 'europe-west3', enforceAppCheck: true }, async request => {
  if (!request.app || !request.auth?.uid) throw new HttpsError('unauthenticated', 'Authentication and App Check required.');
  throw new HttpsError('failed-precondition', 'Legacy routing is closed. Use computeFreeRoute; premium jobs are not released.');
});

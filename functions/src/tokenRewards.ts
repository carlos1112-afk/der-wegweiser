import { deletionLockId, prepareWalletMutation } from './wallet/firestoreLedger';
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore, type Transaction, type Firestore } from "firebase-admin/firestore";
import { randomInt } from "node:crypto";

const QUIZ_REWARD = 6;
const WHEEL_AWARDS = [8, 0, 5, 0, 2, 0, 10, 0] as const;
const REQUEST_LIMIT = 12;
const REQUEST_WINDOW_MS = 60_000;
const QUIZ_QUESTIONS = [
  {
    id: "battery-cadence",
    question: "Wie schont man den E-Bike-Akku am Berg am besten?",
    options: [
      { label: "A", text: "Hohe Trittfrequenz (70-80 RPM) & mittlere Motorstufe" },
      { label: "B", text: "Niedrige Trittfrequenz im höchsten Gang im Turbo-Modus" },
      { label: "C", text: "Gleichmäßiges Bremsen bei gleichzeitigem Vollgas-Treten" },
    ],
    answer: "A",
    explanation: "Eine höhere Trittfrequenz entlastet den Motor und schont die Akkuzellen.",
  },
  {
    id: "battery-temperature",
    question: "Bei welcher Temperatur fühlt sich ein Lithium-Ionen-Akku am wohlsten?",
    options: [
      { label: "A", text: "Bei frostigen Temperaturen unter 0°C" },
      { label: "B", text: "Bei Zimmertemperatur (15°C bis 25°C)" },
      { label: "C", text: "Unter praller Sonne bei über 40°C" },
    ],
    answer: "B",
    explanation: "Extreme Kälte verringert die Kapazität, extreme Hitze schädigt die Akkuzellen.",
  },
  {
    id: "battery-storage",
    question: "Wie lagert man einen E-Bike-Akku optimal über den Winter?",
    options: [
      { label: "A", text: "Komplett leergefahren (0%) im kalten Keller" },
      { label: "B", text: "Vollständig geladen (100%) in der warmen Wohnung" },
      { label: "C", text: "Bei ca. 30% bis 60% Ladestand an einem kühlen, trockenen Ort" },
    ],
    answer: "C",
    explanation: "Ein mittlerer Ladestand an einem kühlen, trockenen Ort schont die Akkuchemie.",
  },
  {
    id: "route-planning",
    question: "Welchen Vorteil bietet eine vorausschauende Routenplanung für E-Bikes?",
    options: [
      { label: "A", text: "Sie spart Akku durch Vermeidung extremer Steigungen" },
      { label: "B", text: "Sie erhöht die Maximalgeschwindigkeit des Motors auf 45 km/h" },
      { label: "C", text: "Sie lädt den Akku durch Solarenergie während der Fahrt auf" },
    ],
    answer: "A",
    explanation: "Geringere Steigungen können den Energieverbrauch und die nötige Unterstützung senken.",
  },
  {
    id: "rolling-resistance",
    question: "Was erhöht die Reichweite deines E-Bikes am effektivsten?",
    options: [
      { label: "A", text: "Fahren mit minimalem Reifendruck" },
      { label: "B", text: "Optimaler Reifendruck und regelmäßiges Ölen der Kette" },
      { label: "C", text: "Tragen von besonders schwerem Gepäck" },
    ],
    answer: "B",
    explanation: "Optimaler Reifendruck verringert den Rollwiderstand und spart Energie.",
  },
] as const;

function requireVerifiedCaller(request: { auth?: { uid: string } | null; app?: unknown }): string {
  if (!request.app) throw new HttpsError("unauthenticated", "Invalid App Check token.");
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "User must be authenticated.");
  return request.auth.uid;
}

async function requireOpenAccount(db: Firestore, transaction: Transaction, uid: string): Promise<void> {
  const deletion = await transaction.get(db.collection('account_deletion_locks').doc(deletionLockId(uid)));
  if (deletion.exists) throw new HttpsError('permission-denied', 'Account deletion is in progress.');
  const control = await transaction.get(db.collection('wallet_control').doc('current'));
  if (control.data()?.state !== 'active' || control.data()?.schemaVersion !== 1) throw new HttpsError('failed-precondition', 'Token mutations are paused for migration.');
}

function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

async function enforceQuizRequestLimit(uid: string, kind: "challenge" | "answer"): Promise<void> {
  const db = getFirestore();
  const ref = db.collection("token_quiz_rate_limits").doc(uid);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    await requireOpenAccount(db, transaction, uid);
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.[kind] as unknown;
    const recent = Array.isArray(current)
      ? current.filter((time: unknown) => typeof time === "number" && Number.isFinite(time) && now - time < REQUEST_WINDOW_MS)
      : [];
    if (recent.length >= REQUEST_LIMIT) throw new HttpsError("resource-exhausted", "Quiz request limit exceeded.");
    transaction.set(ref, { [kind]: [...recent, now] }, { merge: true });
  });
}

export const getTokenQuizChallenge = onCall({ region: "europe-west3", enforceAppCheck: true }, async (request) => {
  const uid = requireVerifiedCaller(request);
  await enforceQuizRequestLimit(uid, "challenge");
  const db = getFirestore();
  const challengeRef = db.collection("token_quiz_challenges").doc(uid);
  const suspendedRef = db.collection("suspended_users").doc(uid);
  const today = utcDay();
  const challenge = await db.runTransaction(async (transaction) => {
    await requireOpenAccount(db, transaction, uid);
    const suspendedSnap = await transaction.get(suspendedRef);
    if (suspendedSnap.exists) throw new HttpsError("permission-denied", "Account is suspended.");
    const existing = await transaction.get(challengeRef);
    const saved = existing.data();
    if (saved?.day === today) return saved;

    const question = QUIZ_QUESTIONS[randomInt(QUIZ_QUESTIONS.length)];
    const next = {
      userId: uid,
      day: today,
      challengeId: `${today}-${randomInt(0x1000000).toString(16)}`,
      questionId: question.id,
      question: question.question,
      options: question.options,
      answer: question.answer,
      explanation: question.explanation,
      attempted: false,
      completed: false,
      createdAt: FieldValue.serverTimestamp(),
    };
    transaction.set(challengeRef, next);
    return next;
  });

  return {
    challengeId: challenge.challengeId,
    questionId: challenge.questionId,
    question: challenge.question,
    options: challenge.options,
    explanation: challenge.explanation,
    rewardTokens: QUIZ_REWARD,
    completed: challenge.attempted === true,
  };
});

export const submitTokenQuizAnswer = onCall({ region: "europe-west3", enforceAppCheck: true }, async (request) => {
  const uid = requireVerifiedCaller(request);
  const { challengeId, answerLabel } = request.data ?? {};
  if (typeof challengeId !== "string" || challengeId.length > 64 || !["A", "B", "C"].includes(answerLabel)) {
    throw new HttpsError("invalid-argument", "Invalid quiz answer.");
  }
  await enforceQuizRequestLimit(uid, "answer");

  const db = getFirestore();
  const challengeRef = db.collection("token_quiz_challenges").doc(uid);
  const suspendedRef = db.collection("suspended_users").doc(uid);
  return db.runTransaction(async (transaction) => {
    await requireOpenAccount(db, transaction, uid);
    const suspendedSnap = await transaction.get(suspendedRef);
    if (suspendedSnap.exists) throw new HttpsError("permission-denied", "Account is suspended.");
    const challengeSnap = await transaction.get(challengeRef);
    if (!challengeSnap.exists) throw new HttpsError("not-found", "Quiz challenge not found.");
    const challenge = challengeSnap.data()!;
    if (challenge.userId !== uid || challenge.day !== utcDay() || challenge.challengeId !== challengeId) {
      throw new HttpsError("failed-precondition", "Quiz challenge is expired or invalid.");
    }
    if (challenge.attempted === true) throw new HttpsError("already-exists", "Today's quiz has already been attempted.");

    const correct = answerLabel === challenge.answer;
    const answerQuestion = QUIZ_QUESTIONS.find((question) => question.id === challenge.questionId);
    if (!answerQuestion) throw new HttpsError("internal", "Quiz challenge configuration is invalid.");

    let balance: number | null = null;
    if (correct) {
      const credit = await prepareWalletMutation(db, transaction, uid, {
        operation: 'credit', amount: QUIZ_REWARD, reference: `quiz_${challenge.challengeId}`,
      });
      balance = credit.wallet.balance;
      credit.commit();
    }

    transaction.update(challengeRef, { attempted: true, completed: correct, answeredAt: FieldValue.serverTimestamp() });
    return {
      correct,
      balance,
      correctAnswerLabel: answerQuestion.answer,
      explanation: answerQuestion.explanation,
      rewardTokens: correct ? QUIZ_REWARD : 0,
    };
  });
});

/** One server-selected wheel outcome per account and UTC day. */
export const getTokenWheelStatus = onCall({ region: "europe-west3", enforceAppCheck: true }, async (request) => {
  const uid = requireVerifiedCaller(request);
  const db = getFirestore();
  const [suspendedSnap, spinSnap, deletionSnap] = await Promise.all([
    db.collection("suspended_users").doc(uid).get(),
    db.collection("token_wheel_spins").doc(uid).get(),
    db.collection("account_deletion_locks").doc(deletionLockId(uid)).get(),
  ]);
  if (suspendedSnap.exists || deletionSnap.exists) throw new HttpsError("permission-denied", "Account is unavailable.");
  return { alreadySpun: spinSnap.data()?.day === utcDay() };
});

export const spinTokenWheel = onCall({ region: "europe-west3", enforceAppCheck: true }, async (request) => {
  const uid = requireVerifiedCaller(request);
  const db = getFirestore();
  const today = utcDay();
  const spinRef = db.collection("token_wheel_spins").doc(uid);
  const suspendedRef = db.collection("suspended_users").doc(uid);

  return db.runTransaction(async (transaction) => {
    await requireOpenAccount(db, transaction, uid);
    const suspendedSnap = await transaction.get(suspendedRef);
    if (suspendedSnap.exists) throw new HttpsError("permission-denied", "Account is suspended.");
    const spinSnap = await transaction.get(spinRef);
    if (spinSnap.data()?.day === today) {
      throw new HttpsError("already-exists", "Today's wheel spin has already been used.");
    }

    const segmentIndex = randomInt(WHEEL_AWARDS.length);
    const rewardTokens = WHEEL_AWARDS[segmentIndex];
    let balance: number | null = null;
    if (rewardTokens > 0) {
      const credit = await prepareWalletMutation(db, transaction, uid, {
        operation: 'credit', amount: rewardTokens, reference: `wheel_${today}`,
      });
      balance = credit.wallet.balance;
      credit.commit();
    }

    transaction.set(spinRef, {
      userId: uid,
      day: today,
      segmentIndex,
      rewardTokens,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { segmentIndex, rewardTokens, balance };
  });
});

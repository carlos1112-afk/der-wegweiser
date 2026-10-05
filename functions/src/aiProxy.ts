import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { getFirestore } from "firebase-admin/firestore";
import { VertexAI } from "@google-cloud/vertexai";
import { consumeRateLimit } from "./rateLimit";

const LOCATION = "europe-west3";
const DEFAULT_MODEL = "gemini-2.0-flash";

export const AI_LIMITS = {
  maxSystemChars: 4000,
  maxUserChars: 8000,
  maxOutputTokens: 1024,
  defaultOutputTokens: 512,
  defaultTemperature: 0.7,
  requestsPerHour: 30,
  windowMs: 60 * 60 * 1000,
} as const;

interface ParsedAiRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
}

function parseRequest(data: unknown): ParsedAiRequest {
  if (typeof data !== "object" || data === null) {
    throw new HttpsError("invalid-argument", "Request body must be an object.");
  }
  const { systemPrompt, userPrompt, temperature, maxTokens } = data as Record<string, unknown>;

  if (typeof systemPrompt !== "string" || systemPrompt.length > AI_LIMITS.maxSystemChars) {
    throw new HttpsError("invalid-argument", "systemPrompt must be a string within the length limit.");
  }
  if (typeof userPrompt !== "string" || userPrompt.trim().length === 0 || userPrompt.length > AI_LIMITS.maxUserChars) {
    throw new HttpsError("invalid-argument", "userPrompt must be a non-empty string within the length limit.");
  }
  if (temperature !== undefined && (typeof temperature !== "number" || !Number.isFinite(temperature) || temperature < 0 || temperature > 1)) {
    throw new HttpsError("invalid-argument", "temperature must be a number between 0 and 1.");
  }
  if (maxTokens !== undefined && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > AI_LIMITS.maxOutputTokens)) {
    throw new HttpsError("invalid-argument", "maxTokens must be an integer within the allowed range.");
  }

  return {
    systemPrompt,
    userPrompt,
    temperature: temperature ?? AI_LIMITS.defaultTemperature,
    maxTokens: maxTokens ?? AI_LIMITS.defaultOutputTokens,
  };
}

export const aiProxy = onCall({
  region: LOCATION,
  cors: ["https://der-wegweiser.web.app", "http://localhost:5173"],
  timeoutSeconds: 30,
  maxInstances: 10,
}, async (request) => {
  const { auth, app } = request;

  if (!app) {
    throw new HttpsError("unauthenticated", "Invalid App Check token.");
  }
  if (!auth || !auth.uid) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const input = parseRequest(request.data);

  await consumeRateLimit(getFirestore(), "aiRequests", auth.uid, {
    windowMs: AI_LIMITS.windowMs,
    max: AI_LIMITS.requestsPerHour,
  });

  const modelName = process.env.AI_MODEL || DEFAULT_MODEL;

  try {
    const vertex = new VertexAI({
      project: process.env.GCLOUD_PROJECT || "der-wegweiser",
      location: LOCATION,
    });
    const model = vertex.getGenerativeModel({
      model: modelName,
      systemInstruction: input.systemPrompt,
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: input.userPrompt }] }],
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: input.maxTokens,
      },
    });

    const response = result.response;
    const text = (response.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!text) {
      if (response.promptFeedback?.blockReason || response.candidates?.[0]?.finishReason === "SAFETY") {
        throw new HttpsError("failed-precondition", "Request was rejected by the safety filter.");
      }
      throw new HttpsError("internal", "Empty response from AI service.");
    }

    return { text, modelUsed: modelName };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    const e = error as { name?: string; code?: unknown };
    logger.error("aiProxy: upstream call failed", { name: e?.name, code: e?.code });
    throw new HttpsError("unavailable", "AI service temporarily unavailable.");
  }
});

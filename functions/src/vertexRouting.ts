import { onCall, HttpsError } from "firebase-functions/v2/https";
import { VertexAI } from "@google-cloud/vertexai";

export const computeRoute = onCall({
  region: "europe-west3"
}, async (request) => {
  const { startLat, startLng, destLat, destLng, batteryPercent, rangeKm } = request.data;
  
  try {
    const vertex_ai = new VertexAI({project: 'der-wegweiser', location: 'europe-west3'});
    const model = vertex_ai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: "Battery-aware routing assistant für E-Bikes — gibt Waypoints + Ladestation-Empfehlungen zurück"
    });

    const prompt = `Plan a route from [${startLat}, ${startLng}] to [${destLat}, ${destLng}]. Battery: ${batteryPercent}%, Range: ${rangeKm}km.`;
    
    // Call the Vertex AI API
    await model.generateContent(prompt);
    
    // Returning stub data as requested
    return {
      waypoints: [
        { lat: startLat, lng: startLng },
        { lat: destLat, lng: destLng }
      ],
      chargingStops: [],
      estimatedRangeLeft: rangeKm > 5 ? rangeKm - 5 : 0
    };
  } catch (error: any) {
    throw new HttpsError('internal', `Vertex AI Error: ${error.message}`);
  }
});

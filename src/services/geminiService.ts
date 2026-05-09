/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getGenAI() {
  if (!genAI) {
    // In AI Studio browser environment, process.env.GEMINI_API_KEY is typically 
    // injected via build-time defines in vite.config.ts
    const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === 'YOUR_GEMINI_API_KEY') {
      throw new Error("Gemini API Key is missing. Please ensure your API key is properly configured.");
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export interface WeatherInsight {
  outfit: string;
  outfitReason: string;
  activities: string[];
  activitiesReason: string;
  alert?: string;
  summary: string;
}

export async function getWeatherInsights(
  temp: number,
  description: string,
  isDay: boolean,
  windSpeed: number,
  uvIndex?: number
): Promise<WeatherInsight> {
  const prompt = `Given the following weather conditions:
Current Temperature: ${temp}°C
Condition: ${description}
Time: ${isDay ? "Daytime" : "Nighttime"}
Wind Speed: ${windSpeed} km/h
${uvIndex !== undefined ? `UV Index: ${uvIndex}` : ""}

Provide a JSON object with:
1. "outfit": A specific clothing recommendation. Focus on layers and thermal comfort, and if UV index is high (above 3), suggest UV-protective gear like hats, sunglasses, or SPF.
2. "outfitReason": A brief (1 sentence) explanation of why this outfit is recommended based on the weather (temp, wind, UV).
3. "activities": A list of 2-3 suitable activities for these conditions.
4. "activitiesReason": A brief (1 sentence) explanation of why these activities are suitable for current atmosphere.
5. "alert": (Optional) Any important safety warnings (e.g., high UV warning if index > 6, high wind, slippery roads).
6. "summary": A very brief (1 sentence) atmospheric summary of the day.

Be creative and helpful!`;

  try {
    const ai = getGenAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfit: { type: Type.STRING },
            outfitReason: { type: Type.STRING },
            activities: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            activitiesReason: { type: Type.STRING },
            alert: { type: Type.STRING },
            summary: { type: Type.STRING },
          },
          required: ["outfit", "outfitReason", "activities", "activitiesReason", "summary"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error: any) {
    // Check for quota exhaustion
    const errorMessage = error?.message || "";
    const isQuotaError = errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED");
    
    if (isQuotaError) {
      console.warn("Gemini API Quota reached. Using secondary atmospheric heuristic.");
      return {
        outfit: "Functional seasonal layers for current conditions.",
        outfitReason: "Standard recommendation based on seasonal averages.",
        activities: ["Adapt to local environment", "Standard daily routine"],
        activitiesReason: "These activities are versatile across most conditions.",
        summary: "The atmospheric oracle is currently in standby mode (quota reset pending).",
        alert: "AI insight capacity exceeded. Full synchronization will resume shortly."
      };
    }

    console.error("Gemini Insight Error:", error);
    return {
      outfit: "Standard comfort wear recommended.",
      outfitReason: "Insufficient data for specialized recommendation.",
      activities: ["Observe local surroundings", "Indoor coordination"],
      activitiesReason: "Safe options when intelligence modules are recalibrating.",
      summary: "AI systems are currently recalibrating for better accuracy.",
    };
  }
}

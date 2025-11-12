
import { GoogleGenAI, Part, Type, Modality } from "@google/genai";
import { ManhwaPanel, PanelTiming, VoiceOption } from '../types';
import { decode, audioBufferToWav, decodeAudioData } from "../utils/audioUtils";
import { fileToBase64 } from "../utils/fileUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

const BATCH_SIZE = 15; // Process 15 images at a time to stay within API limits for large projects

export const generateScript = async (
  panels: ManhwaPanel[],
  onProgress: (message: string) => void,
  language: string
): Promise<string> => {
  const model = 'gemini-2.5-pro';
  
  // Use a chat session to maintain context across multiple API calls
  const chat = ai.chats.create({ model });
  let fullScript = '';

  onProgress(`Preparing ${panels.length} images for analysis...`);
  
  const allImageParts: Part[] = await Promise.all(panels.map(async (panel) => {
    const base64Data = await fileToBase64(panel.file);
    return {
      inlineData: { data: base64Data, mimeType: panel.file.type },
    };
  }));

  for (let i = 0; i < allImageParts.length; i += BATCH_SIZE) {
    const batchStart = i + 1;
    const batchEnd = Math.min(i + BATCH_SIZE, allImageParts.length);
    onProgress(`Analyzing panels ${batchStart} to ${batchEnd}...`);

    const batchParts = allImageParts.slice(i, i + BATCH_SIZE);
    
    let promptParts: Part[];

    if (i === 0) {
      const initialPromptText = `You are a scriptwriter for a YouTube channel that explains manhwa (Korean comics).
Analyze these manhwa panels, which are in chronological order.
Write a compelling and descriptive script in ${language} that narrates the story shown in the panels.
The script should explain the events, character actions, and any implied emotions or plot points.
Make it engaging for someone who is watching a video, not just reading the comic.
Do not describe the panels themselves (e.g., "In this panel..."). Instead, narrate the story as it unfolds.
Keep the tone exciting and dramatic. The output should be only the script text, with no introductory phrases like "Here is the script:".
Start the script directly.`;
      promptParts = [{ text: initialPromptText }, ...batchParts];
    } else {
      const subsequentPromptText = `Excellent, continue the script in ${language} based on the story so far. Here are the next panels. Maintain the same narrative style and tone. Do not repeat what you've already described or add any introductory text. Just provide the script for these new panels.`;
      promptParts = [{ text: subsequentPromptText }, ...batchParts];
    }
    
    const response = await chat.sendMessage({ message: promptParts });
    const scriptPart = response.text;
    // Add newlines between parts for readability and to separate narrative beats.
    fullScript += (fullScript ? '\n\n' : '') + scriptPart;
  }

  return fullScript;
};

export const generateVoiceover = async (script: string, voice: VoiceOption): Promise<{ audioBlob: Blob, audioUrl: string }> => {
  const model = 'gemini-2.5-flash-preview-tts';
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: script }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error("Could not generate audio from the API.");
  }
  
  const audioBytes = decode(base64Audio);
  
  // The API returns raw PCM data. We need to convert it to a playable format like WAV.
  // The TTS model uses a 24000 sample rate.
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioContext = new AudioContext({sampleRate: 24000});
  const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);
  const audioBlob = audioBufferToWav(audioBuffer);

  const audioUrl = URL.createObjectURL(audioBlob);
  return { audioBlob, audioUrl };
};

export const generateTimings = async (script: string, panelCount: number, audioDuration: number): Promise<PanelTiming[]> => {
    // Optimization: For a single panel, the timing is always to start at 0.
    // This avoids a needless API call and makes single-panel videos much faster.
    if (panelCount === 1) {
        return [{ panel: 1, startTime: 0 }];
    }

    // Use gemini-2.5-flash for faster performance on this structured data task.
    const model = 'gemini-2.5-flash';

    const prompt = `
You are a video editing assistant. Your task is to synchronize a script with a series of comic panels.
Based on the provided script and the total audio duration, determine when each of the ${panelCount} panels should appear on screen.

RULES:
1. The output MUST be a valid JSON array of objects.
2. Each object in the array represents a transition to a new panel.
3. Each object must have two keys: "panel" (an integer, 1-based index of the panel) and "startTime" (a float, in seconds).
4. The first panel MUST start at time 0.0.
5. The last panel must be displayed until the end of the audio. The total audio duration is ${audioDuration.toFixed(2)} seconds.
6. Distribute the panels logically according to the narrative flow of the script. A panel should be displayed while the corresponding part of the script is being narrated.
7. You can switch back and forth between panels if the script refers to a previous scene.
8. Ensure the panel indices are within the valid range of 1 to ${panelCount}.
9. The "startTime" for each entry must be in increasing order.

SCRIPT:
---
${script}
---

Total panels: ${panelCount}
Total audio duration: ${audioDuration.toFixed(2)} seconds.

Provide only the JSON array as your response.
`;

    const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        panel: {
                            type: Type.INTEGER,
                            description: "The 1-based index of the panel to display."
                        },
                        startTime: {
                            type: Type.NUMBER,
                            description: "The timestamp in seconds when the panel should appear."
                        }
                    },
                    required: ["panel", "startTime"]
                }
            }
        }
    });

    try {
        const jsonText = response.text.trim();
        const timings: PanelTiming[] = JSON.parse(jsonText);
        // Basic validation
        if (!Array.isArray(timings) || timings.some(t => typeof t.panel !== 'number' || typeof t.startTime !== 'number')) {
            throw new Error("Invalid timing format received from API.");
        }
        // Ensure the video starts at time 0
        if (timings.length > 0 && timings[0].startTime !== 0) {
            timings[0].startTime = 0;
        }
        return timings;
    } catch (e) {
        console.error("Failed to parse timings JSON:", e);
        console.error("Received text:", response.text);
        throw new Error("Could not parse timing information from the API response.");
    }
};


import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ManhwaPanel, PanelTiming, EditedClip, CropRect } from '../types';
import { fileToBase64 } from "../utils/fileUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

// AI call to remove text from an image and inpaint the background
async function inpaintImage(panel: ManhwaPanel): Promise<{ base64Data: string, mimeType: string }> {
    const model = 'gemini-2.5-flash-image';
    const base64Data = await fileToBase64(panel.file);

    const response = await ai.models.generateContent({
        model,
        contents: {
            parts: [
                {
                    inlineData: { data: base64Data, mimeType: panel.file.type },
                },
                {
                    text: `
Analyze this comic panel. Your task is to remove all text, including speech bubbles, narration boxes, and sound effect text.
Then, seamlessly fill in the empty areas by extending the surrounding artwork (inpaint).
Pay close attention to the existing art style, including line work, coloring, shading, and textures.
The inpainted area should blend perfectly and be indistinguishable from the original artist's work.
The output should be ONLY the modified image with no text remaining. Do not add any extra elements or alter the original art.
`,
                },
            ],
        },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
    if (!imagePart || !imagePart.inlineData) {
        throw new Error("AI failed to return an inpainted image.");
    }

    return { base64Data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
}

// AI call to get crop coordinates for key subjects in the panel
async function getSubjectCrops(inpaintedBase64: string, mimeType: string, imageUrl: string): Promise<CropRect[]> {
    const model = 'gemini-2.5-flash';

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = async () => {
            const { naturalWidth, naturalHeight } = img;

            const response = await ai.models.generateContent({
                model,
                contents: {
                    parts: [
                        { text: `
                            Analyze the composition of this comic panel, which is ${naturalWidth}px wide and ${naturalHeight}px tall. Your goal is to identify the main subjects or areas of interest.
                            - Subjects can be characters, important objects, or specific actions.
                            - Identify between 1 and 3 of the most important subjects.
                            - For each subject, provide a bounding box that tightly crops around it.

                            Return a JSON array of objects. Each object represents a crop and must contain "x", "y", "w" (width), and "h" (height) as integer pixel values.
                            The origin (0,0) is the top-left corner of the image.
                            The coordinates must be within the image bounds (0 to ${naturalWidth} for x, 0 to ${naturalHeight} for y).
                            Provide only the raw JSON array as your response.
                        `},
                        {
                            inlineData: { data: inpaintedBase64, mimeType: mimeType },
                        }
                    ]
                },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                x: { type: Type.INTEGER },
                                y: { type: Type.INTEGER },
                                w: { type: Type.INTEGER },
                                h: { type: Type.INTEGER },
                            },
                            required: ["x", "y", "w", "h"]
                        }
                    }
                }
            });

            try {
                const crops: Omit<CropRect, 'id'>[] = JSON.parse(response.text.trim());
                 // Validate and clamp crop values to be within image boundaries
                const validatedCrops = crops.map(c => {
                    const x = Math.max(0, c.x);
                    const y = Math.max(0, c.y);
                    const w = Math.min(naturalWidth - x, c.w);
                    const h = Math.min(naturalHeight - y, c.h);
                    return { x, y, w, h, id: crypto.randomUUID() };
                }).filter(c => c.w > 0 && c.h > 0); // Filter out invalid crops

                if(validatedCrops.length === 0) {
                     // Fallback to a full image crop if validation fails
                     resolve([{ x: 0, y: 0, w: naturalWidth, h: naturalHeight, id: crypto.randomUUID() }]);
                } else {
                    resolve(validatedCrops);
                }
            } catch(e) {
                console.error("Failed to parse crop coordinates from AI", e);
                console.error("Received text:", response.text);
                // Fallback to a full image crop on error
                resolve([{ x: 0, y: 0, w: naturalWidth, h: naturalHeight, id: crypto.randomUUID() }]);
            }
        };
        img.onerror = () => {
             reject(new Error("Could not load image to determine dimensions for cropping."));
        };
        img.src = imageUrl;
    });
}


export const animatePanels = async (
    panels: ManhwaPanel[],
    timings: PanelTiming[],
    audioDuration: number,
    onProgress: (message: string) => void
): Promise<EditedClip[]> => {
    const editedClips: EditedClip[] = [];
    const panelCache = new Map<string, { inpaintedImageBase64: string, mimeType: string, crops: CropRect[] }>();
    
    const uniquePanelIds = [...new Set(timings.map(t => panels[t.panel-1].id))];

    // Process each unique panel only once to save API calls
    for(let i=0; i<uniquePanelIds.length; i++) {
        const panelId = uniquePanelIds[i];
        const panel = panels.find(p => p.id === panelId);
        if(!panel) continue;

        onProgress(`Inpainting panel ${i+1}/${uniquePanelIds.length}`);
        const { base64Data: inpainted, mimeType } = await inpaintImage(panel);
        
        onProgress(`Analyzing panel ${i+1}/${uniquePanelIds.length} for animation`);
        const imageUrl = `data:${mimeType};base64,${inpainted}`;
        const crops = await getSubjectCrops(inpainted, mimeType, imageUrl);

        panelCache.set(panelId, { inpaintedImageBase64: inpainted, mimeType, crops });
    }

    // Assemble the final clip timeline using the cached panel data
    for (let i = 0; i < timings.length; i++) {
        const timing = timings[i];
        const panelIndex = timing.panel - 1;
        if (panelIndex < 0 || panelIndex >= panels.length) continue;
        
        const panel = panels[panelIndex];
        const cachedData = panelCache.get(panel.id);
        if (!cachedData) continue;
        
        const nextStartTime = (i + 1 < timings.length) ? timings[i+1].startTime : audioDuration;
        const duration = nextStartTime - timing.startTime;

        if (duration > 0.01) {
            editedClips.push({
                startTime: timing.startTime,
                duration,
                panelId: panel.id,
                ...cachedData
            });
        }
    }
    
    return editedClips;
};

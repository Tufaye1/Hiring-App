import { GoogleGenAI, Type } from '@google/genai';
import { Job, MatchLabel } from '../types';
import { SEARCH_PROMPT_TEMPLATE, ANALYSIS_SYSTEM_INSTRUCTION } from '../constants';

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

export const searchAndAnalyzeJobs = async (): Promise<Job[]> => {
    const ai = getClient();

    try {
        // Step 1: Perform Grounded Search
        // We use gemini-3-flash-preview for fast, grounded search capabilities.
        const searchModel = 'gemini-3-flash-preview';
        
        console.log("Starting search with Gemini...");
        const searchResponse = await ai.models.generateContent({
            model: searchModel,
            contents: SEARCH_PROMPT_TEMPLATE,
            config: {
                tools: [{ googleSearch: {} }],
                // We don't force JSON here because we want the model to freely use the search tool 
                // and gather as much context as possible in natural language first.
            }
        });

        const searchResultText = searchResponse.text;
        const groundingChunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
        
        console.log("Search complete. Raw text length:", searchResultText?.length);
        
        if (!searchResultText) {
            return [];
        }

        // Prepare context for the analysis step
        // We explicitly pass the grounding chunks to the second step if possible, 
        // but typically passing the text + the URLs found is sufficient.
        
        let groundingContext = "";
        if (groundingChunks) {
             groundingContext = "\n\nAssociated URLs found during search:\n" + 
                groundingChunks.map(c => c.web?.uri ? `- ${c.web.title}: ${c.web.uri}` : '').filter(Boolean).join('\n');
        }

        // Step 2: Extract and Analyze
        // We use the same model (or a Pro model if complexity required) to parse the search results into JSON.
        // gemini-3-flash-preview is excellent for this.
        
        console.log("Starting analysis...");
        const analysisResponse = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `
                Here are the raw search results describing recent job postings:
                ---------------------------------------------------
                ${searchResultText}
                ---------------------------------------------------
                ${groundingContext}
                ---------------------------------------------------
                
                Based on the PROFILE CONTEXT provided in the system instruction, extract and score the jobs.
                Only include jobs with a relevance score >= 0.2.
            `,
            config: {
                systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            company: { type: Type.STRING },
                            title: { type: Type.STRING },
                            location: { type: Type.STRING },
                            url: { type: Type.STRING },
                            relevanceScore: { type: Type.NUMBER },
                            relevanceLabel: { type: Type.STRING },
                            reason: { type: Type.STRING },
                            postedDate: { type: Type.STRING }
                        },
                        required: ["company", "title", "relevanceScore", "relevanceLabel", "reason"]
                    }
                }
            }
        });

        const jsonText = analysisResponse.text;
        
        if (!jsonText) return [];

        const parsedData = JSON.parse(jsonText) as any[];

        // Map to internal Job interface
        const jobs: Job[] = parsedData.map((item, index) => ({
            id: `job-${Date.now()}-${index}`,
            company: item.company || "Unknown Company",
            title: item.title || "Unknown Role",
            location: item.location || "Remote",
            url: item.url || "#",
            dateFound: new Date().toISOString(),
            postedDate: item.postedDate,
            relevanceScore: item.relevanceScore || 0,
            relevanceLabel: mapLabel(item.relevanceLabel),
            reason: item.reason || "No analysis provided",
            source: "Google Search"
        }));

        // Filter out anything that slipped through (double check)
        return jobs.filter(j => j.relevanceScore >= 0.2);

    } catch (error) {
        console.error("Error in searchAndAnalyzeJobs:", error);
        throw error;
    }
};

const mapLabel = (label: string): MatchLabel => {
    const l = label.toLowerCase();
    if (l.includes('strong')) return MatchLabel.STRONG;
    if (l.includes('medium')) return MatchLabel.MEDIUM;
    if (l.includes('exploratory')) return MatchLabel.EXPLORATORY;
    return MatchLabel.WEAK;
};

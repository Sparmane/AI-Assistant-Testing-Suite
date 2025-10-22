
import { GoogleGenAI, Type } from "@google/genai";
// Fix: Import `JobStatus` to use it in the `runFullTest` return value, resolving a type error.
import { EvaluationResult, EvaluationCriterion, TestResult, TestStatus, JobStatus } from '../types';

export interface LLMOptions {
    apiKey: string;
    modelName: string;
    provider: string;
}

// --- Gemini Implementation ---
const generateAnswerGemini = async (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    const prompt = `
        System Prompt: ${systemPrompt}

        Knowledge Base:
        ---
        ${knowledgeBase}
        ---

        Based *only* on the knowledge base provided, answer the following user question.
        User Question: ${question}
    `;

    try {
        const ai = new GoogleGenAI({ apiKey: options.apiKey });
        const response = await ai.models.generateContent({
            model: options.modelName,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating answer with Gemini:", error);
        if (error instanceof Error) {
            throw new Error(`Failed to generate answer with Gemini: ${error.message}`);
        }
        throw new Error("Failed to get a response from the Gemini model for generating the answer.");
    }
};

const evaluateTextGemini = async (
    type: EvaluationCriterion, 
    prompt: string,
    options: LLMOptions
): Promise<EvaluationResult> => {
    try {
        const ai = new GoogleGenAI({ apiKey: options.apiKey });
        const response = await ai.models.generateContent({
            model: options.modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        result: { type: Type.STRING },
                        reason: { type: Type.STRING }
                    },
                    required: ['result', 'reason']
                }
            }
        });

        const jsonResponse = JSON.parse(response.text.trim());
        const status = jsonResponse.result === 'Pass' ? TestStatus.Pass : TestStatus.Fail;
        return { type, status, reason: jsonResponse.reason };
    } catch (error) {
        console.error(`Error during Gemini ${type} evaluation:`, error);
        const reason = error instanceof Error ? error.message : `API call failed for ${type} evaluation.`;
        return { type, status: TestStatus.Error, reason };
    }
};


// --- OpenAI Implementation ---
const generateAnswerOpenAI = async (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const systemContent = `${systemPrompt}\nYou must answer the user's question based *only* on the knowledge base provided.`;
    const userContent = `Knowledge Base:\n---\n${knowledgeBase}\n---\nUser Question: ${question}`;

    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`
            },
            body: JSON.stringify({
                model: options.modelName,
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: userContent }
                ]
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`OpenAI API Error: ${res.statusText} - ${errorData.error?.message}`);
        }

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No content returned from OpenAI.';
    } catch (error) {
        console.error("Error generating answer with OpenAI:", error);
        if (error instanceof Error) throw error;
        throw new Error("Failed to get a response from OpenAI for generating the answer.");
    }
};

const evaluateTextOpenAI = async (
    type: EvaluationCriterion, 
    prompt: string,
    options: LLMOptions
): Promise<EvaluationResult> => {
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const systemInstruction = "You are an AI assistant that evaluates text and responds in valid JSON format.";
    
    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${options.apiKey}`
            },
            body: JSON.stringify({
                model: options.modelName,
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`OpenAI API Error: ${res.statusText} - ${errorData.error?.message}`);
        }

        const data = await res.json();
        const jsonResponse = JSON.parse(data.choices[0]?.message?.content);
        const status = jsonResponse.result === 'Pass' ? TestStatus.Pass : TestStatus.Fail;
        return { type, status, reason: jsonResponse.reason };
    } catch (error) {
        console.error(`Error during OpenAI ${type} evaluation:`, error);
        const reason = error instanceof Error ? error.message : `API call failed for ${type} evaluation.`;
        return { type, status: TestStatus.Error, reason };
    }
};


// --- Provider Dispatchers ---
const generateAnswer = (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    switch (options.provider) {
        case 'OpenAI':
            return generateAnswerOpenAI(knowledgeBase, systemPrompt, question, options);
        case 'Google Gemini':
            return generateAnswerGemini(knowledgeBase, systemPrompt, question, options);
        default:
            throw new Error(`Unsupported provider: ${options.provider}`);
    }
};

const evaluateText = (type: EvaluationCriterion, prompt: string, options: LLMOptions): Promise<EvaluationResult> => {
    switch (options.provider) {
        case 'OpenAI':
            return evaluateTextOpenAI(type, prompt, options);
        case 'Google Gemini':
            return evaluateTextGemini(type, prompt, options);
        default:
            throw new Error(`Unsupported provider: ${options.provider}`);
    }
};


// --- Shared Logic & Export ---
export type EvaluationPrompts = {
    [key in EvaluationCriterion]: string;
};

const formatPrompt = (
    promptTemplate: string,
    textToEvaluate: string,
    context: { knowledgeBase: string; question: string; systemPrompt: string; }
): string => {
    return promptTemplate
        .replace(/{textToEvaluate}/g, textToEvaluate)
        .replace(/{knowledgeBase}/g, context.knowledgeBase)
        .replace(/{question}/g, context.question)
        .replace(/{systemPrompt}/g, context.systemPrompt);
};

export const runFullTest = async (
    knowledgeBase: string,
    systemPrompt: string,
    question: string,
    prompts: EvaluationPrompts,
    options: LLMOptions
): Promise<Omit<TestResult, 'id' | 'passScore'>> => {
    const generatedAnswer = await generateAnswer(knowledgeBase, systemPrompt, question, options);
    const context = { knowledgeBase, question, systemPrompt };

    const evaluationPromises = Object.entries(prompts).map(([criterion, promptTemplate]) => 
        evaluateText(
            criterion as EvaluationCriterion, 
            formatPrompt(promptTemplate, generatedAnswer, context),
            options
        )
    );

    const evaluations = await Promise.all(evaluationPromises);

    // Fix: Add the missing 'status' property to satisfy the return type.
    return {
        question,
        generatedAnswer,
        evaluations,
        status: JobStatus.Completed,
    };
};
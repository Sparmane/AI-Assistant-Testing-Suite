import { GoogleGenAI, Type } from "@google/genai";
import { EvaluationResult, EvaluationCriterion, TestResult, TestStatus, JobStatus } from '../types';

export interface LLMOptions {
    apiKey: string;
    modelName: string;
    provider: string;
    azureEndpoint?: string;
    azureDeploymentName?: string;
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const getErrorMessage = (error: unknown, providerName: string): string => {
    console.error(`Error with ${providerName}:`, error);
    if (error instanceof Error) {
        return error.message;
    }
    return `An unknown error occurred with ${providerName}.`;
};

const handleFetchError = async (res: Response, providerName: string): Promise<Error> => {
    let errorMessage = `API Error: ${res.status} ${res.statusText}`;
    try {
        const errorData = await res.json();
        let messageFromServer = '';

        if (errorData.error?.message) {
            messageFromServer = errorData.error.message;
        } else if (typeof errorData === 'string') {
            messageFromServer = errorData;
        }
        
        if (providerName === 'Azure OpenAI' && messageFromServer.includes('content management policy')) {
            errorMessage = "Azure Content Filter Triggered: Your prompt was blocked by Azure's content management policy. This is common with prompts that use strong, absolute language (e.g., 'NEVER', 'FORBIDDEN') or sections that resemble 'jailbreaking' attempts (like detailing SECURITY or FORBIDDEN rules). Since these safety policies are frequently updated, a prompt that worked before may fail now. Try rephrasing with positive instructions: focus on what the AI *should* do rather than what it *must not* do. For example, instead of a 'FORBIDDEN' list, gently guide its scope.";
        } else if (messageFromServer) {
            errorMessage = messageFromServer;
        }

    } catch (e) {
        // Response body is not JSON or is empty; use the status text.
    }
    return new Error(`${providerName} ${errorMessage}`);
};


// --- Gemini Implementation ---
const generateTextGemini = async (prompt: string, options: LLMOptions): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: options.modelName,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        throw new Error(getErrorMessage(error, 'Gemini'));
    }
};

const generateStructuredTextGemini = async (prompt: string, options: LLMOptions): Promise<string> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: options.modelName,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
            }
        });
        return response.text;
    } catch (error) {
        throw new Error(getErrorMessage(error, 'Gemini'));
    }
};

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
    return generateTextGemini(prompt, options);
};

const evaluateTextGemini = async (
    type: EvaluationCriterion, 
    prompt: string,
    options: LLMOptions
): Promise<EvaluationResult> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
        const reason = getErrorMessage(error, 'Gemini');
        console.error(`Error during Gemini ${type} evaluation:`, error);
        return { type, status: TestStatus.Error, reason };
    }
};


// --- OpenAI Implementation ---
const generateTextOpenAI = async (prompt: string, options: LLMOptions): Promise<string> => {
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
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
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No content returned from OpenAI.';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'OpenAI'));
    }
};

const generateStructuredTextOpenAI = async (prompt: string, options: LLMOptions): Promise<string> => {
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const systemInstruction = "You are an AI assistant that responds in valid JSON format.";
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

        if (!res.ok) throw await handleFetchError(res, 'OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || '{}';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'OpenAI'));
    }
};

const generateAnswerOpenAI = async (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    const apiEndpoint = 'https://api.openai.com/v1/chat/completions';
    const userContent = `You must answer the user's question based *only* on the knowledge base provided.\n\nKnowledge Base:\n---\n${knowledgeBase}\n---\nUser Question: ${question}`;

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
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ]
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No content returned from OpenAI.';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'OpenAI'));
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

        if (!res.ok) throw await handleFetchError(res, 'OpenAI');

        const data = await res.json();
        const jsonResponse = JSON.parse(data.choices[0]?.message?.content);
        const status = jsonResponse.result === 'Pass' ? TestStatus.Pass : TestStatus.Fail;
        return { type, status, reason: jsonResponse.reason };
    } catch (error) {
        const reason = getErrorMessage(error, 'OpenAI');
        console.error(`Error during OpenAI ${type} evaluation:`, error);
        return { type, status: TestStatus.Error, reason };
    }
};

// --- Azure Foundry Open AI Implementation ---
const generateTextAzureOpenAI = async (prompt: string, options: LLMOptions): Promise<string> => {
     if (!options.azureEndpoint || !options.azureDeploymentName) {
        throw new Error("Azure endpoint and deployment name are required.");
    }
    const sanitizedEndpoint = options.azureEndpoint.replace(/\/$/, '');
    const apiVersion = '2024-02-01';
    const apiEndpoint = `${sanitizedEndpoint}/openai/deployments/${options.azureDeploymentName}/chat/completions?api-version=${apiVersion}`;

    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': options.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'Azure OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No content returned from Azure OpenAI.';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'Azure OpenAI'));
    }
};

const generateStructuredTextAzureOpenAI = async (prompt: string, options: LLMOptions): Promise<string> => {
     if (!options.azureEndpoint || !options.azureDeploymentName) {
        throw new Error("Azure endpoint and deployment name are required.");
    }
    const sanitizedEndpoint = options.azureEndpoint.replace(/\/$/, '');
    const apiVersion = '2024-02-01';
    const apiEndpoint = `${sanitizedEndpoint}/openai/deployments/${options.azureDeploymentName}/chat/completions?api-version=${apiVersion}`;
    const systemInstruction = "You are an AI assistant that responds in valid JSON format.";
    
    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': options.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'Azure OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || '{}';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'Azure OpenAI'));
    }
};

const generateAnswerAzureOpenAI = async (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    if (!options.azureEndpoint || !options.azureDeploymentName) {
        throw new Error("Azure endpoint and deployment name are required.");
    }
    const sanitizedEndpoint = options.azureEndpoint.replace(/\/$/, '');
    const apiVersion = '2024-02-01';
    const apiEndpoint = `${sanitizedEndpoint}/openai/deployments/${options.azureDeploymentName}/chat/completions?api-version=${apiVersion}`;
    
    const userContent = `You must answer the user's question based *only* on the knowledge base provided.\n\nKnowledge Base:\n---\n${knowledgeBase}\n---\nUser Question: ${question}`;

    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': options.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ]
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'Azure OpenAI');

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No content returned from Azure OpenAI.';
    } catch (error) {
        throw new Error(getErrorMessage(error, 'Azure OpenAI'));
    }
};

const evaluateTextAzureOpenAI = async (
    type: EvaluationCriterion, 
    prompt: string,
    options: LLMOptions
): Promise<EvaluationResult> => {
     if (!options.azureEndpoint || !options.azureDeploymentName) {
        throw new Error("Azure endpoint and deployment name are required.");
    }
    const sanitizedEndpoint = options.azureEndpoint.replace(/\/$/, '');
    const apiVersion = '2024-02-01';
    const apiEndpoint = `${sanitizedEndpoint}/openai/deployments/${options.azureDeploymentName}/chat/completions?api-version=${apiVersion}`;
    const systemInstruction = "You are an AI assistant that evaluates text and responds in valid JSON format.";
    
    try {
        const res = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': options.apiKey
            },
            body: JSON.stringify({
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            })
        });

        if (!res.ok) throw await handleFetchError(res, 'Azure OpenAI');

        const data = await res.json();
        const jsonResponse = JSON.parse(data.choices[0]?.message?.content);
        const status = jsonResponse.result === 'Pass' ? TestStatus.Pass : TestStatus.Fail;
        return { type, status, reason: jsonResponse.reason };
    } catch (error) {
        const reason = getErrorMessage(error, 'Azure OpenAI');
        console.error(`Error during Azure OpenAI ${type} evaluation:`, error);
        return { type, status: TestStatus.Error, reason };
    }
};


// --- Provider Dispatchers ---
export const generateText = (prompt: string, options: LLMOptions): Promise<string> => {
    switch (options.provider) {
        case 'OpenAI':
            return generateTextOpenAI(prompt, options);
        case 'Google Gemini':
            return generateTextGemini(prompt, options);
        case 'Azure Foundry Open AI':
            return generateTextAzureOpenAI(prompt, options);
        default:
            throw new Error(`Unsupported provider: ${options.provider}`);
    }
};

export const generateStructuredText = (prompt: string, options: LLMOptions): Promise<string> => {
    switch (options.provider) {
        case 'OpenAI':
            return generateStructuredTextOpenAI(prompt, options);
        case 'Google Gemini':
            return generateStructuredTextGemini(prompt, options);
        case 'Azure Foundry Open AI':
            return generateStructuredTextAzureOpenAI(prompt, options);
        default:
            throw new Error(`Unsupported provider: ${options.provider}`);
    }
};

const generateAnswer = (knowledgeBase: string, systemPrompt: string, question: string, options: LLMOptions): Promise<string> => {
    switch (options.provider) {
        case 'OpenAI':
            return generateAnswerOpenAI(knowledgeBase, systemPrompt, question, options);
        case 'Google Gemini':
            return generateAnswerGemini(knowledgeBase, systemPrompt, question, options);
        case 'Azure Foundry Open AI':
            return generateAnswerAzureOpenAI(knowledgeBase, systemPrompt, question, options);
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
        case 'Azure Foundry Open AI':
            return evaluateTextAzureOpenAI(type, prompt, options);
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
    context?: { knowledgeBase: string; question: string; systemPrompt: string; }
): string => {
    let formatted = promptTemplate.replace(/{textToEvaluate}/g, textToEvaluate);
    if (context) {
        formatted = formatted
            .replace(/{knowledgeBase}/g, context.knowledgeBase)
            .replace(/{question}/g, context.question)
            .replace(/{systemPrompt}/g, context.systemPrompt);
    }
    return formatted;
};

export const runEvaluationSuite = async (
    textToEvaluate: string,
    prompts: EvaluationPrompts,
    options: LLMOptions
): Promise<EvaluationResult[]> => {
    const evaluations: EvaluationResult[] = [];
    const criteria = Object.entries(prompts);

    for (const [criterion, promptTemplate] of criteria) {
        const result = await evaluateText(
            criterion as EvaluationCriterion,
            formatPrompt(promptTemplate, textToEvaluate), // No RAG context needed
            options
        );
        evaluations.push(result);
        await delay(200); // Add a small delay between evaluation calls to avoid rate-limiting
    }
    return evaluations;
};

export const runFullTest = async (
    knowledgeBase: string,
    systemPrompt: string,
    question: string,
    prompts: EvaluationPrompts,
    options: LLMOptions
): Promise<Omit<TestResult, 'id' | 'passScore'>> => {
    const generatedAnswer = await generateAnswer(knowledgeBase, systemPrompt, question, options);
    
    const evaluations = await runEvaluationSuite(
        generatedAnswer,
        prompts,
        options
    );

    return {
        question,
        generatedAnswer,
        evaluations,
        status: JobStatus.Completed,
    };
};
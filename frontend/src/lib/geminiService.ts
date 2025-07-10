// Simple service to interact with Google's Gemini API

// Check if the API key is configured
let geminiApiKey: string | null = null;
let geminiStatus: 'loaded' | 'missing' | 'error' = 'missing';

try {
  // Try to get the API key from environment variables
  geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('GEMINI_API_KEY');
  
  if (geminiApiKey) {
    geminiStatus = 'loaded';
  } else {
    geminiStatus = 'missing';
  }
} catch (error) {
  console.error('Error initializing Gemini API:', error);
  geminiStatus = 'error';
}

// Get the current API key status
export const checkGeminiStatus = (): 'loaded' | 'missing' | 'error' => {
  return geminiStatus;
};

// Set the API key manually
export const setGeminiApiKey = (apiKey: string): void => {
  try {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    geminiApiKey = apiKey;
    geminiStatus = 'loaded';
  } catch (error) {
    console.error('Error saving Gemini API key:', error);
    geminiStatus = 'error';
  }
};

// Generate a response from Gemini
export const generateGeminiResponse = async (prompt: string): Promise<string> => {
  if (!geminiApiKey || geminiStatus !== 'loaded') {
    throw new Error('Gemini API key is not configured');
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiApiKey}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`API Error: ${data.error?.message || 'Unknown error'}`);
    }

    return data.candidates[0].content.parts[0].text || 'No response generated.';
  } catch (error) {
    console.error('Error generating response from Gemini:', error);
    throw error;
  }
};

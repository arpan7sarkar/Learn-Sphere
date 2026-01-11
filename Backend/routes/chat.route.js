const express = require('express');
const { GoogleGenAI } = require("@google/genai");
const router = express.Router();
require('dotenv').config();

router.post('/chat', async (req, res) => {
    const { message, history } = req.body;
    if (!message) {
        return res.status(400).json({ message: 'Message is required.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ message: 'API Key not configured on server.' });
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const systemInstruction = { parts: [{ text: "You are LearnSphere Tutor, a friendly and encouraging AI assistant. You help students with their coursework, explain concepts in simple terms, and provide study tips. Keep answers concise and helpful." }] };
    
    // Ensure history is correctly formatted for the SDK
    const contents = [...(history || []), { role: 'user', parts: [{ text: message }] }];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: contents,
            config: {
                systemInstruction: systemInstruction
            }
        });

        const chatResponse = response.text;
        res.status(200).json({ reply: chatResponse });
    } catch (error) {
        // Enhance error logging
        const errorMessage = error.response ? JSON.stringify(error.response) : error.message;
        console.error("Error with Gemini Chat API:", errorMessage);
        
        // Log additional details if available
        if (error.status) console.error("Status:", error.status);
        
        res.status(500).json({ message: 'Failed to get a response from the AI tutor.' });
    }
});

module.exports = router;
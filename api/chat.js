const axios = require('axios');

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { message, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: 'Message is required.' });
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ message: 'API Key not configured on server.' });
    }
    
    const systemInstruction = { 
      parts: [{ 
        text: "You are LearnSphere Tutor, a friendly and encouraging AI assistant designed to help students learn effectively. You provide clear explanations, answer questions, and offer study tips. Always be supportive and patient." 
      }] 
    };
    
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
    const contents = [...(history || []), { role: 'user', parts: [{ text: message }] }];

    const response = await axios.post(API_URL, { contents, systemInstruction });
    const chatResponse = response.data.candidates[0].content.parts[0].text;
    
    res.status(200).json({ reply: chatResponse });
  } catch (error) {
    const errorMessage = error.response ? error.response.data.error.message : error.message;
    console.error("Error with Gemini Chat API:", errorMessage);
    res.status(500).json({ message: 'Failed to get a response from the AI tutor.' });
  }
}

const API_URL = 'http://localhost:5000';

export async function postSpeechText(text) {
  const res = await fetch(`${API_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  return res.json();
}

// Backwards-compatible alias — App.js can import { translateText } or { postSpeechText }
export const translateText = postSpeechText;
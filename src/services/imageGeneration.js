import { supabase } from './supabaseClient';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

export const generateBookCover = async (pdfId, title) => {
  try {
    // Skip content fetching for now since we don't have content_summary
    const prompt = `Create a minimalist, modern book cover for "${title}". 
    The cover should be:
    - Clean and professional
    - Use a color scheme that reflects the title's mood
    - Include subtle, relevant design elements
    - Be suitable for a digital document
    - Have a contemporary, tech-focused style
    - No text or letters on the cover
    - Focus on abstract visual elements`;

    // Only proceed with image generation if we have an API key
    if (!OPENAI_API_KEY) {
      console.warn('OpenAI API key not found, using fallback design');
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.warn('Image generation failed:', error);
      return null;
    }

    const data = await response.json();
    return data.data[0].url;
  } catch (error) {
    console.warn('Error in cover generation, using fallback:', error);
    return null;
  }
}; 
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true, // for frontend usage (development only)
});

export async function generateQuizQuestions(pdfText) {
  const prompt = `
    You are an educational assistant. Generate a quiz based on the text provided.  
    Requirements: 
    - Create 10 multiple-choice questions.
    - Each question should have 1 correct answer and 4 incorrect answers.
    - Clearly mark the correct answer.
    - Return the quiz as structured JSON exactly in this format:
    
    {
      "questions": [
        {
          "question": "Question text",
          "choices": ["option1", "option2", "option3", "option4"],
          "correctAnswer": "Correct option text"
        },
        ... (9 more questions)
      ]
    }

    Text to generate quiz from:
    ${pdfText}
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // or "gpt-4"
    messages: [{ role: "user", content: prompt }],
  });

  const quizJson = response.choices[0].message.content;

  return JSON.parse(quizJson);
}

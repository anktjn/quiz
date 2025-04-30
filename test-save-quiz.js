// Test script for saving quiz results
import { saveQuizResult } from './src/utils/quizTemplateService.js';

async function testSaveQuiz() {
  console.log('Testing saveQuizResult function...');
  
  const testQuizData = {
    pdf_id: '123e4567-e89b-12d3-a456-426614174000', // Random UUID format for testing
    score: 8, 
    correct_answers: 8, 
    total_questions: 10,
    user_id: 'test-user',
    pdf_name: 'Test PDF',
    selected_question_indices: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  };
  
  try {
    const result = await saveQuizResult(testQuizData);
    console.log('Result:', result);
    if (result.error) {
      console.error('Error:', result.error);
    } else {
      console.log('Quiz result saved successfully!');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testSaveQuiz(); 
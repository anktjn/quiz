import { supabase } from './supabase';

/**
 * Store a quiz template for a PDF with multiple questions
 * @param {string} pdf_id - The ID of the PDF
 * @param {Array} questions - Array of quiz questions
 * @param {string} modelUsed - The AI model used to generate questions
 * @returns {Promise<Object>} The stored quiz template record
 */
export async function storeQuizTemplate(pdf_id, questions, modelUsed = "gpt-4") {
  try {
    console.log(`Storing quiz template for PDF ID: ${pdf_id}`);
    
    if (!pdf_id) {
      console.error("No PDF ID provided to storeQuizTemplate");
      throw new Error("PDF ID is required");
    }
    
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.error("Invalid questions array:", questions);
      throw new Error("Questions must be a non-empty array");
    }
    
    // Validate and clean questions array
    const validatedQuestions = questions.filter(q => {
      // Basic validation
      if (!q || typeof q !== 'object') {
        console.warn("Invalid question object detected");
        return false;
      }
      
      // Ensure required properties exist
      if (!q.question || typeof q.question !== 'string' || q.question.trim().length === 0) {
        console.warn("Question missing required 'question' text");
        return false;
      }
      
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        console.warn("Question missing required 'options' array with at least 2 options");
        return false;
      }
      
      // Check for either answer or correctAnswer property
      const hasAnswer = q.answer !== undefined && q.answer !== null;
      const hasCorrectAnswer = q.correctAnswer !== undefined && q.correctAnswer !== null;
      
      if (!hasAnswer && !hasCorrectAnswer) {
        console.warn("Question missing both 'answer' and 'correctAnswer' properties");
        return false;
      }
      
      return true;
    }).map(q => {
      // Normalize the question objects to have consistent property names
      // We'll standardize on using 'answer' instead of 'correctAnswer'
      return {
        question: q.question,
        options: q.options,
        // Use answer if available, otherwise use correctAnswer
        answer: q.answer !== undefined ? q.answer : q.correctAnswer,
        explanation: q.explanation || ""
      };
    });
    
    console.log(`${validatedQuestions.length} of ${questions.length} questions passed validation`);
    
    if (validatedQuestions.length === 0) {
      throw new Error("No valid questions after validation");
    }
    
    // The expiration date will be 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    console.log(`Checking for existing quiz template for PDF ID: ${pdf_id}`);
    
    // First, check if we already have a quiz template for this PDF
    const { data: existingTemplate, error: checkError } = await supabase
      .from("quiz_templates")
      .select("id")
      .eq("pdf_id", pdf_id)
      .maybeSingle(); // Use maybeSingle to prevent 406 errors
      
    // Handle errors other than "not found"
    if (checkError && checkError.code !== 'PGRST116') {
      console.error("Error checking for existing quiz template:", checkError);
      throw checkError;
    }
    
    // If the quiz template already exists, update it
    if (existingTemplate) {
      console.log(`Quiz template already exists for PDF ID: ${pdf_id}, updating record with ID: ${existingTemplate.id}`);
      
      // IMPORTANT: Supabase expects direct array for jsonb column, not {questions: [...]}
      const { data, error } = await supabase
        .from("quiz_templates")
        .update({
          questions: validatedQuestions, // Direct array, not an object with questions property
          last_accessed_at: new Date(),
          expires_at: expiresAt,
          model_used: modelUsed
        })
        .eq("id", existingTemplate.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating quiz template:", error);
        throw error;
      }
      
      console.log(`Successfully updated quiz template with ID: ${data.id}`);
      return data;
    } else {
      // Otherwise, insert a new record
      console.log(`No existing template for PDF ID: ${pdf_id}, creating new record`);
      
      // IMPORTANT: Supabase expects direct array for jsonb column, not {questions: [...]}
      const { data, error } = await supabase
        .from("quiz_templates")
        .insert([{
          pdf_id: pdf_id,
          questions: validatedQuestions, // Direct array, not an object with questions property
          generated_at: new Date(),
          last_accessed_at: new Date(),
          expires_at: expiresAt,
          model_used: modelUsed
        }])
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation explicitly
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          console.log("Unique constraint violation detected. Attempting update instead.");
          
          // Try one more time with an update
          const { data: retryData, error: retryError } = await supabase
            .from("quiz_templates")
            .update({
              questions: validatedQuestions, // Direct array, not an object with questions property
              last_accessed_at: new Date(),
              expires_at: expiresAt,
              model_used: modelUsed
            })
            .eq("pdf_id", pdf_id)
            .select()
            .single();
            
          if (retryError) {
            console.error("Error on retry update:", retryError);
            throw retryError;
          }
          
          console.log(`Successfully updated quiz template on retry with ID: ${retryData.id}`);
          return retryData;
        }
        
        console.error("Error inserting quiz template:", error);
        throw error;
      }
      
      console.log(`Successfully created quiz template with ID: ${data.id}`);
      return data;
    }
  } catch (error) {
    console.error("Error storing quiz template:", error, error.stack);
    // Track more details about the error
    console.error(`PDF ID: ${pdf_id}, Questions: ${Array.isArray(questions) ? questions.length : 0}`);
    // Return failure but don't fail the entire app
    return {error: error.message, pdfId: pdf_id};
  }
}

/**
 * Get quiz template for a specific PDF
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<Object|null>} The quiz template or null if not found
 */
export async function getQuizTemplate(pdf_id) {
  try {
    console.log(`[QUIZ_TEMPLATE] 🔍 Getting quiz template for PDF ID: ${pdf_id}`);
    
    const { data, error } = await supabase
      .from("quiz_templates")
      .select("*")
      .eq("pdf_id", pdf_id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

    if (error) {
      console.error("[QUIZ_TEMPLATE] ❌ Error retrieving quiz template:", error);
      throw error;
    }

    if (!data) {
      console.log(`[QUIZ_TEMPLATE] ℹ️ No quiz template found for PDF ID: ${pdf_id}`);
      return null;
    }

    console.log(`[QUIZ_TEMPLATE] ✅ Found quiz template with ID: ${data.id}`);
    
    // Update last accessed time
    console.log(`[QUIZ_TEMPLATE] 🔄 Updating last_accessed_at for template ID: ${data.id}`);
    await supabase
      .from("quiz_templates")
      .update({ last_accessed_at: new Date() })
      .eq("pdf_id", pdf_id);

    return data;
  } catch (error) {
    console.error("[QUIZ_TEMPLATE] ❌ Error retrieving quiz template:", error);
    throw error;
  }
}

/**
 * Check if quiz template is valid (exists and not expired)
 * @param {string} pdf_id - The ID of the PDF
 * @returns {Promise<boolean>} True if valid template exists, false otherwise
 */
export async function hasValidQuizTemplate(pdf_id) {
  try {
    console.log(`[QUIZ_TEMPLATE] 🔍 Checking if valid template exists for PDF ID: ${pdf_id}`);
    
    // Use maybeSingle to handle the "no rows returned" case gracefully
    const { data, error } = await supabase
      .from("quiz_templates")
      .select("id, expires_at")
      .eq("pdf_id", pdf_id)
      .maybeSingle(); // Use maybeSingle instead of single to avoid 406 errors

    if (error) {
      console.error("[QUIZ_TEMPLATE] ❌ Error checking quiz template:", error);
      return false;
    }
    
    if (!data) {
      console.log(`[QUIZ_TEMPLATE] ℹ️ No template found for PDF ID: ${pdf_id}`);
      return false;
    }
    
    // Check if template is expired
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    
    const isValid = now < expiresAt;
    console.log(`[QUIZ_TEMPLATE] ✅ Template ${isValid ? 'is valid' : 'is expired'} - Template ID: ${data.id}, Expires: ${expiresAt.toISOString()}`);
    
    return isValid;
  } catch (error) {
    console.error("[QUIZ_TEMPLATE] ❌ Error checking quiz template:", error);
    console.error(`[QUIZ_TEMPLATE] ❌ PDF ID: ${pdf_id}`);
    return false;
  }
}

/**
 * Generate a random subset of questions from a template
 * @param {string} pdf_id - The ID of the PDF
 * @param {number} count - Number of questions to include in the quiz
 * @returns {Promise<Object>} Object with questions and their indices in the template
 */
export async function generateQuizFromTemplate(pdf_id, count = 10) {
  try {
    console.log(`[QUIZ_TEMPLATE] 🔄 Generating quiz from template for PDF ID: ${pdf_id}, Count: ${count}`);
    
    const template = await getQuizTemplate(pdf_id);
    
    if (!template || !template.questions) {
      console.error(`[QUIZ_TEMPLATE] ❌ No valid quiz template found for PDF ID: ${pdf_id}`);
      throw new Error('No valid quiz template found for this PDF');
    }
    
    // Handle both array format and nested object format for backward compatibility
    let allQuestions = Array.isArray(template.questions) 
      ? template.questions 
      : (template.questions.questions && Array.isArray(template.questions.questions) 
        ? template.questions.questions 
        : null);
        
    if (!allQuestions || allQuestions.length === 0) {
      console.error(`[QUIZ_TEMPLATE] ❌ Template has no valid questions array for PDF ID: ${pdf_id}`);
      throw new Error('Quiz template has no valid questions');
    }
    
    console.log(`[QUIZ_TEMPLATE] 📊 Template has ${allQuestions.length} questions available`);
    
    // If we don't have enough questions, return all we have
    if (allQuestions.length <= count) {
      console.log(`[QUIZ_TEMPLATE] ℹ️ Using all available questions (${allQuestions.length}) as count (${count}) exceeds available`);
      return {
        questions: allQuestions,
        selectedIndices: [...Array(allQuestions.length).keys()], // [0, 1, 2, ...]
        templateId: template.id
      };
    }
    
    // Randomly select a subset of questions
    const selectedIndices = [];
    const selectedQuestions = [];
    
    // Create a copy of indices and shuffle it
    const indices = [...Array(allQuestions.length).keys()];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]; // Swap elements
    }
    
    // Take the first 'count' elements
    for (let i = 0; i < count; i++) {
      const index = indices[i];
      selectedIndices.push(index);
      selectedQuestions.push(allQuestions[index]);
    }
    
    console.log(`[QUIZ_TEMPLATE] ✅ Successfully generated quiz with ${selectedQuestions.length} questions`);
    
    // Return with a flat structure (not nested objects)
    return {
      questions: selectedQuestions,
      selectedIndices,
      templateId: template.id
    };
  } catch (error) {
    console.error("[QUIZ_TEMPLATE] ❌ Error generating quiz from template:", error);
    throw error;
  }
}

/**
 * Save a completed quiz with reference to the template
 * @param {Object} quizData - Quiz data including user_id, pdf_id, etc.
 * @param {string} quizData.user_id - User ID
 * @param {string} quizData.pdf_id - PDF ID
 * @param {string} quizData.pdf_name - PDF name
 * @param {number} quizData.score - Quiz score
 * @param {string} quizData.template_id - Template ID
 * @param {Array} quizData.selected_question_indices - Indices of questions used
 * @returns {Promise<Object>} The saved quiz record
 */
export async function saveQuizResult(quizData) {
  try {
    console.log(`[QUIZ_TEMPLATE] 🔄 Saving quiz result for PDF ID: ${quizData.pdf_id}`);
    
    const { data, error } = await supabase
      .from("quizzes")
      .insert([quizData])
      .select()
      .single();

    if (error) {
      console.error("[QUIZ_TEMPLATE] ❌ Error saving quiz result:", error);
      throw error;
    }
    
    console.log(`[QUIZ_TEMPLATE] ✅ Successfully saved quiz result with ID: ${data.id}`);
    return data;
  } catch (error) {
    console.error("[QUIZ_TEMPLATE] ❌ Error saving quiz result:", error);
    throw error;
  }
} 
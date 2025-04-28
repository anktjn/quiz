import { supabase } from './supabase';

/**
 * Store a quiz template for a PDF with multiple questions
 * @param {string} pdf_id - The ID of the PDF
 * @param {Array} questions - Array of quiz questions
 * @param {string} modelUsed - The AI model used to generate questions
 * @param {Object} chapterInfo - Optional information about chapters in the document
 * @returns {Promise<Object>} The stored quiz template record
 */
export async function storeQuizTemplate(pdf_id, questions, modelUsed = "gpt-4", chapterInfo = null) {
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
      const normalizedQuestion = {
        question: q.question,
        options: q.options,
        // Use answer if available, otherwise use correctAnswer
        answer: q.answer !== undefined ? q.answer : q.correctAnswer,
        explanation: q.explanation || ""
      };
      
      // Preserve metadata if available
      if (q.metadata) {
        normalizedQuestion.metadata = q.metadata;
      }
      
      return normalizedQuestion;
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
      
      // Prepare update data with optional chapter info
      const updateData = {
        questions: validatedQuestions, // Direct array, not an object with questions property
        last_accessed_at: new Date(),
        expires_at: expiresAt,
        model_used: modelUsed
      };
      
      // Add chapter_info if provided
      if (chapterInfo) {
        updateData.chapter_info = chapterInfo;
      }
      
      // IMPORTANT: Supabase expects direct array for jsonb column, not {questions: [...]}
      const { data, error } = await supabase
        .from("quiz_templates")
        .update(updateData)
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
      
      // Prepare insert data with optional chapter info
      const insertData = {
        pdf_id: pdf_id,
        questions: validatedQuestions, // Direct array, not an object with questions property
        generated_at: new Date(),
        last_accessed_at: new Date(),
        expires_at: expiresAt,
        model_used: modelUsed
      };
      
      // Add chapter_info if provided
      if (chapterInfo) {
        insertData.chapter_info = chapterInfo;
      }
      
      // IMPORTANT: Supabase expects direct array for jsonb column, not {questions: [...]}
      const { data, error } = await supabase
        .from("quiz_templates")
        .insert([insertData])
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation explicitly
        if (error.code === '23505') { // PostgreSQL unique constraint violation
          console.log("Unique constraint violation detected. Attempting update instead.");
          
          // Prepare update data (same as insert but without pdf_id)
          const retryUpdateData = {
            questions: validatedQuestions,
            last_accessed_at: new Date(),
            expires_at: expiresAt,
            model_used: modelUsed
          };
          
          // Add chapter_info if provided
          if (chapterInfo) {
            retryUpdateData.chapter_info = chapterInfo;
          }
          
          // Try one more time with an update
          const { data: retryData, error: retryError } = await supabase
            .from("quiz_templates")
            .update(retryUpdateData)
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
      // Ensure we create a sequential array of indices [0,1,2,...etc]
      const allIndices = Array.from({ length: allQuestions.length }, (_, i) => i);
      return {
        questions: allQuestions,
        selectedIndices: allIndices,
        templateId: template.id
      };
    }
    
    // Get previously used question indices from localStorage
    let previouslyUsedIndices = [];
    try {
      // Check if localStorage is available (won't be in server-side environments)
      const hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
      
      if (hasLocalStorage) {
        const storageKey = `quiz_used_indices_${pdf_id}`;
        const storedData = localStorage.getItem(storageKey);
        if (storedData) {
          previouslyUsedIndices = JSON.parse(storedData);
          console.log(`[QUIZ_TEMPLATE] 🔍 Found ${previouslyUsedIndices.length} previously used question indices`);
        }
      }
    } catch (storageError) {
      console.warn(`[QUIZ_TEMPLATE] ⚠️ Could not retrieve previously used indices: ${storageError.message}`);
      // Continue without the stored data if there's an error
    }
    
    // Create array of all possible indices
    const allIndices = [...Array(allQuestions.length).keys()];
    
    // Prioritize unused questions
    let availableIndices = allIndices.filter(index => !previouslyUsedIndices.includes(index));
    
    // If we've used all questions or need more, reset and use any
    if (availableIndices.length < count) {
      console.log(`[QUIZ_TEMPLATE] 🔄 Not enough unused questions (${availableIndices.length}), recycling some previously used ones`);
      // If we've used all or almost all questions, reset tracking to prevent getting the same set repeatedly
      if (availableIndices.length < count * 0.5) {
        console.log(`[QUIZ_TEMPLATE] 🔄 Resetting question tracking (only ${availableIndices.length} unused questions left)`);
        availableIndices = allIndices;
        previouslyUsedIndices = [];
      } else {
        // Add some previously used questions to reach the desired count
        const neededExtra = count - availableIndices.length;
        // Shuffle the used indices to pick some randomly
        const shuffledUsed = previouslyUsedIndices.sort(() => Math.random() - 0.5);
        availableIndices.push(...shuffledUsed.slice(0, neededExtra));
      }
    }
    
    // Fisher-Yates shuffle algorithm - more reliable than sort with random
    const indices = [...availableIndices];
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]]; // swap elements
    }
    
    // Select the required number of questions
    const selectedIndices = indices.slice(0, count);
    const selectedQuestions = selectedIndices.map(index => allQuestions[index]);
    
    console.log(`[QUIZ_TEMPLATE] 🎲 Randomly selected indices: ${JSON.stringify(selectedIndices)}`);
    
    // Update the stored list of used indices
    try {
      // Check if localStorage is available
      const hasLocalStorage = typeof window !== 'undefined' && window.localStorage;
      
      if (hasLocalStorage) {
        const storageKey = `quiz_used_indices_${pdf_id}`;
        const updatedUsedIndices = [...new Set([...previouslyUsedIndices, ...selectedIndices])];
        localStorage.setItem(storageKey, JSON.stringify(updatedUsedIndices));
        console.log(`[QUIZ_TEMPLATE] 💾 Stored ${updatedUsedIndices.length} used question indices`);
      }
    } catch (storageError) {
      console.warn(`[QUIZ_TEMPLATE] ⚠️ Could not store used indices: ${storageError.message}`);
      // Continue without storing if there's an error
    }
    
    console.log(`[QUIZ_TEMPLATE] ✅ Successfully generated quiz with ${selectedQuestions.length} questions`);
    
    // Store the original template indices for proper tracking in metadata
    const templateSelectedIndices = [...selectedIndices];
    
    // Create UI-friendly sequential indices [0,1,2,3,4,5,6,7,8,9]
    const uiIndices = Array.from({ length: selectedQuestions.length }, (_, i) => i);
    
    console.log(`[QUIZ_TEMPLATE] 🔄 Using UI indices ${JSON.stringify(uiIndices)} for display but tracking original template indices ${JSON.stringify(templateSelectedIndices)} in metadata`);
    
    // Add metadata to each question to track the original index from the template
    selectedQuestions.forEach((question, idx) => {
      if (!question.metadata) question.metadata = {};
      question.metadata.templateIndex = templateSelectedIndices[idx];
    });
    
    // Return with a flat structure (not nested objects)
    return {
      questions: selectedQuestions,
      selectedIndices: uiIndices, // Use sequential indices for UI consistent experience
      templateId: template.id,
      // Store original template indices in metadata for tracking
      metadata: {
        templateSelectedIndices: templateSelectedIndices
      }
    };
  } catch (error) {
    console.error("[QUIZ_TEMPLATE] ❌ Error generating quiz from template:", error);
    throw error;
  }
}

/**
 * Saves a completed quiz result to the database
 * @param {Object|string} pdfIdOrData - Either the PDF ID string or an object containing all quiz data
 * @param {number} [score] - The quiz score (0-100) - used only if pdfIdOrData is a string
 * @param {number} [correctAnswers] - Number of correct answers - used only if pdfIdOrData is a string
 * @param {number} [totalQuestions] - Total number of questions - used only if pdfIdOrData is a string
 * @param {Object} [metadata] - Optional metadata about the quiz (time taken, etc.) - used only if pdfIdOrData is a string
 * @returns {Promise<Object>} The saved quiz record
 */
export async function saveQuizResult(pdfIdOrData, score, correctAnswers, totalQuestions, metadata = {}) {
  try {
    // Determine if we were passed an object or individual parameters
    let quizData;
    
    if (typeof pdfIdOrData === 'object' && pdfIdOrData !== null) {
      // We received an object with all the quiz data
      const currentDate = new Date();
      const isoDate = currentDate.toISOString();
      
      quizData = {
        pdf_id: pdfIdOrData.pdf_id,
        score: pdfIdOrData.score,
        correct_answers: pdfIdOrData.correct_answers || 0,
        total_questions: pdfIdOrData.total_questions || 10,
        completed_at: isoDate,
        date_taken: isoDate, // Add date_taken for backward compatibility
        metadata: pdfIdOrData.metadata || {}
      };
      
      // Add additional fields if they exist
      if (pdfIdOrData.user_id) quizData.user_id = pdfIdOrData.user_id;
      if (pdfIdOrData.pdf_name) quizData.pdf_name = pdfIdOrData.pdf_name;
      if (pdfIdOrData.template_id) quizData.template_id = pdfIdOrData.template_id;
      
      // Handle selected_question_indices
      if (pdfIdOrData.selected_question_indices) {
        // Ensure it's an array of integers
        const indices = Array.isArray(pdfIdOrData.selected_question_indices) 
          ? pdfIdOrData.selected_question_indices.map(index => parseInt(index, 10))
          : [];
        
        console.log("Processing selected indices for storage:", indices);
        
        // Store directly in the table column
        quizData.selected_question_indices = indices;
        
        // Also include in metadata for backward compatibility
        if (!quizData.metadata) quizData.metadata = {};
        quizData.metadata.selected_question_indices = indices;
      }
      
      // If the incoming data has template indices, include them in metadata too
      if (pdfIdOrData.metadata && pdfIdOrData.metadata.templateSelectedIndices) {
        if (!quizData.metadata) quizData.metadata = {};
        quizData.metadata.templateSelectedIndices = pdfIdOrData.metadata.templateSelectedIndices;
        console.log("Including template indices in metadata:", pdfIdOrData.metadata.templateSelectedIndices);
      }
    } else {
      // We received individual parameters (legacy format)
      const pdfId = pdfIdOrData;
      const currentDate = new Date();
      const isoDate = currentDate.toISOString();
      
      if (!pdfId) {
        throw new Error("PDF ID is required to save quiz result");
      }
      
      if (score === undefined || score === null || isNaN(score)) {
        throw new Error("Valid score is required to save quiz result");
      }
      
      quizData = {
        pdf_id: pdfId,
        score: score,
        correct_answers: correctAnswers || 0,
        total_questions: totalQuestions || 10,
        completed_at: isoDate,
        date_taken: isoDate, // Add date_taken for backward compatibility
        metadata: metadata || {}
      };
    }
    
    // Validate required fields
    if (!quizData.pdf_id) {
      throw new Error("PDF ID is required to save quiz result");
    }
    
    if (quizData.score === undefined || quizData.score === null || isNaN(quizData.score)) {
      throw new Error("Valid score is required to save quiz result");
    }
    
    // Ensure metadata is a valid JSON object
    if (quizData.metadata && typeof quizData.metadata === 'object') {
      // Stringify and re-parse to ensure it's valid JSON
      try {
        const metadataStr = JSON.stringify(quizData.metadata);
        quizData.metadata = JSON.parse(metadataStr);
      } catch (jsonError) {
        console.warn("Error formatting metadata as JSON, using empty object instead:", jsonError);
        quizData.metadata = {};
      }
    } else {
      quizData.metadata = {};
    }
    
    console.log("Saving quiz result:", quizData);
    
    // Insert the quiz result
    const { data, error } = await supabase
      .from("quizzes")
      .insert([quizData])
      .select()
      .single();
      
    if (error) {
      console.error("Error saving quiz result:", error);
      throw error;
    }
    
    console.log("Successfully saved quiz result with ID:", data.id);
    return data;
  } catch (error) {
    console.error("Error in saveQuizResult:", error);
    // Return failure object but don't crash the app
    if (typeof pdfIdOrData === 'object' && pdfIdOrData !== null) {
      return { error: error.message, pdfId: pdfIdOrData.pdf_id };
    } else {
      return { error: error.message, pdfId: pdfIdOrData };
    }
  }
}

/**
 * Reset the question history for a specific PDF
 * This allows the user to get fresh questions even if they've seen all questions before
 * @param {string} pdf_id - The ID of the PDF
 * @returns {boolean} Success indicator
 */
export function resetQuizQuestionHistory(pdf_id) {
  try {
    // Check if localStorage is available
    if (typeof window === 'undefined' || !window.localStorage) {
      console.warn("[QUIZ_TEMPLATE] ⚠️ Cannot reset question history - localStorage not available");
      return false;
    }
    
    const storageKey = `quiz_used_indices_${pdf_id}`;
    localStorage.removeItem(storageKey);
    console.log(`[QUIZ_TEMPLATE] 🧹 Successfully reset question history for PDF ID: ${pdf_id}`);
    return true;
  } catch (error) {
    console.error(`[QUIZ_TEMPLATE] ❌ Error resetting question history: ${error.message}`);
    return false;
  }
} 
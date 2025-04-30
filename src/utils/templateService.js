export async function storeQuizTemplate(pdfId, template) {
  if (!pdfId || !template) {
    console.error(`[Template Service] ❌ Invalid arguments for storeQuizTemplate: pdfId=${pdfId}, template=${!!template}`);
    return { success: false, error: "Invalid PDF ID or template" };
  }

  console.log(`[Template Service] 🔄 Storing quiz template for PDF ID: ${pdfId}`);

  try {
    // Validate questions structure
    if (!template.questions || !Array.isArray(template.questions) || template.questions.length === 0) {
      console.error(`[Template Service] ❌ Invalid questions in template: ${typeof template.questions}`);
      return { success: false, error: "Template must include an array of questions" };
    }

    // Clean and validate each question to ensure it's serializable
    const validatedQuestions = template.questions.map(question => {
      // Ensure each question has required properties and proper formatting
      return {
        question: typeof question.question === 'string' ? question.question : String(question.question || ''),
        options: Array.isArray(question.options) ? 
          question.options.map(opt => typeof opt === 'string' ? opt : String(opt || '')) : [],
        answer: typeof question.answer === 'string' ? question.answer : 
          (typeof question.answer === 'number' ? String(question.answer) : ''),
        explanation: typeof question.explanation === 'string' ? question.explanation : String(question.explanation || '')
      };
    });

    // Prepare template data with validated questions
    const templateData = {
      pdf_id: pdfId,
      title: typeof template.title === 'string' ? template.title : 'Quiz',
      description: typeof template.description === 'string' ? template.description : '',
      difficulty: typeof template.difficulty === 'string' ? template.difficulty : 'medium',
      questions: validatedQuestions,
      created_at: new Date().toISOString()
    };

    const { data: supabase } = await getSupabaseClient();

    // Check if a template already exists for this PDF
    console.log(`[Template Service] 🔍 Checking if template exists for PDF ID: ${pdfId}`);
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('quiz_templates')
      .select('id')
      .eq('pdf_id', pdfId)
      .maybeSingle();

    if (fetchError && !fetchError.message.includes('No rows found')) {
      console.error(`[Template Service] ❌ Error checking for existing template: ${fetchError.message}`);
      return { success: false, error: fetchError.message };
    }

    let result;

    if (existingTemplate) {
      console.log(`[Template Service] 🔄 Updating existing template for PDF ID: ${pdfId}`);
      const { data, error: updateError } = await supabase
        .from('quiz_templates')
        .update({ 
          ...templateData,
          updated_at: new Date().toISOString()
        })
        .eq('pdf_id', pdfId)
        .select('id');

      if (updateError) {
        console.error(`[Template Service] ❌ Error updating template: ${updateError.message}`);
        return { success: false, error: updateError.message };
      }

      result = { success: true, id: data?.[0]?.id, updated: true };
    } else {
      console.log(`[Template Service] 🔄 Inserting new template for PDF ID: ${pdfId}`);
      const { data, error: insertError } = await supabase
        .from('quiz_templates')
        .insert(templateData)
        .select('id');

      if (insertError) {
        console.error(`[Template Service] ❌ Error inserting template: ${insertError.message}`);
        return { success: false, error: insertError.message };
      }

      result = { success: true, id: data?.[0]?.id, inserted: true };
    }

    console.log(`[Template Service] ✅ Successfully stored quiz template`);
    return result;
  } catch (error) {
    console.error(`[Template Service] ❌ Error storing quiz template: ${error.message}`, error);
    return { success: false, error: error.message };
  }
} 
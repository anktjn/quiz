import { useState, useEffect } from "react";
import Quiz from "./components/Quiz";
import { extractTextFromPDF } from "./utils/pdf";
import { generateQuizQuestions } from "./utils/openai";
import { AnimatePresence, motion } from 'framer-motion';
import Result from "./components/Results";
import Loading from "./components/Loading";
import RestartApp from "./components/RestartApp";
import { uploadPDF } from "./utils/uploadPDF";
import { savePDFMetadata, testPDFContentStorage, verifyPDFContentStorage, cleanPDFContent } from "./utils/pdfService";
import Login from "./components/Login";
import { supabase } from "./utils/supabase";
import Dashboard from "./components/Dashboard";
import UploadModal from "./components/UploadModal";
import { fetchBookCover } from "./utils/bookCovers";
import { queuePDFForProcessing } from "./utils/backgroundProcess";
import { resetQuizQuestionHistory, saveQuizResult } from "./utils/quizTemplateService";

console.log('[APP] Initializing App component');

function App() { 
  const [currentPdfId, setCurrentPdfId] = useState(null);
  const [view, setView] = useState("dashboard"); // or "quiz", "result"
  const [user, setUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [loadingProgress, setLoadingProgress] = useState("");
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pdfs, setPdfs] = useState([]);

  console.log('[APP] App component initialized with default state');

  // Function to track randomization effectiveness over time
  const checkRandomization = (selectedIndices) => {
    if (!selectedIndices || !Array.isArray(selectedIndices) || selectedIndices.length === 0) {
      console.warn(`[APP] ⚠️ Cannot track randomization: Invalid indices provided`, selectedIndices);
      return;
    }
    
    // Sort indices to ensure consistent tracking regardless of ordering
    const sortedIndices = [...selectedIndices].sort((a, b) => a - b);
    
    // Check localStorage for existing tracking data
    const trackingKey = `quiz_randomization_${currentPdfId || 'default'}`;
    const existingData = localStorage.getItem(trackingKey);
    let trackingData = existingData ? JSON.parse(existingData) : { 
      attempts: 0,
      questionFrequency: {},
      history: []
    };
    
    // Update attempt count
    trackingData.attempts += 1;
    
    // Track how often each question index is selected
    selectedIndices.forEach(index => {
      if (!trackingData.questionFrequency[index]) {
        trackingData.questionFrequency[index] = 0;
      }
      trackingData.questionFrequency[index] += 1;
    });
    
    // Store this selection in history
    trackingData.history.push({
      timestamp: new Date().toISOString(),
      indices: selectedIndices,
      source: quiz?.templateId ? 'template' : 'dynamic'  // Track if indices came from template or dynamic generation
    });
    
    // Keep history to last 10 attempts
    if (trackingData.history.length > 10) {
      trackingData.history = trackingData.history.slice(-10);
    }
    
    // Save updated tracking data
    localStorage.setItem(trackingKey, JSON.stringify(trackingData));
    
    // Log randomization stats for debugging
    console.log(`[APP] 📊 Randomization tracking - Attempt #${trackingData.attempts}`);
    
    // Calculate frequency distribution
    if (trackingData.attempts > 1) {
      const frequencyEntries = Object.entries(trackingData.questionFrequency);
      const totalQuestions = frequencyEntries.length;
      
      // Sort by most frequent
      frequencyEntries.sort((a, b) => b[1] - a[1]);
      
      console.log(`[APP] 📊 Question selection frequency (top 5):`);
      frequencyEntries.slice(0, 5).forEach(([index, count]) => {
        const percentage = ((count / trackingData.attempts) * 100).toFixed(1);
        console.log(`[APP] - Question #${index}: ${count}/${trackingData.attempts} (${percentage}%)`);
      });
      
      // Log questions that have never been selected
      const neverSelected = totalQuestions - frequencyEntries.length;
      if (neverSelected > 0) {
        console.log(`[APP] ⚠️ ${neverSelected} questions have never been selected in ${trackingData.attempts} attempts`);
      }
    }
  };

  // Add event listeners for progress updates
  useEffect(() => {
    console.log('[APP] 🔄 Setting up event listeners for quiz generation progress');
    
    const handleGenerationProgress = (event) => {
      if (event.detail && event.detail.message) {
        console.log(`[APP] 📣 Received progress update: ${event.detail.message}`);
        setLoadingProgress(event.detail.message);
      }
    };

    window.addEventListener('quiz-generation-progress', handleGenerationProgress);
    
    return () => {
      console.log('[APP] 🧹 Cleaning up event listeners');
      window.removeEventListener('quiz-generation-progress', handleGenerationProgress);
    };
  }, []);

  useEffect(() => {
    console.log(`[APP] 📄 Current PDF ID changed to: ${currentPdfId}`);
  }, [currentPdfId]);

  useEffect(() => {
    console.log('[APP] 🔄 Checking for existing user session');
    
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      const userFromSession = data?.session?.user || null;
      console.log(`[APP] 👤 User session found: ${userFromSession ? 'Yes' : 'No'}`);
      setUser(userFromSession);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log(`[APP] 👤 Auth state changed: ${_event}`);
        setUser(session?.user || null);
      }
    );
    return () => {
      console.log('[APP] 🧹 Cleaning up auth listener');
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Set the theme on mount
    console.log('[APP] 🎨 Setting default theme');
    document.documentElement.setAttribute('data-theme', 'corporateecho');
  }, []);

  useEffect(() => {
    // Fetch PDFs when user is logged in
    if (user) {
      const fetchPDFs = async () => {
        try {
          const { data, error } = await supabase
            .from('pdfs')
            .select('*')
            .eq('user_id', user.id)
            .order('uploaded_at', { ascending: false });
            
          if (error) throw error;
          setPdfs(data || []);
        } catch (error) {
          console.error("Error fetching PDFs:", error);
        }
      };
      
      fetchPDFs();
    }
  }, [user]);

  const handleLogout = async () => {
    console.log('[APP] 🔄 User logout requested');
    await supabase.auth.signOut();
    setUser(null);
    setView("dashboard");
    setSelectedFile(null);
    setQuiz(null);
    setScore(0);
    setQuizCompleted(false);
    console.log('[APP] ✅ User logged out successfully');
  };

  const generateQuizFromPDF = async (file, pdfId = null, forceRefresh = false) => {
    console.log(`[APP] 🔄 generateQuizFromPDF - File: ${file.name}, Size: ${(file.size / 1024).toFixed(2)} KB, Force refresh: ${forceRefresh}`);
    
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      console.error('[APP] ❌ Missing OpenAI API key');
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>OpenAI API key is not configured. Please check your environment variables.</span>';
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
      return null;
    }

    setLoading(true);
    setLoadingMessage("Processing PDF...");
    setLoadingProgress("");
    console.log('[APP] 🔄 Started PDF processing, UI updated to loading state');
    
    try {
      console.log(`[APP] 🔄 Current PDF ID: ${currentPdfId} or ${pdfId}`);
      // Check if we need to verify content first
      if ((currentPdfId || pdfId) && !forceRefresh) {
        console.log(`[APP] 🔍 Verifying content before quiz generation for PDF ID: ${currentPdfId}`);
        const contentVerification = await verifyPDFContentStorage(currentPdfId || pdfId);
        console.log(`[APP] 🔍 Content verification result:`, contentVerification);
        
        // If content is insufficient or test data, force refresh
        if (!contentVerification || 
            !contentVerification.success || 
            contentVerification.details?.content_length < 500) {
          console.log(`[APP] ⚠️ Content verification failed or insufficient content, forcing refresh`);
          forceRefresh = true;
        }
      }
      
      // Define a helper function to dispatch progress events
      const updateProgress = (message) => {
        console.log(`[APP] 📣 Updating progress: ${message}`);
        const progressEvent = new CustomEvent('quiz-generation-progress', {
          detail: { message }
        });
        window.dispatchEvent(progressEvent);
      };
      
      setLoadingMessage("Extracting text from PDF...");
      console.log('[APP] 🔄 Starting text extraction from PDF');
      const startExtractTime = performance.now();
      const pdfText = await extractTextFromPDF(file);
      const endExtractTime = performance.now();
      console.log(`[APP] ⏱️ Text extraction took ${(endExtractTime - startExtractTime).toFixed(2)}ms`);
      console.log(`[APP] 📄 Extracted text length: ${pdfText?.length || 0} characters`);
      
      if (!pdfText || pdfText.trim().length === 0) {
        console.error('[APP] ❌ Failed to extract text from PDF');
        throw new Error('Could not extract text from PDF. Please make sure the PDF contains readable text.');
      }
      
      console.log(`[APP] ✅ Text extracted successfully - Length: ${pdfText.length} characters`);

      setLoadingMessage("Generating quiz questions...");
      updateProgress("This might take longer for large documents...");
      console.log('[APP] 🔄 Starting quiz generation');
      
      // Add event listeners to track progress in the OpenAI service
      const handleChunkProcessing = (e) => {
        console.log(`[APP] 📣 Chunk processing event: ${e.detail.current}/${e.detail.total}${e.detail.level ? ' (level: ' + e.detail.level + ')' : ''}`);
        updateProgress(`Processing section ${e.detail.current} of ${e.detail.total}`);
      };
      
      window.addEventListener('chunk-processing', handleChunkProcessing);
      
      console.log(`[APP] 🔄 Generating quiz with PDF ID: ${currentPdfId}, Force refresh: ${forceRefresh}`);
      const startQuizTime = performance.now();
      
      // Pass the PDF ID for caching if available and forceRefresh parameter
      const quizQuestions = await generateQuizQuestions(pdfText, currentPdfId || pdfId, forceRefresh, 50);
      
      const endQuizTime = performance.now();
      console.log(`[APP] ⏱️ Quiz generation took ${((endQuizTime - startQuizTime) / 1000).toFixed(2)}s`);
      console.log(`[APP] 📊 Quiz data structure:`, quizQuestions);
      
      // Remove event listener when done
      window.removeEventListener('chunk-processing', handleChunkProcessing);
      
      // Validate the quiz data returned by OpenAI
      if (!quizQuestions) {
        console.error('[APP] ❌ Quiz generation failed completely, no data returned');
        throw new Error('Failed to generate quiz questions. Please try again.');
      }
      
      // Check if questions are in the expected format - handle flat array
      const hasQuestions = (
        quizQuestions.questions && Array.isArray(quizQuestions.questions) && quizQuestions.questions.length > 0
      );
      
      if (!hasQuestions) {
        console.error('[APP] ❌ No valid questions in the response:', quizQuestions);
        throw new Error('Failed to generate valid quiz questions. Please try again.');
      }
      
      // Log success with questions array (now always in the same structure)
      const questionCount = quizQuestions.questions.length;
      console.log(`[APP] ✅ Quiz generated successfully - ${questionCount} questions`);
      console.log(`[APP] 🎯 First question as example:`, quizQuestions.questions[0]);
      
      // Select 10 random questions for this quiz attempt
      console.log(`[APP] 🎲 Selecting 10 random questions from ${questionCount} available questions`);
      const allQuestions = [...quizQuestions.questions];
      const selectedQuestions = [];
      let selectedIndices = [];
      
      if (allQuestions.length <= 10) {
        // If we have 10 or fewer questions, use all of them
        selectedQuestions.push(...allQuestions);
        selectedIndices = Array.from({ length: allQuestions.length }, (_, i) => i);
        console.log(`[APP] ℹ️ Using all ${allQuestions.length} available questions as there are 10 or fewer`);
      } else {
        // Fisher-Yates shuffle algorithm - more reliable than sort with random
        const indices = Array.from({ length: allQuestions.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]]; // swap elements
        }
        
        // Take the first 10 from our shuffled array
        selectedIndices = indices.slice(0, 10);
        
        console.log(`[APP] 🎲 Randomly selected indices: ${JSON.stringify(selectedIndices)}`);
        
        selectedIndices.forEach(index => {
          selectedQuestions.push(allQuestions[index]);
        });
      }
      
      // Track randomization effectiveness
      checkRandomization(selectedIndices);
      
      console.log(`[APP] ✅ Selected ${selectedQuestions.length} questions for this quiz attempt`);
      console.log(`[APP] 🔢 Selected indices: ${JSON.stringify(selectedIndices)}`);
      
      // Create a new quiz object with only the selected questions
      const quizForUser = {
        ...quizQuestions,
        questions: selectedQuestions,
        selectedIndices: selectedIndices,
        totalQuestionsAvailable: questionCount
      };
      
      console.log(`[APP] 🔄 Current PDF ID after quiz generation: ${currentPdfId}`);
      // After quiz generation is complete, verify content storage
      if (currentPdfId || pdfId) {
        console.log(`[APP] 🔍 Automatically verifying content storage for PDF ID: ${currentPdfId || pdfId}`);
        try {
          const verification = await verifyPDFContentStorage(currentPdfId || pdfId);
          
          if (!verification || !verification.success) {
            console.warn("[APP] ⚠️ Content verification failed after quiz generation");
            const toast = document.createElement('div');
            toast.className = 'alert alert-warning';
            toast.innerHTML = '<span>Quiz generated, but content storage verification failed. Database may not have saved the PDF content.</span>';
            const toastContainer = document.querySelector('.toast');
            if (toastContainer) {
              toastContainer.appendChild(toast);
              setTimeout(() => toast.remove(), 5000);
            }
          } else {
            console.log("[APP] ✅ Content storage verified successfully");
          }
        } catch (verifyError) {
          console.error("[APP] ❌ Error verifying content storage:", verifyError);
          // Don't fail the quiz generation process due to verification error
        }
      }

      setQuiz(quizForUser);
      setQuizCompleted(false);
      setScore(0);
      return quizForUser;
    } catch (error) {
      console.error("[APP] ❌ Error generating quiz:", error);
      console.error("[APP] ❌ Error context - Current PDF ID:", currentPdfId || pdfId);
      
      // Show a user-friendly error message
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message || 'Failed to generate quiz. Please try again.'}</span>`;
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
      
      return null;
    } finally {
      console.log('[APP] 🧹 Cleaning up after quiz generation attempt');
      setLoading(false);
      setLoadingMessage("");
      setLoadingProgress("");
    }
  };

  const handleFileUpload = (file) => {
    console.log(`[APP] 📄 File selected: ${file.name}, size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
    // Just store the selected file without uploading
    setSelectedFile(file);
  };

  const handleSubmit = async (shouldGenerateQuiz = false) => {
    console.log(`[APP] 🔄 handleSubmit - shouldGenerateQuiz: ${shouldGenerateQuiz}`);
    
    if (!selectedFile) {
      console.warn('[APP] ⚠️ No file selected for upload');
      return;
    }

    try {
      setLoading(true);
      setLoadingMessage("Uploading PDF to storage...");
      console.log('[APP] 🔄 Starting PDF upload process');
      
      // First upload the file
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;
      console.log(`[APP] 📄 Generated file path for upload: ${filePath}`);

      // Check for duplicate file names
      console.log(`[APP] 🔄 Checking for duplicate file names for user ${user.id}`);
      const { data: existingFiles } = await supabase
        .from('pdfs')
        .select('name')
        .eq('user_id', user.id)
        .eq('name', selectedFile.name);

      if (existingFiles?.length > 0) {
        console.error(`[APP] ❌ File with name "${selectedFile.name}" already exists`);
        throw new Error('A file with this name already exists');
      }
      
      console.log(`[APP] 🔄 No duplicates found, proceeding with upload`);

      // Upload file to Supabase Storage
      console.log(`[APP] 🔄 Starting PDF upload process`);
      const uploadResult = await uploadPDF(selectedFile, filePath);

      if (!uploadResult || !uploadResult.data) {
        console.error('[APP] ❌ Upload failed');
        throw new Error('Failed to upload PDF');
      }

      console.log(`[APP] 🔄 PDF uploaded successfully`);

      // Save metadata to Supabase
      console.log(`[APP] 🔄 Saving metadata to Supabase`);
      const metadata = {
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        user_id: user.id,
        path: uploadResult.data.path,
        file_url: uploadResult.data.publicUrl,
        uploaded_at: new Date().toISOString()
      };
      
      const { data: metadataInsertResult } = await supabase
        .from('pdfs')
        .insert([metadata])
        .returning('*');

      if (!metadataInsertResult || !metadataInsertResult.length) {
        console.error('[APP] ❌ Failed to save metadata');
        throw new Error('Failed to save metadata');
      }

      console.log(`[APP] 🔄 Metadata saved successfully`);

      // Update current PDF ID
      setCurrentPdfId(metadataInsertResult[0].id);
      setView("quiz");
      console.log(`[APP] 🔄 Current PDF ID updated to: ${metadataInsertResult[0].id}`);

      // Generate quiz if requested
      if (shouldGenerateQuiz) {
        console.log(`[APP] 🔄 Generating quiz for new PDF`);
        const generatedQuiz = await generateQuizFromPDF(selectedFile, metadataInsertResult[0].id);
        
        // Make sure we're preserving the selectedIndices from the generated quiz
        if (generatedQuiz && generatedQuiz.selectedIndices) {
          console.log(`[APP] 📊 Using indices from generated quiz: ${JSON.stringify(generatedQuiz.selectedIndices)}`);
        }
      }

      return metadataInsertResult[0].id;
    } catch (error) {
      console.error('[APP] ❌ Error uploading PDF:', error);
      console.error('[APP] ❌ Error context - Current PDF ID:', currentPdfId);
      
      // Show a user-friendly error message
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message || 'Failed to upload PDF. Please try again.'}</span>`;
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
      
      return null;
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const cleanTestContent = async (pdfId) => {
    if (!pdfId) {
      console.error("[APP] ❌ No PDF ID provided to cleanTestContent");
      return false;
    }
    
    try {
      console.log(`[APP] 🧹 Cleaning test/insufficient content for PDF ID: ${pdfId}`);
      const cleanResult = await cleanPDFContent(pdfId);
      
      if (cleanResult.success) {
        if (cleanResult.cleaned) {
          console.log(`[APP] ✅ Successfully cleaned test content for PDF ID: ${pdfId}`);
          const toast = document.createElement('div');
          toast.className = 'alert alert-success';
          toast.innerHTML = `<span>✅ Content cleaned for fresh processing</span>`;
          const toastContainer = document.querySelector('.toast');
          if (toastContainer) {
            toastContainer.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
          }
        } else {
          console.log(`[APP] ℹ️ No cleaning needed for PDF ID: ${pdfId}`);
        }
        return true;
      } else {
        console.error(`[APP] ❌ Failed to clean content: ${cleanResult.error}`);
        return false;
      }
    } catch (error) {
      console.error(`[APP] ❌ Error cleaning content: ${error.message}`);
      return false;
    }
  };

  const handleRestartQuiz = async () => {
    if (selectedFile) {
      try {
        setQuizCompleted(false);
        setLoading(true);
        setLoadingMessage("Restarting quiz...");
        
        // First, if we have a current PDF ID, clean any test/insufficient content
        if (currentPdfId) {
          console.log(`[APP] 🔄 Attempting to clean test content before restart`);
          await cleanTestContent(currentPdfId);
          
          // Reset the question history to get fresh questions
          console.log(`[APP] 🔄 Resetting question history for PDF ID: ${currentPdfId}`);
          resetQuizQuestionHistory(currentPdfId);
          
          // Then verify if we have proper content stored
          const verification = await verifyPDFContentStorage(currentPdfId);
          
          // If content is insufficient (test data or too short), force a refresh
          const forceRefresh = !verification || 
                              !verification.success || 
                              verification.details?.content_length < 500;
          
          console.log(`[APP] 🔄 Restarting quiz with${forceRefresh ? ' forced' : ''} refresh`);
          
          // Generate quiz with forced refresh if needed
          const generatedQuiz = await generateQuizFromPDF(selectedFile, currentPdfId, forceRefresh);
          
          if (generatedQuiz) {
            setView("quiz");
          }
        } else {
          // No PDF ID, always force a fresh generation
          console.log(`[APP] 🔄 Restarting quiz with fresh generation`);
          const generatedQuiz = await generateQuizFromPDF(selectedFile, null, true);
          
          if (generatedQuiz) {
            setView("quiz");
          }
        }
      } catch (error) {
        console.error("[APP] ❌ Error restarting quiz:", error);
        const toast = document.createElement('div');
        toast.className = 'alert alert-error';
        toast.innerHTML = `<span>${error.message || 'Failed to restart quiz. Please try again.'}</span>`;
        const toastContainer = document.querySelector('.toast');
        if (toastContainer) {
          toastContainer.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
        }
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
    }
  };

  const runDatabaseTest = async () => {
    if (!currentPdfId) {
      console.error("[APP] ❌ No PDF ID available for database test");
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>No PDF ID available for database test. Upload a PDF first.</span>';
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
      return;
    }

    try {
      console.log("[APP] 🔄 Running database test with PDF ID:", currentPdfId);
      const result = await testPDFContentStorage(currentPdfId);
      
      if (result.success) {
        console.log("[APP] ✅ Database test successful:", result);
        const toast = document.createElement('div');
        toast.className = 'alert alert-success';
        toast.innerHTML = `<span>Database test successful! Content ID: ${result.contentId}</span>`;
        const toastContainer = document.querySelector('.toast');
        if (toastContainer) {
          toastContainer.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
        }
      } else {
        console.error("[APP] ❌ Database test failed:", result.error);
        const toast = document.createElement('div');
        toast.className = 'alert alert-error';
        toast.innerHTML = `<span>Database test failed: ${result.error}</span>`;
        const toastContainer = document.querySelector('.toast');
        if (toastContainer) {
          toastContainer.appendChild(toast);
          setTimeout(() => toast.remove(), 5000);
        }
      }
    } catch (error) {
      console.error("[APP] ❌ Error running database test:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>Error running database test: ${error.message}</span>`;
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
    }
  };

  const handleStartQuiz = () => {
    if (quiz && quiz.questions && quiz.questions.length > 0) {
      console.log(`[APP] 📊 Starting quiz with existing quiz data`);
      console.log(`[APP] 📊 Total questions available: ${quiz.totalQuestionsAvailable || quiz.questions.length}`);
      
      if (quiz.selectedIndices && quiz.selectedIndices.length > 0) {
        // If we already have selected indices (from a template or previous generation),
        // use those instead of re-randomizing
        console.log(`[APP] 🎲 Using existing selected indices: ${JSON.stringify(quiz.selectedIndices)}`);
        
        // Track randomization effectiveness with existing indices
        checkRandomization(quiz.selectedIndices);
        
        setView("quiz");
      } else {
        // Only randomize if we don't already have selected indices
        console.log(`[APP] 🎲 No existing indices found, selecting random questions`);
        
        // Select 10 random questions for this quiz attempt
        const allQuestions = [...quiz.questions];
        const selectedQuestions = [];
        let selectedIndices = [];
        
        if (allQuestions.length <= 10) {
          // If we have 10 or fewer questions, use all of them
          selectedQuestions.push(...allQuestions);
          selectedIndices = Array.from({ length: allQuestions.length }, (_, i) => i);
          console.log(`[APP] ℹ️ Using all ${allQuestions.length} available questions as there are 10 or fewer`);
        } else {
          // Fisher-Yates shuffle algorithm - more reliable than sort with random
          const indices = Array.from({ length: allQuestions.length }, (_, i) => i);
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]]; // swap elements
          }
          
          // Take the first 10 from our shuffled array
          selectedIndices = indices.slice(0, 10);
          
          console.log(`[APP] 🎲 Randomly selected indices: ${JSON.stringify(selectedIndices)}`);
          
          selectedIndices.forEach(index => {
            selectedQuestions.push(allQuestions[index]);
          });
        }
        
        // Track randomization effectiveness
        checkRandomization(selectedIndices);
        
        console.log(`[APP] ✅ Selected ${selectedQuestions.length} questions for this quiz attempt`);
        console.log(`[APP] 🔢 Selected indices: ${JSON.stringify(selectedIndices)}`);
        
        // Create a new quiz object with only the selected questions
        const quizForUser = {
          ...quiz,
          questions: selectedQuestions,
          selectedIndices: selectedIndices,
          totalQuestionsAvailable: quiz.totalQuestionsAvailable || quiz.questions.length
        };
        
        setQuiz(quizForUser);
        setView("quiz");
      }
    } else {
      console.error("[APP] ❌ Cannot start quiz: No questions available");
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>Cannot start quiz: No questions available. Please try again.</span>';
      const toastContainer = document.querySelector('.toast');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
      }
    }
  };

  return (
    <div className="App">
      {/* Toast container for notifications */}
      <div className="toast toast-end"></div>

      {/* Main application content */}
      {loading ? (
        <Loading message={loadingMessage} progress={loadingProgress} />
      ) : (
        <>
          {!user ? (
            <Login />
          ) : (
            <>
              {view === "dashboard" && (
                <Dashboard 
                  user={user}
                  onStartNewQuiz={() => {
                    setIsUploadModalOpen(true);
                  }}
                  onGenerateFromPDF={async (pdfUrl, pdfId, forceRefresh = false) => {
                    setCurrentPdfId(pdfId);
                    console.log(`[APP] 🔄 Setting current PDF ID to: ${pdfId}`);
                    console.log(`[APP] 🔄 Setting current PDF Url to: ${pdfUrl}`);
                    try {
                      // First, get the actual PDF name from the database
                      const { data: pdfData, error: pdfError } = await supabase
                        .from('pdfs')
                        .select('name')
                        .eq('id', pdfId)
                        .single();
                        
                      if (pdfError) {
                        console.error(`[APP] ❌ Error fetching PDF name: ${pdfError.message}`);
                        throw pdfError;
                      }
                      
                      const pdfName = pdfData?.name || "unknown.pdf";
                      console.log(`[APP] 📄 Using actual PDF name: ${pdfName}`);
                    
                      const response = await fetch(pdfUrl);
                      const blob = await response.blob();
                      // Use the actual PDF name instead of hardcoded name
                      const file = new File([blob], pdfName, { type: blob.type });
                      setSelectedFile(file);
                      const generatedQuiz = await generateQuizFromPDF(file, pdfId, forceRefresh);
                      
                      if (generatedQuiz) {
                        setView("quiz");
                      }
                    } catch (error) {
                      console.error("Error generating quiz from PDF:", error);
                    }
                  }}
                  onLogout={handleLogout}
                />
              )}
              {view === "quiz" && quiz && (
                <Quiz 
                  quizData={quiz} 
                  pdfId={currentPdfId}
                  onQuizComplete={(score, pdfId) => {
                    console.log(`Quiz completed with score ${score} for PDF ${pdfId}`);
                    console.log("Quiz data structure:", quiz);
                    console.log("Selected indices for this quiz:", JSON.stringify(quiz.selectedIndices));
                    setScore(score);
                    setQuizCompleted(true);
                    setView("result");
                    
                    // Save quiz result to database
                    if (pdfId) {
                      // Get the question indices that were actually used
                      // If we have metadata with original template indices, use those instead of the UI indices
                      let questionIndices = quiz.selectedIndices || [];
                      
                      // If we have metadata with original template indices, use those for storage
                      // This ensures we're tracking which template questions were actually used
                      if (quiz.metadata && quiz.metadata.templateSelectedIndices) {
                        questionIndices = quiz.metadata.templateSelectedIndices;
                        console.log("Using template indices from metadata:", JSON.stringify(questionIndices));
                      }
                      
                      console.log("Saving actual question indices that were used:", JSON.stringify(questionIndices));
                      
                      const quizData = {
                        user_id: user.id,
                        pdf_id: pdfId,
                        pdf_name: selectedFile?.name || "Unknown",
                        score: score,
                        correct_answers: score,
                        total_questions: 10,
                        template_id: quiz.templateId,
                        selected_question_indices: questionIndices
                      };
                      
                      // Add any additional metadata if it exists (like original indices)
                      if (quiz.metadata) {
                        quizData.metadata = { ...quiz.metadata };
                      }
                      
                      console.log("Saving quiz result with indices:", JSON.stringify(quizData.selected_question_indices));
                      
                      saveQuizResult(quizData)
                        .then(result => {
                          console.log("Quiz result saved successfully:", result);
                        })
                        .catch(error => {
                          console.error("Error saving quiz result:", error);
                        });
                    } else {
                      console.error("Cannot save quiz result: No PDF ID provided");
                    }
                  }}
                />
              )}
              {view === "result" && quizCompleted && (
                <Result 
                  score={score} 
                  onRestart={handleRestartQuiz}
                  onUploadNew={() => {
                    setView("dashboard");
                    setIsUploadModalOpen(true);
                  }}
                />
              )}
              {isUploadModalOpen && (
                <UploadModal 
                  isOpen={isUploadModalOpen}
                  onClose={() => setIsUploadModalOpen(false)}
                  onFileUpload={handleFileUpload}
                  onSubmit={handleSubmit}
                  selectedFile={selectedFile}
                  isLoading={loading}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Restart App button */}
      <RestartApp />
    </div>
  );
}

export default App;
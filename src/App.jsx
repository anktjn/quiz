import { useState, useEffect } from "react";
import Quiz from "./components/Quiz";
import { extractTextFromPDF } from "./utils/pdf";
import { generateQuizQuestions } from "./utils/openai";
import { AnimatePresence, motion } from 'framer-motion';
import Result from "./components/Results";
import Loading from "./components/Loading";
import RestartApp from "./components/RestartApp";
import { uploadPDF } from "./utils/uploadPDF";
import { savePDFMetadata } from "./utils/pdfService";
import Login from "./components/Login";
import { supabase } from "./utils/supabase";
import Dashboard from "./components/Dashboard";
import UploadModal from "./components/UploadModal";

function App() { 
  const [currentPdfId, setCurrentPdfId] = useState(null);
  const [view, setView] = useState("dashboard"); // or "quiz", "result"
  const [user, setUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pdfs, setPdfs] = useState([]);

  useEffect(() => {
    console.log("📄 Current PDF ID changed:", currentPdfId);
  }, [currentPdfId]);

  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user || null);
    };
    getSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null);
      }
    );
    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Set the theme on mount
    document.documentElement.setAttribute('data-theme', 'corporateecho');
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setView("dashboard");
    setSelectedFile(null);
    setQuiz(null);
    setScore(0);
    setQuizCompleted(false);
  };

  const generateQuizFromPDF = async (file) => {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>OpenAI API key is not configured. Please check your environment variables.</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
      return null;
    }

    setLoading(true);
    try {
      const pdfText = await extractTextFromPDF(file);
      if (!pdfText || pdfText.trim().length === 0) {
        throw new Error('Could not extract text from PDF. Please make sure the PDF contains readable text.');
      }

      const quizQuestions = await generateQuizQuestions(pdfText);
      if (!quizQuestions || quizQuestions.length === 0) {
        throw new Error('Failed to generate quiz questions. Please try again.');
      }

      setQuiz(quizQuestions);
      setQuizCompleted(false);
      setScore(0);
      return quizQuestions;
    } catch (error) {
      console.error("Error generating quiz:", error);
      
      // Show a user-friendly error message
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message || 'Failed to generate quiz. Please try again.'}</span>`;
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
      
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file) => {
    // Just store the selected file without uploading
    setSelectedFile(file);
  };

  const handleSubmit = async (shouldGenerateQuiz = false) => {
    if (!selectedFile) return;

    try {
      setLoading(true);
      
      // First upload the file
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Check for duplicate file names
      const { data: existingFiles } = await supabase
        .from('pdfs')
        .select('name')
        .eq('user_id', user.id)
        .eq('name', selectedFile.name);

      if (existingFiles?.length > 0) {
        const toast = document.createElement('div');
        toast.className = 'alert alert-warning';
        toast.innerHTML = '<span>A file with this name already exists</span>';
        document.querySelector('.toast').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        return;
      }

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdfs')
        .getPublicUrl(filePath);

      // Save PDF metadata to database
      const { data: pdfData, error: dbError } = await supabase
        .from('pdfs')
        .insert([
          {
            name: selectedFile.name,
            file_url: publicUrl,
            user_id: user.id,
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Update the PDFs list
      setPdfs((prevPdfs) => [...prevPdfs, pdfData]);

      // Show success message
      const toast = document.createElement('div');
      toast.className = 'alert alert-success';
      toast.innerHTML = '<span>PDF uploaded successfully!</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // If we should generate a quiz
      if (shouldGenerateQuiz) {
        const quiz = await generateQuizFromPDF(selectedFile);
        if (quiz) {
          setView('quiz');
          setCurrentPdfId(pdfData.id);
        }
      } else {
        setIsUploadModalOpen(false);
      }
    } catch (error) {
      console.error('Error:', error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message || 'Failed to upload PDF. Please try again.'}</span>`;
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRestartQuiz = async () => {
    if (selectedFile) {
      setQuizCompleted(false);
      await generateQuizFromPDF(selectedFile);
      // Note: We don't need to reset currentPdfId here since we want to keep it
    }
  };

  const handleUploadNewPDF = () => {
    setQuizCompleted(false);
    setQuiz(null);
    setSelectedFile(null);
    setScore(0);
    setCurrentPdfId(null);
  };

  const handleQuizComplete = async (finalScore, pdfId) => {
    if (!pdfId) {
      console.error("⚠️ No currentPdfId set. Cannot save quiz.");
      return;
    }
  
    console.log("🎯 Submitting quiz result with pdfId:", pdfId);
    setScore(finalScore); // Set the score before marking as completed
  
    const { error } = await supabase.from("quizzes").insert({
      user_id: user.id,
      pdf_id: pdfId,
      pdf_name: selectedFile.name,
      score: finalScore,
      date_taken: new Date(),
    });
  
    if (error) {
      console.error("❌ Failed to save quiz:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>Failed to save quiz result. Please try again.</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } else {
      console.log("✅ Quiz saved to Supabase");
      setQuizCompleted(true);
    }
  };

  const handlePlayQuiz = async (pdfUrl, pdfId) => {
    setLoading(true);
    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch PDF file');
      }

      const blob = await response.blob();
      const file = new File([blob], "quiz-pdf.pdf", { type: "application/pdf" });
      setSelectedFile(file);
      setCurrentPdfId(pdfId);

      const quiz = await generateQuizFromPDF(file);
      if (quiz) {
        setView("quiz");
      } else {
        setView("dashboard");
      }
    } catch (error) {
      console.error("Error playing quiz:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message || 'Failed to start quiz. Please try again.'}</span>`;
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 5000);
    } finally {
      setLoading(false);
    }
  };
  
  if (!user) return <Login />;

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-screen" data-theme="corporateecho">
      <RestartApp />

      {loading && <Loading />}

      {!loading && view === "dashboard" && (
        <Dashboard 
          user={user} 
          onStartNewQuiz={() => setIsUploadModalOpen(true)} 
          onGenerateFromPDF={async (pdfUrl, pdfId) => {
            setLoading(true);
            try {
              const response = await fetch(pdfUrl);
              const blob = await response.blob();
              const file = new File([blob], "from-dashboard.pdf", { type: blob.type });
              setSelectedFile(file);
              setCurrentPdfId(pdfId);
              await generateQuizFromPDF(file);
              setView("quiz");
            } catch (error) {
              console.error("Error generating quiz:", error);
            } finally {
              setLoading(false);
            }
          }}
          onLogout={handleLogout}
        />
      )}

      {!loading && view === "quiz" && (
        <AnimatePresence mode="wait">
          <div className="relative">
            {quiz && !quizCompleted && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Quiz 
                  quizData={quiz} 
                  onQuizComplete={handleQuizComplete}
                  pdfId={currentPdfId}
                  key={currentPdfId}
                />
              </motion.div>
            )}
            {quizCompleted && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Result 
                  score={score} 
                  onRestart={handleRestartQuiz} 
                  onUploadNew={() => {
                    handleUploadNewPDF();
                    setIsUploadModalOpen(true);
                  }} 
                />
                <div className="flex justify-center mt-6">
                  <button className="btn btn-neutral" onClick={() => setView("dashboard")}>Back to Dashboard</button>
                </div>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      )}

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onFileUpload={handleFileUpload}
        selectedFile={selectedFile}
        onSubmit={handleSubmit}
        isLoading={loading}
      />

      <div className="toast toast-top toast-end z-50 fixed">
        {/* We will dynamically inject toasts */}
      </div>
    </div>
  );
}

export default App;

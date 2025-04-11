import { useState, useEffect } from "react";
import Upload from "./components/Upload";
import Quiz from "./components/Quiz";
import { extractTextFromPDF } from "./utils/pdf";
import { generateQuizQuestions } from "./utils/openai";
import ThemeSwitcher from "./components/ThemeSwitcher";
import { AnimatePresence, motion } from 'framer-motion';
import Result from "./components/Results";
import Loading from "./components/Loading";
import RestartApp from "./components/RestartApp";
import { uploadPDF } from "./utils/uploadPDF";
import { savePDFMetadata } from "./utils/pdfService";
import Login from "./components/Login";
import { supabase } from "./utils/supabase";
import Dashboard from "./components/Dashboard";

function App() { 
  const [currentPdfId, setCurrentPdfId] = useState(null);
  const [view, setView] = useState("dashboard"); // or "upload", "quiz", "result"
  const [user, setUser] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);



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
    setLoading(true);
    const pdfText = await extractTextFromPDF(file);
    const quizQuestions = await generateQuizQuestions(pdfText);
    setQuiz(quizQuestions);
    setQuizCompleted(false);
    setScore(0);
    setLoading(false);
  };

  const handleFileUpload = (file) => {
    setSelectedFile(file);
    console.log("📥 File selected:", file); // optional, but keep it clear
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
  
    setLoading(true);
    try {
      // 🔍 Check for duplicates
      const { data: matches, error: checkError } = await supabase
        .from("pdfs")
        .select("*")
        .eq("user_id", user.id)
        .eq("name", selectedFile.name);
  
      if (checkError) throw checkError;
  
      if (matches.length > 0) {
        // ✅ Show DaisyUI toast
        const toastContainer = document.querySelector(".toast");
        const toast = document.createElement("div");
        toast.className = "alert alert-warning text-sm";
        toast.innerHTML = `<span>📚 This book already exists. Redirecting...</span>`;
        toastContainer.appendChild(toast);
  
        setTimeout(() => {
          toast.remove();
        }, 3000);
  
        setView("dashboard");
        return;
      }
  
      // 📤 Upload file
      const fileUrl = await uploadPDF(selectedFile);
  
      // 💾 Save metadata
      const metadata = await savePDFMetadata({
        name: selectedFile.name,
        file_url: fileUrl,
        user_id: user.id,
      });
  
      setCurrentPdfId(metadata.id);
  
      await generateQuizFromPDF(selectedFile);
      setView("quiz");
  
    } catch (error) {
      console.error("❌ Error uploading PDF or checking duplicates:", error);
  
      // ❌ Error toast
      const toastContainer = document.querySelector(".toast");
      const toast = document.createElement("div");
      toast.className = "alert alert-error text-sm";
      toast.innerHTML = `<span>Something went wrong while uploading.</span>`;
      toastContainer.appendChild(toast);
  
      setTimeout(() => {
        toast.remove();
      }, 3000);
    } finally {
      setLoading(false);
    }
  };
  
  
  
  
  
  
  
  

  const handleRestartQuiz = async () => {
    if (selectedFile) {
      await generateQuizFromPDF(selectedFile);
    }
  };

  const handleUploadNewPDF = () => {
    setQuizCompleted(false);
    setQuiz(null);
    setSelectedFile(null);
    setScore(0);
  };


  const handleQuizComplete = async (finalScore, pdfId) => {
    if (!pdfId) {
      console.error("⚠️ No currentPdfId set. Cannot save quiz.");
      return;
    }
  
    console.log("🎯 Submitting quiz result with pdfId:", pdfId);
  
    const { error } = await supabase.from("quizzes").insert({
      user_id: user.id,
      pdf_id: pdfId,
      pdf_name: selectedFile.name,
      score: finalScore,
      date_taken: new Date(),
    });
  
    if (error) {
      console.error("❌ Failed to save quiz:", error);
    } else {
      console.log("✅ Quiz saved to Supabase");
      setQuizCompleted(true);
    }
  };
  
  
  
  
  
  
  
  
  

  if (!user) return <Login />;

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-screen">
      <ThemeSwitcher />
      <button onClick={handleLogout} className="absolute bottom-4 right-4 btn btn-accent">
        Logout
      </button>
      <RestartApp />

      {view === "dashboard" && <Dashboard user={user} onStartNewQuiz={() => setView("upload")} onGenerateFromPDF={async (pdfUrl) => {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const file = new File([blob], "from-dashboard.pdf", { type: blob.type });
        setSelectedFile(file);
        await generateQuizFromPDF(file);
        setView("quiz");
      }} />}

      {view === "upload" && (
        <AnimatePresence mode="wait">
          <div className="relative"> 
            {!quiz && !quizCompleted && !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Upload onFileUpload={handleFileUpload} selectedFile={selectedFile} onSubmit={handleSubmit} />
              </motion.div>
            )}
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Loading />
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      )}

      {view === "quiz" && (
        <AnimatePresence mode="wait">
          <div className="relative">
            {quiz && !quizCompleted && (
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -100, opacity: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Quiz quizData={quiz} onQuizComplete={handleQuizComplete}
                pdfId={currentPdfId} 
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
                    setView("upload");
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
        <div className="toast toast-top toast-end z-50 fixed">
        {/* We will dynamically inject toasts */}
        </div>
    </div>
  );
}

export default App;

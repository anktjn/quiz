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
  const [currentPDFId, setCurrentPDFId] = useState(null);
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
    console.log("✅ PDF Uploaded:", file);
  };

  const handleSubmit = async () => {
    if (selectedFile) {
      setLoading(true);
      try {
        const fileUrl = await uploadPDF(selectedFile);
        console.log("✅ PDF uploaded to Supabase Storage successfully, URL:", fileUrl);
  
        const savedPDF = await savePDFMetadata({
          name: selectedFile.name,
          file_url: fileUrl,
          user_id: user.id,
        });
  
        setCurrentPDFId(savedPDF.id); // 💾 save the id for later
        await generateQuizFromPDF(selectedFile);
        setView("quiz");
      } catch (error) {
        console.error("❌ Error uploading PDF or saving metadata:", error);
      } finally {
        setLoading(false);
      }
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


  const handleQuizComplete = async (finalScore) => {
    setScore(finalScore);
    setQuizCompleted(true);
    console.log("🎯 Submitting quiz result...");
  
    const { error } = await supabase.from("quizzes").insert([
      {
        user_id: user.id,
        score: finalScore,
        date_taken: new Date(),
        questions: JSON.stringify(quiz.questions),
        pdf_name: selectedFile?.name,
        pdf_id: currentPDFId, // ✅ this matches your foreign key
      },
    ]);
  
    if (error) {
      console.error("❌ Failed to save quiz:", error.message);
    } else {
      console.log("✅ Quiz saved to Supabase");
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
                <Quiz quizData={quiz} onQuizComplete={handleQuizComplete} />
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
    </div>
  );
}

export default App;

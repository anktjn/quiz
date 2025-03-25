import { useState } from "react";
import Upload from "./components/Upload";
import Quiz from "./components/Quiz";
import { extractTextFromPDF } from "./utils/pdf";
import { generateQuizQuestions } from "./utils/openai";
import ThemeSwitcher from "./components/ThemeSwitcher";
import { AnimatePresence, motion } from 'framer-motion';
import Result from "./components/Results";
import Loading from "./components/Loading";
function App() { 
  const [selectedFile, setSelectedFile] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);

  const handleFileUpload = (file) => {
    setSelectedFile(file);
    console.log("✅ PDF Uploaded:", file);
  };

  const handleSubmit = async () => {
    if (selectedFile) {
      setLoading(true);
      console.log("📤 Extracting text...");
      const pdfText = await extractTextFromPDF(selectedFile);

      console.log("📚 Generating quiz...");
      const quizQuestions = await generateQuizQuestions(pdfText);

      console.log("🎉 Quiz generated:", quizQuestions);
      setQuiz(quizQuestions);
      setLoading(false);
    }
  };
  const handleRestartQuiz = () => {
    setQuizCompleted(false);
    setQuiz(null);
    setScore(0);
  };
  
  const handleUploadNewPDF = () => {
    setQuizCompleted(false);
    setQuiz(null);
    setSelectedFile(null);
    setScore(0);
  };
  
  const handleQuizComplete = (finalScore) => {
    setScore(finalScore);
    setQuizCompleted(true);
  };

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-screen">
      <ThemeSwitcher />
      <AnimatePresence mode="wait">
      {!quiz && !quizCompleted && !loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Upload onFileUpload={handleFileUpload} selectedFile={selectedFile} />
          {selectedFile && (
            <button
              onClick={handleSubmit}
              className="btn btn-primary w-full mt-5"
            >
              Generate Quiz 🚀
            </button>
          )}
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
        onUploadNew={handleUploadNewPDF} 
      />
        <div className="flex gap-4 justify-center mt-6">
          <button className="btn btn-accent" onClick={() => window.location.reload()}>
            🔄 Restart Quiz
          </button>
          <button className="btn btn-neutral" onClick={() => window.location.reload()}>
            📚 Upload New PDF
          </button>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

export default App;

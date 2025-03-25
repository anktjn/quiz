import { useState } from "react";
import Upload from "./components/Upload";
import Quiz from "./components/Quiz";
import { extractTextFromPDF } from "./utils/pdf";
import { generateQuizQuestions } from "./utils/openai";
import ThemeSwitcher from "./components/ThemeSwitcher";
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

  const handleQuizComplete = (finalScore) => {
    setScore(finalScore);
    setQuizCompleted(true);
  };

  return (
    <div className="container mx-auto flex flex-col items-center justify-center min-h-screen">
      <ThemeSwitcher />
      {!quiz && !quizCompleted && (
        <>
          <Upload
            onFileUpload={handleFileUpload}
            selectedFile={selectedFile}
          />
          {selectedFile && (
            <button
              onClick={handleSubmit}
              className="btn btn-primary mt-5"
              disabled={loading}
            >
              {loading ? "Generating Quiz..." : "Submit PDF"}
            </button>
          )}
        </>
      )}

      {quiz && !quizCompleted && (
        <Quiz quizData={quiz} onQuizComplete={handleQuizComplete} />
      )}

      {quizCompleted && (
        <div className="card bg-base-100 shadow-xl p-8 text-center">
        <h2 className="text-3xl font-bold text-primary">🎉 Quiz Complete!</h2>
        <p className="mt-4 text-xl">
          You scored <span className="font-bold">{score}/10</span>!
        </p>
      
        <div className="flex gap-4 justify-center mt-6">
          <button className="btn btn-accent" onClick={() => window.location.reload()}>
            🔄 Restart Quiz
          </button>
          <button className="btn btn-neutral" onClick={() => window.location.reload()}>
            📚 Upload New PDF
          </button>
        </div>
      </div>
      
      )}
    </div>
  );
}

export default App;

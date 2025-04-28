import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';
import { resetQuizQuestionHistory } from "../utils/quizTemplateService";

const Quiz = ({ quizData, onQuizComplete, pdfId }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60); // 60-second timer per question

  // Log pdfId when component mounts or pdfId changes
  useEffect(() => {
    console.log("📚 Quiz mounted/updated with pdfId:", pdfId);
    console.log("📚 Quiz data structure:", quizData);
    console.log("📚 Selected indices for this quiz:", JSON.stringify(quizData.selectedIndices || []));
    
    // Also log template indices if they exist
    if (quizData.metadata && quizData.metadata.templateSelectedIndices) {
      console.log("📚 Original template indices:", JSON.stringify(quizData.metadata.templateSelectedIndices));
    }
    
    // Reset state when quiz data changes
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setTimeLeft(60);
  }, [pdfId, quizData]);

  // Get questions array from quiz data (now always in a consistent format)
  const questions = quizData.questions || [];

  if (questions.length === 0) {
    return (
      <div className="card shadow-xl bg-base-100 p-6 w-[600px] text-center">
        <h2 className="text-xl font-bold text-error">Quiz Error</h2>
        <p className="my-4">No valid questions found in the quiz data.</p>
        <p className="text-sm opacity-70">Try refreshing or selecting a different PDF.</p>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  // Determine if we're using "options" or "choices" for answer options
  const answerOptions = currentQuestion.options || currentQuestion.choices || [];
  // Determine if we're using "answer" or "correctAnswer" for correct answer index
  const correctAnswerIndex = typeof currentQuestion.answer !== 'undefined' ? 
                            currentQuestion.answer : currentQuestion.correctAnswer;

  useEffect(() => {
    setTimeLeft(60); // Reset timer on question change
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [currentQuestionIndex]);

  useEffect(() => {
    if (timeLeft === 0) handleNextQuestion();
  }, [timeLeft]);

  const handleAnswerSelection = (choice) => {
    setSelectedAnswer(choice);
  };

  const handleNextQuestion = () => {
    if (!pdfId) {
      console.error("⚠️ Quiz component: No pdfId available for quiz completion");
    }

    // Calculate current question's score
    const currentQuestionScore = selectedAnswer === answerOptions[correctAnswerIndex] ? 1 : 0;
    const newScore = score + currentQuestionScore;
    
    if (currentQuestionIndex < questions.length - 1) {
      setScore(newScore);
      setSelectedAnswer(null);
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      console.log("🎯 Quiz completed. Submitting score:", newScore, "for pdfId:", pdfId);
      console.log("🎯 Selected question indices (UI):", JSON.stringify(quizData.selectedIndices || []));
      
      // Also log template indices if they exist
      if (quizData.metadata && quizData.metadata.templateSelectedIndices) {
        console.log("🎯 Original template indices that will be saved:", JSON.stringify(quizData.metadata.templateSelectedIndices));
      }
      
      // Don't reset question history after quiz completion so we can track which
      // questions are being used over time - this ensures better randomization!
      onQuizComplete(newScore, pdfId);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="card shadow-xl bg-base-100 p-6 w-[600px] mx-auto">
       <AnimatePresence mode="wait">
       <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            transition={{ duration: 0.4 }}
            className="card bg-base-100 shadow-xl p-6 w-full max-w-2xl"
          >
       <div className="text-center mb-5">
        <h2 className="text-xl font-semibold">Question {currentQuestionIndex + 1}/{questions.length}</h2>
        <progress
          className="progress progress-primary w-full my-2"
         value={currentQuestionIndex + 1}
         max={questions.length}
        >
        </progress>
      </div>
      <motion.h3
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="text-2xl font-bold mb-4 text-center"
      >
      {currentQuestion.question}
      </motion.h3>
      <div className="grid grid-cols-1 gap-4">
      {answerOptions.map((choice, idx) => (
        <motion.button
          key={idx}
          className={`btn ${
            selectedAnswer === choice ? "btn-primary" : "btn-outline"
          }`}
          initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
            onClick={() => handleAnswerSelection(choice)}
        >
          {choice}
        </motion.button>
      ))}
      </div>

     <div className="mt-6 text-center font-semibold">
      ⏰ {timeLeft}s remaining
      </div>
      <motion.button
      className="btn btn-success mt-4 w-full"
      onClick={handleNextQuestion}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      disabled={!selectedAnswer}
      >
      Next Question →
      </motion.button>
      </motion.div>
      </AnimatePresence>
    </div>
    </div>
  );
};

export default Quiz;

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from 'framer-motion';

const Quiz = ({ quizData, onQuizComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(60); // 60-second timer per question

  const currentQuestion = quizData.questions[currentQuestionIndex];

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
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(score + 1);
    }
    setSelectedAnswer(null);

    if (currentQuestionIndex < quizData.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      onQuizComplete(score + (selectedAnswer === currentQuestion.correctAnswer ? 1 : 0));
    }
  };

  return (
    <div className="card shadow-xl bg-base-100 p-6 w-[600px]">
     <AnimatePresence mode="wait">
     <motion.div
          key={currentQuestionIndex}  // 👈 clearly changing key triggers re-animation
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.4 }}
          className="card bg-base-100 shadow-xl p-6 w-full max-w-2xl"
        >
     <div className="text-center mb-5">
      <h2 className="text-xl font-semibold">Question {currentQuestionIndex + 1}/10</h2>
      <progress
        className="progress progress-primary w-full my-2"
       value={currentQuestionIndex + 1}
       max="10"
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
    {currentQuestion.choices.map((choice, idx) => (
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
  );
};

export default Quiz;

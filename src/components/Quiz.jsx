import { useState, useEffect } from "react";

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
    <div className="card shadow-xl bg-base-100 p-6 w-full max-w-2xl">
  <div className="text-center mb-5">
    <h2 className="text-xl font-semibold">Question {currentQuestionIndex + 1}/10</h2>
    <progress
      className="progress progress-primary w-full my-2"
      value={currentQuestionIndex + 1}
      max="10"
    ></progress>
  </div>

  <h3 className="text-2xl font-bold mb-4 text-center">{currentQuestion.question}</h3>

  <div className="grid grid-cols-1 gap-4">
    {currentQuestion.choices.map((choice, idx) => (
      <button
        key={idx}
        className={`btn ${
          selectedAnswer === choice ? "btn-primary" : "btn-outline"
        }`}
        onClick={() => handleAnswerSelection(choice)}
      >
        {choice}
      </button>
    ))}
  </div>

  <div className="mt-6 text-center font-semibold">
    ⏰ {timeLeft}s remaining
  </div>

  <button
    className="btn btn-success mt-4"
    onClick={handleNextQuestion}
    disabled={!selectedAnswer}
  >
    Next Question →
  </button>
</div>


  );
};

export default Quiz;

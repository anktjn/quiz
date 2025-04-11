import { Repeat } from "lucide-react";
import { motion } from "framer-motion";

export default function QuizCard({ quiz }) {
  return (
    <motion.div
      className="card bg-base-100 shadow p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-semibold mb-1">{quiz.pdf_name}</h3>
      <p className="text-sm text-gray-500">Score: {quiz.score}/10</p>
      <p className="text-sm text-gray-400">
        {new Date(quiz.date_taken).toLocaleString()}
      </p>
      <button className="btn btn-sm btn-secondary mt-3">
        <Repeat className="w-4 h-4 mr-2" /> Retake Quiz
      </button>
    </motion.div>
  );
}

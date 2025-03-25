import { motion } from 'framer-motion';

const Result = ({ score, onRestart, onUploadNew }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        className="card bg-base-200 shadow-xl p-10 text-center"
      >
        <motion.h1
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-4xl font-bold text-primary mb-4"
        >
          🎉 Congratulations!
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xl mb-6"
        >
          You've completed the quiz with a score of:
        </motion.p>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
          className="text-5xl font-bold text-accent mb-6"
        >
          {score}/10
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="flex gap-4 justify-center"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRestart}
            className="btn btn-primary"
          >
            🔄 Restart Quiz
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onUploadNew}
            className="btn btn-neutral"
          >
            📚 Upload New PDF
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Result;

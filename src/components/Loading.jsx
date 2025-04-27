import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const Loading = ({ message, progressInfo }) => {
  const [funFacts, setFunFacts] = useState([]);
  const [currentFact, setCurrentFact] = useState("");

  // Fun facts and interesting messages based on what's happening
  const processMessages = {
    "Processing PDF...": [
      "Opening your document...",
      "Scanning through pages...",
      "Analyzing document structure..."
    ],
    "Extracting text from PDF...": [
      "Reading chapter introductions...",
      "Digging into key concepts...",
      "Exploring important definitions...",
      "Identifying core principles..."
    ],
    "Generating quiz questions...": [
      "Finding challenging concepts...",
      "Creating thought-provoking questions...",
      "Balancing difficulty levels...",
      "Crafting multiple-choice options...",
      "Making sure questions are fair but challenging..."
    ],
    "Uploading PDF to storage...": [
      "Securely storing your document...",
      "Creating a backup for future reference..."
    ],
    "Fetching book cover...": [
      "Finding the perfect visual representation...",
      "Getting the book cover to help you recognize it later..."
    ],
    "Saving PDF information...": [
      "Recording document details...",
      "Organizing information for your future reference..."
    ],
    "Preparing PDF for quiz...": [
      "Setting up the perfect quiz environment...",
      "Getting everything ready for your learning experience..."
    ]
  };

  useEffect(() => {
    // Reset facts when message changes
    if (message && processMessages[message]) {
      setFunFacts(processMessages[message]);
    }
  }, [message]);

  useEffect(() => {
    // Rotate through fun facts
    if (funFacts.length > 0) {
      const interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * funFacts.length);
        setCurrentFact(funFacts[randomIndex]);
      }, 3000);
      
      // Set initial fact
      setCurrentFact(funFacts[0]);
      
      return () => clearInterval(interval);
    }
  }, [funFacts]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-100">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
        className="mb-6"
      >
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
        className="text-xl font-semibold"
      >
        {message || "Creating your quiz..."}
      </motion.h2>

      {currentFact && (
        <motion.div
          key={currentFact}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="mt-2 text-center text-sm text-gray-600 italic max-w-md"
        >
          "{currentFact}"
        </motion.div>
      )}

      {progressInfo && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center"
        >
          <div className="text-sm text-gray-600 mb-2">{progressInfo}</div>
          <progress className="progress progress-primary w-56"></progress>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
        className="text-sm mt-4 text-gray-500"
      >
        This might take a few moments
      </motion.p>
    </div>
  );
};

export default Loading;

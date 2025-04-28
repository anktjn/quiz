import { motion } from "framer-motion";
import { useState, useEffect } from "react";

const Loading = ({ message, progressInfo }) => {
  const [funFacts, setFunFacts] = useState([]);
  const [currentFact, setCurrentFact] = useState("");
  
  // Parse progress information if available
  const progressDetails = progressInfo && typeof progressInfo === 'object' ? progressInfo : {};
  const { 
    step,
    totalSteps, 
    currentChunk, 
    totalChunks,
    percentComplete
  } = progressDetails;

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
    ],
    "Processing chunks...": [
      "Breaking down content into digestible pieces...",
      "Analyzing each section carefully...",
      "Processing information chunk by chunk..."
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

  // Format the progress text based on available information
  const getProgressText = () => {
    if (!progressDetails) return null;
    
    let progressText = "";
    
    if (step && totalSteps) {
      progressText += `Step ${step} of ${totalSteps}`;
    }
    
    if (currentChunk && totalChunks) {
      progressText += progressText ? " - " : "";
      progressText += `Chunk ${currentChunk} of ${totalChunks}`;
    }
    
    return progressText;
  };

  // Calculate progress percentage for the progress bar
  const calculateProgress = () => {
    if (percentComplete !== undefined) {
      return percentComplete;
    }
    
    if (step && totalSteps) {
      const stepProgress = step / totalSteps;
      
      if (currentChunk && totalChunks) {
        const chunkProgressInStep = (currentChunk / totalChunks) / totalSteps;
        return (stepProgress - (1/totalSteps)) + chunkProgressInStep;
      }
      
      return stepProgress;
    }
    
    if (currentChunk && totalChunks) {
      return currentChunk / totalChunks;
    }
    
    return undefined;
  };

  const progressPercentage = calculateProgress();
  const progressText = getProgressText();

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

      {progressText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-center"
        >
          <div className="text-sm text-gray-600 mb-2">{progressText}</div>
          <progress 
            className="progress progress-primary w-56" 
            value={progressPercentage !== undefined ? progressPercentage * 100 : undefined} 
            max="100"
          ></progress>
        </motion.div>
      )}

      {typeof progressInfo === 'string' && (
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

import { motion } from "framer-motion";

const RestartApp = () => {
  const handleRestart = () => {
    window.location.reload(); // This reloads the entire app to initial state
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-4 left-4 btn btn-error btn-sm shadow-lg"
      onClick={handleRestart}
    >
      🔄 Restart App
    </motion.button>
  );
};

export default RestartApp;

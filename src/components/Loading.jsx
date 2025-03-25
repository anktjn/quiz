import { motion } from "framer-motion";

const Loading = () => {
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
        Creating your quiz...
      </motion.h2>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
        className="text-sm mt-2 text-gray-500"
      >
        This might take a few moments
      </motion.p>
    </div>
  );
};

export default Loading;

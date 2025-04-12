import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";

const UploadModal = ({ isOpen, onClose, onFileUpload, selectedFile, onSubmit, isLoading }) => {
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    await onSubmit(false);
    onClose();
  };

  const handleSaveAndGenerate = async () => {
    if (!selectedFile) return;
    await onSubmit(true);
  };

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div 
          className="modal modal-open"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            className="modal-box relative w-11/12 max-w-md"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button 
              onClick={onClose}
              className="btn btn-ghost btn-sm absolute right-4 top-4"
              disabled={isLoading}
            >
              <X size={20} /> 
            </button>

            <div className="flex flex-col items-left text-left">
              <h3 className="font-bold text-lg mb-4">Upload New PDF</h3>
              <p className="py-2">Upload a PDF document to generate a quiz</p>
              
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="file-input file-input-bordered file-input-primary w-full"
                disabled={isLoading}
              />

              {selectedFile && (
                <motion.div 
                  className="mt-8 w-full"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-row gap-2 w-full">
                    <button 
                      onClick={handleSave} 
                      className="btn btn-secondary flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : "Save PDF"}
                    </button>
                    <button 
                      onClick={handleSaveAndGenerate} 
                      className="btn btn-primary flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : "Save & Generate Quiz"}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UploadModal; 
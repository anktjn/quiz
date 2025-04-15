import { useState } from "react";
import { motion } from "framer-motion";
import { X, RefreshCw } from "lucide-react";
import { updatePDFCover } from "../utils/bookCovers";
import { supabase } from "../utils/supabase";

export default function UpdateCoverModal({ isOpen, onClose, pdf, onSuccess, onCoverUpdated }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleUpdateCover = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await updatePDFCover(pdf.id, pdf.name);
      
      if (result.success) {
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'alert alert-success';
        toast.innerHTML = '<span>Book cover updated successfully!</span>';
        document.querySelector('.toast').appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
        
        // Update parent component state directly
        if (onSuccess) onSuccess(result.coverUrl);
        
        // Refresh data in Dashboard if needed
        if (onCoverUpdated) await onCoverUpdated(pdf.id);
        
        onClose();
      } else {
        // If no cover was found, clear the current cover to use initials
        const { error } = await supabase
          .from('pdfs')
          .update({ cover_url: null })
          .eq('id', pdf.id);
          
        if (error) {
          setError('Failed to clear cover: ' + error.message);
        } else {
          // Update parent component state to null (will use initials)
          if (onSuccess) onSuccess(null);
          
          // Refresh data in Dashboard
          if (onCoverUpdated) await onCoverUpdated(pdf.id);
          
          // Show message
          const toast = document.createElement('div');
          toast.className = 'alert alert-info';
          toast.innerHTML = '<span>No cover found. Using book initials instead.</span>';
          document.querySelector('.toast').appendChild(toast);
          setTimeout(() => toast.remove(), 3000);
          
          onClose();
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to update cover');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-backdrop" onClick={onClose}></div>
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
          <h3 className="font-bold text-lg mb-4">Update Book Cover</h3>
          <p className="py-2">
            Update the cover image for "{pdf.name.replace('.pdf', '')}"? 
            The system will search for an appropriate cover based on the book title.
          </p>
          
          {error && (
            <div className="alert alert-error mb-4">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <button 
              className="btn btn-ghost" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button 
              className={`btn btn-primary ${isLoading ? 'loading' : ''}`} 
              onClick={handleUpdateCover}
              disabled={isLoading}
            >
              {!isLoading && <RefreshCw size={16} className="mr-2" />}
              Update Cover
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
} 
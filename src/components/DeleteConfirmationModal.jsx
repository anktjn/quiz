import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, bookName, isLoading }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="modal modal-open">
          <div className="modal-box relative">
            <button 
              onClick={onClose}
              className="btn btn-ghost btn-sm absolute right-4 top-4"
              disabled={isLoading}
            >
              <X size={20} /> 
            </button>

            <h3 className="font-bold text-lg mb-4">Delete Book</h3>
            <p className="py-2">
              Are you sure you want to delete <span className="font-semibold">{bookName}</span>?
            </p>
            <p className="text-neutral-500 mb-8">
              This action cannot be undone. The book and all its associated quizzes will be permanently deleted.
            </p>

            <div className="modal-action">
              <button 
                className="btn btn-ghost"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-error"
                onClick={onConfirm}
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Delete Book"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteConfirmationModal; 
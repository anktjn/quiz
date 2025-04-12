// src/components/BookCard.jsx

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../utils/cn";
import { Trash2 } from "lucide-react";
import DynamicBookCover from "./DynamicBookCover";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

const formatPDFName = (name) => {
  // Remove .pdf extension and replace underscores with spaces
  return name.replace(/_/g, ' ').replace('.pdf', '');
};

export default function BookCard({ pdf, quizCount = 0, onPlay, onDelete, isLoading = false }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const formattedName = formatPDFName(pdf.name);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDelete(pdf.id);
    setIsDeleting(false);
    setShowDeleteModal(false);
  };

  return (
    <>
      <motion.div
        className="card bg-base-100 shadow-sm p-0 hover:shadow-2xl transition-shadow duration-300 h-full"
        whileHover={{ scale: 1.02 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <button
          onClick={() => setShowDeleteModal(true)}
          className="btn btn-ghost btn-sm btn-circle absolute right-2 top-2 z-10 bg-base-100/80 hover:bg-base-200/80"
        >
          <Trash2 size={16} />
        </button>

        <figure className="h-40">
          <DynamicBookCover title={formattedName} pdfId={pdf.id} />
        </figure>
        <div className="card-body p-4">
          <h2 className="card-title text-lg font-bold line-clamp-2 text-start">
            {formattedName}
          </h2>
          <p className="text-sm text-gray-500">Quizzes played: {quizCount}</p>
          <div className="card-actions justify-between mt-2">
            <a
              href={pdf.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-outline"
            >
              Read
            </a>
            <button
              className={cn(
                "btn btn-sm btn-accent flex-grow",
                isLoading && "loading"
              )}
              onClick={onPlay}
              disabled={isLoading}
            >
              {isLoading ? "" : "New Quiz"}
            </button>
          </div>
        </div>
      </motion.div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        bookName={formattedName}
        isLoading={isDeleting}
      />
    </>
  );
}

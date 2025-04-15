// src/components/BookCard.jsx

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "../utils/cn";
import { Trash2, Image } from "lucide-react";
import DeleteConfirmationModal from "./DeleteConfirmationModal";
import UpdateCoverModal from "./UpdateCoverModal";

const formatPDFName = (name) => {
  // Remove .pdf extension and replace underscores with spaces
  return name.replace(/_/g, ' ').replace('.pdf', '');
};

// Generate a consistent color based on the title
const getColorFromTitle = (title) => {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = hash % 360;
  return `hsl(${h}, 70%, 45%)`;
};

// Get initials from title
const getInitials = (title) => {
  return title
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
};

export default function BookCard({ pdf, quizCount = 0, onPlay, onDelete, isLoading = false, onCoverUpdated }) {
  const [isHovered, setIsHovered] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUpdateCoverModal, setShowUpdateCoverModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [localCoverUrl, setLocalCoverUrl] = useState(pdf.cover_url);
  const formattedName = formatPDFName(pdf.name);
  const bgColor = getColorFromTitle(formattedName);
  const initials = getInitials(formattedName);
  
  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      console.log("BookCard: Deleting PDF with ID:", pdf.id);
      await onDelete(pdf.id);
      setIsDeleting(false);
      setShowDeleteModal(false);
    } catch (error) {
      console.error("BookCard: Error in delete:", error);
      setIsDeleting(false);
    }
  };

  const handleCoverSuccess = (newCoverUrl) => {
    // Update the local state to show the new cover immediately
    setLocalCoverUrl(newCoverUrl);
    setCoverError(false);
  };

  const handleCoverError = () => {
    setCoverError(true);
    setLocalCoverUrl(null);
  };

  const renderCover = () => {
    if (!localCoverUrl || coverError) {
      // Use initials as fallback
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>
          <span className="text-white text-4xl font-bold tracking-wider">{initials}</span>
        </div>
      );
    }

    // Show the actual cover image
    return (
      <img 
        src={localCoverUrl} 
        alt={formattedName}
        className="w-full h-full object-cover"
        onError={handleCoverError}
      />
    );
  };

  return (
    <>
      <motion.div
        className="card bg-base-100 shadow-sm p-0 hover:shadow-2xl transition-shadow duration-300 h-full"
        whileHover={{ scale: 1.02 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
      >
        <div className="absolute right-2 top-2 z-10 flex gap-2">
          <button
            onClick={() => setShowUpdateCoverModal(true)}
            className="btn btn-ghost btn-sm btn-circle bg-base-100/80 hover:bg-base-200/80"
            title="Update cover"
          >
            <Image size={16} />
          </button>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="btn btn-ghost btn-sm btn-circle bg-base-100/80 hover:bg-base-200/80"
            title="Delete book"
          >
            <Trash2 size={16} />
          </button>
        </div>

        <figure 
          className="h-40 flex items-center justify-center relative overflow-hidden rounded-t-lg"
        >
          {renderCover()}
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

      <UpdateCoverModal 
        isOpen={showUpdateCoverModal}
        onClose={() => setShowUpdateCoverModal(false)}
        pdf={pdf}
        onSuccess={handleCoverSuccess}
        onCoverUpdated={onCoverUpdated}
      />
    </>
  );
}

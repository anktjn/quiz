import { useState, useEffect } from "react";
import { Book } from "lucide-react";
import { generateBookCover } from "../services/imageGeneration";

const DynamicBookCover = ({ title, pdfId }) => {
  const [coverUrl, setCoverUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Extract first letters of words for the fallback cover
  const initials = title
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);

  // Generate a consistent color based on the title for fallback
  const getColorFromTitle = (title) => {
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 45%)`;
  };

  useEffect(() => {
    const generateCover = async () => {
      try {
        const url = await generateBookCover(pdfId, title);
        setCoverUrl(url);
      } catch (error) {
        console.error('Failed to generate cover:', error);
      } finally {
        setIsLoading(false);
      }
    };

    generateCover();
  }, [title, pdfId]);

  const bgColor = getColorFromTitle(title);

  if (isLoading) {
    return (
      <div 
        className="w-full h-40 flex items-center justify-center relative overflow-hidden animate-pulse"
        style={{ backgroundColor: bgColor }}
      >
        <div className="text-white">Generating cover...</div>
      </div>
    );
  }

  if (coverUrl) {
    return (
      <div className="w-full h-40 relative overflow-hidden">
        <img 
          src={coverUrl} 
          alt={`Cover for ${title}`}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Fallback to dynamic design if image generation fails
  return (
    <div 
      className="w-full h-40 flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: bgColor }}
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-20 h-20 rounded-full bg-white"></div>
        <div className="absolute bottom-0 right-0 w-20 h-20 rounded-full bg-white"></div>
      </div>
      
      {/* Book spine effect */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-black/20"></div>
      
      {/* Content */}
      <div className="relative z-10 text-center">
        {initials ? (
          <div className="text-4xl font-bold text-white drop-shadow-lg">
            {initials}
          </div>
        ) : (
          <Book size={48} className="text-white" />
        )}
        <div className="text-xs text-white/80 mt-2 font-medium">
          {title.split(' ').slice(0, 2).join(' ')}
        </div>
      </div>
    </div>
  );
};

export default DynamicBookCover; 
// src/components/BookCard.jsx

import { Book } from "lucide-react";
import { cn } from "../utils/cn";

export default function BookCard({ pdf, quizCount = 0, onPlay }) {
  return (
    <div className="card w-60 bg-base-100 shadow-md">
      <figure className="h-40 bg-base-200 flex items-center justify-center">
        <Book size={48} />
      </figure>
      <div className="card-body">
        <h3 className="card-title text-lg font-bold truncate">{pdf.name}</h3>
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
          <button className="btn btn-sm btn-accent" onClick={onPlay}>
            Play Quiz
          </button>
        </div>
      </div>
    </div>
  );
}

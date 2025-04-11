import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { motion } from "framer-motion";
import { Book, Repeat, FilePlus } from "lucide-react";
import StatCard from "./StatCard";
import BookCard from "./BookCard";
import QuizCard from "./QuizCard";  
export default function Dashboard({ user, onStartNewQuiz, onGenerateFromPDF }) {
  const [pdfs, setPdfs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);

    const { data: pdfData, error: pdfError } = await supabase
      .from("pdfs")
      .select("*")
      .eq("user_id", user.id);

      const { data: quizData, error: quizError } = await supabase
      .from("quizzes")
      .select("id, pdf_name, score, date_taken, user_id, pdf_id")
      .eq("user_id", user.id);
       console.log("📄 Quizzes fetched:", quizData);
    


    if (pdfError || quizError) {
      console.error("Error fetching data:", pdfError || quizError);
    } else {
        console.log("📚 PDFs:", pdfData);
        console.log("📝 Quizzes:", quizData);
        setPdfs(pdfData);
        setQuizzes(quizData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalScore = quizzes.reduce((sum, q) => sum + (q.score || 0), 0);
  const avgScore = quizzes.length ? Math.round(totalScore / quizzes.length) : 0;

  return (
    <div className="w-full px-6 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-bold font-serif">📚 QuizMaster</h1>
        <div className="flex items-center gap-4">
          <button className="btn btn-sm btn-outline">🌓 Theme</button>
          <div className="avatar placeholder">
            <div className="bg-neutral text-neutral-content rounded-full w-10">
              <span>{user.email[0].toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
      <StatCard title="Total Books" value={pdfs.length} />
      <StatCard title="Total Quizzes" value={quizzes.length} />
      <StatCard title="Average Score" value={`${avgScore}/10`} />
      </div>

      {/* Your Books Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mt-8 mb-4">Your Books</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {pdfs.map((pdf) => (
            <BookCard
              key={pdf.id}
              pdf={pdf}
              quizCount={quizzes.filter(q => q.pdf_name === pdf.name).length}
              onPlay={() => onGenerateFromPDF(pdf.file_url)}
            />
          ))}
          {/* Add Book Card */}
          <div className="card w-60 bg-base-100 border-dashed border-2 flex flex-col items-center justify-center cursor-pointer" onClick={onStartNewQuiz}>
            <div className="text-center p-6">
              <FilePlus size={32} className="mx-auto mb-2" />
              <p className="font-medium">Add Book</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Quizzes Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Quizzes</h2>
        {quizzes.length === 0 ? (
          <p className="text-gray-500">You haven't taken any quizzes yet.</p>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quizzes.map((quiz) => (
        <QuizCard key={quiz.id} quiz={quiz} />
        ))}
        </div>
        )}
      </div>
    </div>
  );
}

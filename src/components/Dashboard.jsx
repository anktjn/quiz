import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";
import { motion } from "framer-motion";
import { Book, Repeat, FilePlus, Plus, LogOut, User, BookOpen, Award, Brain } from "lucide-react";
import StatCard from "./StatCard";
import BookCard from "./BookCard";
import QuizCard from "./QuizCard";
import ThemeSwitcher from "./ThemeSwitcher";

const formatPDFName = (name) => {
  // Remove .pdf extension and replace underscores with spaces
  return name?.replace(/_/g, ' ').replace('.pdf', '') || 'Untitled';
};

export default function Dashboard({ user, onStartNewQuiz, onGenerateFromPDF, onLogout }) {
  const [pdfs, setPdfs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPdfId, setLoadingPdfId] = useState(null);
  const [quizCounts, setQuizCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);

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
    fetchQuizCounts();
  }, [user.id]);

  const fetchQuizCounts = async () => {
    const { data, error } = await supabase
      .from("quizzes")
      .select("pdf_id, count")
      .eq("user_id", user.id);

    if (error) {
      console.error("Error fetching quiz counts:", error);
      return;
    }

    const counts = {};
    data.forEach(({ pdf_id, count }) => {
      counts[pdf_id] = count;
    });
    setQuizCounts(counts);
  };

  const handlePlayQuiz = async (pdfUrl, pdfId) => {
    setLoadingPdfId(pdfId);
    try {
      const response = await fetch(pdfUrl);
      const blob = await response.blob();
      const file = new File([blob], "from-dashboard.pdf", { type: blob.type });
      await onGenerateFromPDF(pdfUrl, pdfId);
    } catch (error) {
      console.error("Error generating quiz:", error);
    } finally {
      setLoadingPdfId(null);
    }
  };

  const handleDelete = async (pdfId) => {
    try {
      // First, delete all associated quizzes
      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("pdf_id", pdfId);

      if (quizError) throw quizError;

      // Get the PDF data to delete from storage
      const { data: pdfData, error: fetchError } = await supabase
        .from("pdfs")
        .select("*")
        .eq("id", pdfId)
        .single();

      if (fetchError) throw fetchError;

      // Delete the PDF file from storage
      const filePath = new URL(pdfData.file_url).pathname.split('/').pop();
      const { error: storageError } = await supabase.storage
        .from("pdfs")
        .remove([filePath]);

      if (storageError) throw storageError;

      // Finally, delete the PDF record
      const { error: deleteError } = await supabase
        .from("pdfs")
        .delete()
        .eq("id", pdfId);

      if (deleteError) throw deleteError;

      // Update local state
      setPdfs(pdfs.filter(pdf => pdf.id !== pdfId));
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'alert alert-success';
      toast.innerHTML = '<span>Book deleted successfully!</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

    } catch (error) {
      console.error("Error deleting PDF:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = '<span>Failed to delete book. Please try again.</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  };

  const totalScore = quizzes.reduce((sum, q) => sum + (q.score || 0), 0);
  const avgScore = quizzes.length ? Math.round(totalScore / quizzes.length) : 0;

  return (
    <div className="w-full px-6 py-8 max-w-7xl mx-auto bg-base-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-4xl font-bold font-serif">📚 QuizMaster</h1>
        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar placeholder">
              <div className="bg-neutral text-neutral-content rounded-full w-10">
                <span>{user.email[0].toUpperCase()}</span>
              </div>
            </div>
            <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-200 rounded-box w-52">
              <li>
                <a className="justify-between">
                  <div className="flex items-center gap-2">
                    <User size={16} />
                    <span className="truncate">{user.email}</span>
                  </div>
                </a>
              </li>
              <li>
                <a onClick={onLogout} className="text-error">
                  <LogOut size={16} />
                  Logout
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard 
          title="Total Books" 
          value={pdfs.length} 
          icon={<BookOpen />}
        />
        <StatCard 
          title="Total Quizzes" 
          value={quizzes.length} 
          icon={<Brain />}
        />
        <StatCard 
          title="Average Score" 
          value={`${avgScore}/10`} 
          icon={<Award />}
        />
      </div>

      {/* Your Books Section */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Your Books</h2>
          <button 
            onClick={onStartNewQuiz}
            className="btn btn-primary btn-sm" 
          >
            <Plus size={16} className="mr-2" />
            Add New Book
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-fr">
          {pdfs.length === 0 ? (
            <div className="w-full text-center py-8 col-span-full">
              <p className="text-gray-500">No books added yet. Click "Add New Book" to get started!</p>
            </div>
          ) : (
            pdfs.map((pdf) => (
              <BookCard
                key={pdf.id}
                pdf={pdf}
                quizCount={quizCounts[pdf.id] || 0}
                onPlay={() => handlePlayQuiz(pdf.file_url, pdf.id)}
                onDelete={handleDelete}
                isLoading={loadingPdfId === pdf.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Recent Quizzes Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Quizzes</h2>
        {quizzes.length === 0 ? (
          <p className="text-gray-500">You haven't taken any quizzes yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
            <table className="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Book Name</th>
                  <th>Score</th>
                  <th>Date Taken</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((quiz) => (
                  <tr key={quiz.id}>
                    <td>{formatPDFName(quiz.pdf_name)}</td>
                    <td>{quiz.score}/10</td>
                    <td>{new Date(quiz.date_taken).toLocaleString()}</td>
                    <td>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={async () => {
                          const { data: pdfData } = await supabase
                            .from('pdfs')
                            .select('file_url')
                            .eq('id', quiz.pdf_id)
                            .single();
                            
                          if (pdfData) {
                            handlePlayQuiz(pdfData.file_url, quiz.pdf_id);
                          }
                        }}
                      >
                        <Repeat className="w-4 h-4 mr-2" /> Retake
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

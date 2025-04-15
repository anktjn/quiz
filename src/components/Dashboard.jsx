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

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeString = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  if (isToday) {
    return `Today, ${timeString}`;
  } else if (isYesterday) {
    return `Yesterday, ${timeString}`;
  } else {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    return `${day} ${month}, ${timeString}`;
  }
};

export default function Dashboard({ 
  user, 
  onStartNewQuiz, 
  onGenerateFromPDF, 
  onLogout
}) {
  const [pdfs, setPdfs] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPdfId, setLoadingPdfId] = useState(null);
  const [quizCounts, setQuizCounts] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("Fetching fresh data from database...");

      // Force cache bypass by adding timestamp
      const timestamp = new Date().getTime();
      
      // Fetch PDFs for current user with cache bypass
      const { data: pdfData, error: pdfError } = await supabase
        .from("pdfs")
        .select("*")
        .eq("user_id", user.id)
        .order('uploaded_at', { ascending: false });

      if (pdfError) {
        console.error("Error fetching PDFs:", pdfError);
        throw pdfError;
      }

      // Log all PDFs for debugging
      console.log("All fetched PDFs:", pdfData?.map(pdf => ({
        id: pdf.id,
        name: pdf.name
      })));

      // Fetch quizzes for current user
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("user_id", user.id)
        .order('date_taken', { ascending: false });

      if (quizError) {
        console.error("Error fetching quizzes:", quizError);
        throw quizError;
      }

      console.log("📚 PDFs fetched:", pdfData?.length || 0);
      console.log("📝 Quizzes fetched:", quizData?.length || 0);

      // Update state with fresh data
      console.log("Before updating state - Current PDFs count:", pdfs.length);
      setPdfs(pdfData || []);
      setQuizzes(quizData || []);
      console.log("After updating state - New PDFs count:", pdfData?.length || 0);

      // Calculate quiz counts
      const counts = {};
      quizData?.forEach(quiz => {
        if (quiz.pdf_id) {
          counts[quiz.pdf_id] = (counts[quiz.pdf_id] || 0) + 1;
        }
      });
      setQuizCounts(counts);

    } catch (error) {
      console.error("Error in fetchData:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>Failed to refresh data: ${error.message}</span>`;
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Function to refresh data after cover update
  const refreshAfterCoverUpdate = async (pdfId) => {
    try {
      // Get the updated PDF with the new cover URL
      const { data, error } = await supabase
        .from("pdfs")
        .select("*")
        .eq("id", pdfId)
        .single();
      
      if (error) throw error;
      
      // Update the PDF in the local state
      if (data) {
        setPdfs(prevPdfs => 
          prevPdfs.map(pdf => 
            pdf.id === pdfId ? data : pdf
          )
        );
      }
      
      return true;
    } catch (error) {
      console.error("Error refreshing after cover update:", error);
      return false;
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

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
      console.log("Starting deletion process for PDF ID:", pdfId);
      setIsLoading(true);

      // 1. First verify the PDF exists and get file information
      const { data: pdfData, error: fetchError } = await supabase
        .from("pdfs")
        .select("*")
        .eq("id", pdfId)
        .single();

      if (fetchError) {
        console.error("Error fetching PDF:", fetchError);
        throw new Error(`Failed to fetch PDF: ${fetchError.message}`);
      }

      if (!pdfData) {
        throw new Error("PDF not found");
      }

      console.log("Found PDF to delete:", pdfData);
      
      // Extract file name for storage deletion later
      const fileName = pdfData.file_url.split('/').pop();

      // 2. Delete associated quizzes
      console.log("Deleting associated quizzes...");
      const { error: quizError } = await supabase
        .from("quizzes")
        .delete()
        .eq("pdf_id", pdfId);

      if (quizError) {
        console.error("Error deleting quizzes:", quizError);
        throw new Error(`Failed to delete quizzes: ${quizError.message}`);
      }
      
      // 3. Delete the PDF record directly with a raw RPC call
      console.log("Deleting PDF record...");
      
      // First attempt - Using RPC call
      try {
        const { error: rpcError } = await supabase.rpc('delete_pdf_by_id', { 
          pdf_id: pdfId,
          user_id_param: user.id 
        });
        
        if (rpcError) {
          console.error("RPC delete error:", rpcError);
          throw rpcError;
        }
        
        console.log("PDF deleted successfully via RPC");
      } catch (rpcErr) {
        console.warn("RPC delete failed, falling back to DELETE:", rpcErr);
        
        // Second attempt - Using standard delete
        const { error: deleteError } = await supabase
          .from("pdfs")
          .delete()
          .eq("id", pdfId)
          .eq("user_id", user.id);
          
        if (deleteError) {
          console.error("Error deleting PDF:", deleteError);
          throw new Error(`Failed to delete PDF: ${deleteError.message}`);
        }
        
        console.log("PDF deleted via standard delete");
      }
      
      // 4. Verify the deletion
      const { data: checkData, error: checkError } = await supabase
        .from("pdfs")
        .select("id")
        .eq("id", pdfId)
        .maybeSingle();
        
      if (checkError) {
        console.warn("Verification check error:", checkError);
        // Continue despite verification error
      } else if (checkData) {
        console.error("PDF still exists after deletion:", checkData);
        // Continue despite verification failure
      } else {
        console.log("Verified PDF deletion - record no longer exists");
      }

      // 5. Delete from storage
      console.log("Attempting to delete file from storage:", fileName);
      try {
        const { error: storageError } = await supabase.storage
          .from("pdfs")
          .remove([fileName]);

        if (storageError) {
          console.error("Storage delete error:", storageError);
          // Continue despite storage error
        } else {
          console.log("Successfully deleted file from storage");
        }
      } catch (storageErr) {
        console.error("Storage deletion error:", storageErr);
        // Continue despite errors
      }

      // 6. Update local state
      setPdfs(prevPdfs => {
        const newPdfs = prevPdfs.filter(pdf => pdf.id !== pdfId);
        console.log("Updated local PDFs state. Remaining count:", newPdfs.length);
        return newPdfs;
      });

      setQuizzes(prevQuizzes => {
        const newQuizzes = prevQuizzes.filter(quiz => quiz.pdf_id !== pdfId);
        console.log("Updated local quizzes state. Remaining count:", newQuizzes.length);
        return newQuizzes;
      });

      // Show success message
      const toast = document.createElement('div');
      toast.className = 'alert alert-success';
      toast.innerHTML = '<span>Book deleted successfully!</span>';
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);

      // 7. Force a complete data refresh after a delay
      setTimeout(() => {
        console.log("Refreshing data after deletion...");
        fetchData()
          .then(() => console.log("Data refreshed from server"))
          .catch(err => console.error("Error refreshing data:", err));
      }, 2000);

    } catch (error) {
      console.error("Error in delete process:", error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>Failed to delete book: ${error.message}</span>`;
      document.querySelector('.toast').appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setIsLoading(false);
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
                onCoverUpdated={refreshAfterCoverUpdate}
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
                    <td>{formatDate(quiz.date_taken)}</td>
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

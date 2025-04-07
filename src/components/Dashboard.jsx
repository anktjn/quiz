import { useEffect, useState } from "react";
import { supabase } from "../utils/supabase";

export default function Dashboard({ user, onStartNewQuiz }) {
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
      .select("*")
      .eq("user_id", user.id);

    if (pdfError || quizError) {
      console.error("Error fetching data:", pdfError || quizError);
    } else {
      setPdfs(pdfData);
      setQuizzes(quizData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalScore = quizzes.reduce((sum, q) => sum + (q.score || 0), 0);

  return (
    <div className="container mx-auto p-6">
      
      {/* User Summary Panel */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Welcome, {user.email}</h1>
        <p className="text-gray-600">You’ve taken {quizzes.length} quizzes with a total score of {totalScore}</p>
        <button className="btn btn-primary mt-4" onClick={onStartNewQuiz}>
          Start New Quiz
        </button>
      </div>

      {/* PDF Uploads Section */}
      <div className="mb-10">
        <h2 className="text-2xl font-semibold mb-4">Your Uploaded PDFs</h2>
        {pdfs.length === 0 ? (
          <p className="text-gray-500">No PDFs uploaded yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pdfs.map((pdf) => (
              <div key={pdf.id} className="card bg-base-100 shadow-md p-4">
                <h3 className="text-xl font-medium">{pdf.name}</h3>
                <p className="text-sm text-gray-500">Uploaded on: {new Date(pdf.uploaded_at).toLocaleDateString()}</p>
                <a
                  href={pdf.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline btn-sm mt-2"
                >
                  View PDF
                </a>
                <button className="btn btn-accent btn-sm mt-2">Generate New Quiz</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Quizzes Section */}
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Quizzes</h2>
        {quizzes.length === 0 ? (
          <p className="text-gray-500">You haven't taken any quizzes yet.</p>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <div key={quiz.id} className="card bg-base-100 shadow-md p-4">
                <h3 className="text-lg font-medium">Quiz on: {quiz.pdf_name || "Untitled PDF"}</h3>
                <p className="text-sm text-gray-600">Score: {quiz.score}/10</p>
                <p className="text-sm text-gray-600">Taken on: {new Date(quiz.created_at).toLocaleString()}</p>
                <button className="btn btn-secondary btn-sm mt-2">Retake Quiz</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

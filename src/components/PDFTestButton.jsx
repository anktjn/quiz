import { useState } from 'react';
import { testPDFContentStorage } from '../utils/pdfService';
import { Beaker, Loader2, Check, AlertCircle, Info } from 'lucide-react';

/**
 * A button component for testing PDF content processing functionality
 * @param {Object} props
 * @param {string} props.pdfId - The ID of the PDF to test
 * @param {string} props.buttonSize - Optional size of button (default: "sm")
 * @param {string} props.buttonStyle - Optional button style (default: "outline")
 */
export default function PDFTestButton({ pdfId, buttonSize = "sm", buttonStyle = "outline" }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleTestPDF = async () => {
    if (!pdfId) {
      console.error("No PDF ID provided to PDFTestButton");
      return;
    }

    setLoading(true);
    setResult(null);
    setShowResult(true);
    setShowDetails(false);

    try {
      const testResult = await testPDFContentStorage(pdfId);
      setResult(testResult);
      
      // Auto-hide the result after 8 seconds if details aren't being shown
      setTimeout(() => {
        if (!showDetails) {
          setShowResult(false);
        }
      }, 8000);
    } catch (error) {
      console.error("Error testing PDF:", error);
      setResult({
        success: false,
        error: error.message || "Unknown error occurred"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleDetails = () => {
    setShowDetails(prev => !prev);
  };

  const btnClass = buttonStyle === "outline" 
    ? `btn btn-${buttonSize} btn-outline btn-info` 
    : `btn btn-${buttonSize} btn-info`;

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button 
        className={btnClass}
        onClick={handleTestPDF}
        disabled={loading}
        title="Test PDF Processing"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="mr-1 animate-spin" />
            Testing...
          </>
        ) : (
          <>
            <Beaker size={16} className="mr-1" />
            Test PDF
          </>
        )}
      </button>

      {showResult && result && (
        <div className="mt-1 card card-compact card-bordered border-base-300 bg-base-100 shadow-sm w-full max-w-xs">
          <div className="card-body">
            <div className={`flex items-center gap-2 ${result.success ? 'text-success' : 'text-error'}`}>
              {result.success ? (
                <>
                  <Check size={18} />
                  <h3 className="font-semibold">PDF Processing Test Successful</h3>
                </>
              ) : (
                <>
                  <AlertCircle size={18} />
                  <h3 className="font-semibold">Test Failed</h3>
                </>
              )}
            </div>
            
            {result.success ? (
              <p className="text-sm">Content ID: {result.contentId}</p>
            ) : (
              <p className="text-sm text-error">{result.error}</p>
            )}
            
            {result.success && (
              <div className="mt-1">
                <button 
                  className="btn btn-xs btn-ghost"
                  onClick={toggleDetails}
                >
                  <Info size={14} className="mr-1" />
                  {showDetails ? "Hide Details" : "Show Details"}
                </button>
                
                {showDetails && result.pdfDetails && (
                  <div className="mt-2 text-xs">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                      <span className="font-semibold">PDF ID:</span>
                      <span className="truncate">{pdfId}</span>
                      
                      <span className="font-semibold">Name:</span>
                      <span className="truncate">{result.pdfDetails.name}</span>
                      
                      {result.pdfDetails.author && (
                        <>
                          <span className="font-semibold">Author:</span>
                          <span className="truncate">{result.pdfDetails.author}</span>
                        </>
                      )}
                      
                      <span className="font-semibold">Source:</span>
                      <span>{result.pdfDetails.source}</span>
                      
                      <span className="font-semibold">Created At:</span>
                      <span>{new Date(result.pdfDetails.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="card-actions justify-end mt-2">
              <button 
                className="btn btn-xs btn-ghost" 
                onClick={() => setShowResult(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
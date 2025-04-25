import { useState, useEffect } from 'react';
import { getPreloadedPDFs, searchPreloadedPDFs, addPreloadedPDFToLibrary } from '../utils/preloadedPDFs';
import { Book, Plus, Loader2, Search, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import PreloadedPDFUpload from './PreloadedPDFUpload';
import BulkPDFUpload from './BulkPDFUpload';

export default function PreloadedPDFsBrowser({ user, onPDFAdded, onClose }) {
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [preloadedPDFs, setPreloadedPDFs] = useState([]);
  const [addingPdfId, setAddingPdfId] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);

  // Load all preloaded PDFs initially
  useEffect(() => {
    const fetchPDFs = async () => {
      try {
        setLoading(true);
        const pdfs = await getPreloadedPDFs();
        setPreloadedPDFs(pdfs || []);
      } catch (error) {
        console.error('Error fetching preloaded PDFs:', error);
        const toast = document.createElement('div');
        toast.className = 'alert alert-error';
        toast.innerHTML = `<span>Failed to load preloaded PDFs: ${error.message}</span>`;
        document.querySelector('.toast')?.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      } finally {
        setLoading(false);
      }
    };

    fetchPDFs();
  }, []);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle search submission
  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const results = await searchPreloadedPDFs(searchQuery);
      setPreloadedPDFs(results || []);
    } catch (error) {
      console.error('Error searching preloaded PDFs:', error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>Search failed: ${error.message}</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Handle adding a preloaded PDF to user's library
  const handleAddToLibrary = async (pdfId) => {
    setAddingPdfId(pdfId);
    try {
      const addedPDF = await addPreloadedPDFToLibrary(user, pdfId);
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'alert alert-success';
      toast.innerHTML = `<span>Added to your library!</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
      // Notify parent component
      if (onPDFAdded) onPDFAdded(addedPDF);
    } catch (error) {
      console.error('Error adding to library:', error);
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${error.message}</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setAddingPdfId(null);
    }
  };

  // Handle PDF upload success
  const handleUploadSuccess = async (uploadedPdf) => {
    setIsUploadModalOpen(false);
    setIsBulkUploadModalOpen(false);
    
    // Refresh the list of preloaded PDFs
    try {
      const pdfs = await getPreloadedPDFs();
      setPreloadedPDFs(pdfs || []);
    } catch (error) {
      console.error('Error refreshing preloaded PDFs:', error);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box w-11/12 max-w-5xl">
        <h3 className="font-bold text-xl mb-4">Preloaded PDFs Library</h3>
        
        <button 
          onClick={onClose}
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        >
          ✕
        </button>

        <div className="flex items-center justify-between gap-2 mb-6">
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search size={18} className="text-gray-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                className="input input-bordered w-full pl-10"
                placeholder="Search by title, author or description..."
              />
            </div>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : 'Search'}
            </button>
          </form>
          
          <div className="flex gap-2">
            <button 
              className="btn btn-outline btn-secondary"
              onClick={() => setIsBulkUploadModalOpen(true)}
            >
              <Upload size={18} className="mr-2" />
              Bulk Upload
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Plus size={18} className="mr-2" />
              Upload Single
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : preloadedPDFs.length === 0 ? (
          <div className="text-center py-10">
            <h3 className="font-semibold">No PDFs found</h3>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms or upload a new PDF</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[60vh]">
            {preloadedPDFs.map((pdf) => (
              <motion.div 
                key={pdf.id}
                className="card bg-base-200 shadow-md overflow-hidden"
                whileHover={{ scale: 1.01 }}
              >
                <div className="card-body">
                  <div className="flex gap-4">
                    {pdf.cover_url ? (
                      <img 
                        src={pdf.cover_url} 
                        alt={pdf.title}
                        className="h-32 w-24 object-cover rounded-md shadow-md"
                      />
                    ) : (
                      <div className="h-32 w-24 bg-primary/10 flex items-center justify-center rounded-md shadow-md">
                        <Book size={32} className="text-primary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h3 className="card-title text-base md:text-lg">{pdf.title}</h3>
                      <p className="text-sm text-gray-500">by {pdf.author}</p>
                      {pdf.description && (
                        <p className="mt-2 text-sm line-clamp-3">{pdf.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="card-actions justify-end mt-4">
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAddToLibrary(pdf.id)}
                      disabled={addingPdfId === pdf.id}
                    >
                      {addingPdfId === pdf.id ? (
                        <>
                          <Loader2 size={16} className="mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus size={16} className="mr-2" />
                          Add to Library
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>

      {isUploadModalOpen && (
        <PreloadedPDFUpload 
          onClose={() => setIsUploadModalOpen(false)} 
          onSuccess={handleUploadSuccess}
        />
      )}

      {isBulkUploadModalOpen && (
        <BulkPDFUpload 
          onClose={() => setIsBulkUploadModalOpen(false)} 
          onSuccess={handleUploadSuccess}
        />
      )}
    </div>
  );
} 
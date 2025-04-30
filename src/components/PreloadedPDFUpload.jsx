import { useState } from 'react';
import { uploadPreloadedPDF } from '../utils/preloadedPDFs';
import { X, Loader2, Upload, Check } from 'lucide-react';
import PDFTestButton from './PDFTestButton';

export default function PreloadedPDFUpload({ onClose, onSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [uploadedPdfId, setUploadedPdfId] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      // Try to extract title and author from filename
      // Assumes filename format like "Title - Author.pdf"
      const nameWithoutExtension = file.name.replace('.pdf', '');
      const parts = nameWithoutExtension.split(' - ');
      if (parts.length >= 2) {
        setTitle(parts[0].trim());
        setAuthor(parts[1].trim());
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile || !title || !author) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const metadata = { title, author, description };
      const uploadedPdf = await uploadPreloadedPDF(selectedFile, metadata);
      
      setSuccess(true);
      setUploadedPdfId(uploadedPdf.id);
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'alert alert-success';
      toast.innerHTML = `<span>PDF uploaded successfully!</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
      // Reset form after success
      setTimeout(() => {
        if (onSuccess) onSuccess(uploadedPdf);
        setSelectedFile(null);
        setTitle('');
        setAuthor('');
        setDescription('');
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload PDF');
      
      // Show error message
      const toast = document.createElement('div');
      toast.className = 'alert alert-error';
      toast.innerHTML = `<span>${err.message || 'Failed to upload PDF'}</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box relative w-11/12 max-w-md">
        <button 
          onClick={onClose}
          className="btn btn-ghost btn-sm absolute right-4 top-4"
          disabled={loading}
        >
          <X size={20} /> 
        </button>

        <div className="flex flex-col items-left text-left">
          <h3 className="font-bold text-lg mb-4">Upload Preloaded PDF</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">
                <span className="label-text">PDF File*</span>
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="file-input file-input-bordered file-input-primary w-full"
                disabled={loading || success}
              />
            </div>
            
            <div>
              <label className="label">
                <span className="label-text">Title*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Enter the title of the book"
                disabled={loading || success}
                required
              />
            </div>
            
            <div>
              <label className="label">
                <span className="label-text">Author*</span>
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="input input-bordered w-full"
                placeholder="Enter the author's name"
                disabled={loading || success}
                required
              />
            </div>
            
            <div>
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="textarea textarea-bordered w-full"
                placeholder="Enter a brief description of the book (optional)"
                disabled={loading || success}
                rows={3}
              />
            </div>
            
            {error && (
              <div className="text-error text-sm mt-2">{error}</div>
            )}
            
            {success && (
              <div className="text-center mt-4">
                <div className="flex justify-center items-center gap-2">
                  <Check size={20} className="text-success" />
                  <span className="text-success font-medium">Upload successful!</span>
                </div>
                <div className="mt-2">
                  <PDFTestButton pdfId={uploadedPdfId} buttonSize="sm" />
                </div>
              </div>
            )}
            
            <div className="modal-action">
              <button 
                type="button" 
                className="btn btn-ghost"
                onClick={onClose}
                disabled={loading || success}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!selectedFile || loading || success || !title || !author}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : success ? (
                  <>
                    <Check size={16} className="mr-2" />
                    Uploaded!
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Upload PDF
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
    </div>
  );
} 
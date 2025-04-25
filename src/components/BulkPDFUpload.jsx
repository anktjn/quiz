import { useState, useRef, useEffect } from 'react';
import { bulkUploadPreloadedPDFs } from '../utils/preloadedPDFs';
import { X, Loader2, Upload, FileText, Check, AlertCircle, Image } from 'lucide-react';

export default function BulkPDFUpload({ onClose, onSuccess }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [processedFileIds, setProcessedFileIds] = useState(new Set());
  const [currentBatch, setCurrentBatch] = useState([]);
  const [coverFiles, setCoverFiles] = useState({});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [totalUploaded, setTotalUploaded] = useState(0);
  const [batchSize] = useState(10);
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Function to extract title and author from filename
  const extractMetadata = (filename) => {
    // Remove file extension
    const nameWithoutExtension = filename.replace(/\.[^/.]+$/, '');
    
    // Try to match "Title by Author" pattern
    const byPattern = /(.+) by (.+)/i;
    const byMatch = nameWithoutExtension.match(byPattern);
    
    if (byMatch) {
      return {
        title: byMatch[1].trim(),
        author: byMatch[2].trim()
      };
    }
    
    // Try to match "Title - Author" pattern as fallback
    const dashPattern = /(.+) - (.+)/;
    const dashMatch = nameWithoutExtension.match(dashPattern);
    
    if (dashMatch) {
      return {
        title: dashMatch[1].trim(),
        author: dashMatch[2].trim()
      };
    }
    
    // Default case
    return {
      title: nameWithoutExtension.trim(),
      author: 'Unknown Author'
    };
  };

  // Prepare the next batch whenever selectedFiles or processedFileIds changes
  useEffect(() => {
    if (!uploading && selectedFiles.length > 0) {
      const unprocessedFiles = selectedFiles.filter(file => !processedFileIds.has(file.id));
      const nextBatch = unprocessedFiles.slice(0, batchSize);
      setCurrentBatch(nextBatch);
    }
  }, [selectedFiles, processedFileIds, uploading, batchSize]);

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files).filter(
      file => file.type === 'application/pdf'
    );
    
    // Create metadata objects for each file
    const filesWithMetadata = files.map(file => {
      const { title, author } = extractMetadata(file.name);
      
      return {
        file,
        metadata: {
          title,
          author,
          description: ''
        },
        id: Math.random().toString(36).substring(2, 9)
      };
    });
    
    setSelectedFiles(prevFiles => [...prevFiles, ...filesWithMetadata]);
  };

  const handleCoverFilesChange = (event) => {
    const files = Array.from(event.target.files).filter(
      file => file.type.startsWith('image/')
    );
    
    const newCoverFiles = {};
    
    files.forEach(file => {
      // Extract title and author from cover image filename
      const { title, author } = extractMetadata(file.name);
      
      // Create a key that can be matched with PDFs
      const key = `${title} by ${author}`.toLowerCase();
      newCoverFiles[key] = file;
    });
    
    setCoverFiles(prev => ({ ...prev, ...newCoverFiles }));
  };

  const findCoverForPDF = (fileData) => {
    const { title, author } = fileData.metadata;
    const key = `${title} by ${author}`.toLowerCase();
    return coverFiles[key] || null;
  };

  const updateFileMetadata = (id, field, value) => {
    setSelectedFiles(prevFiles => 
      prevFiles.map(fileData => 
        fileData.id === id 
          ? { 
              ...fileData, 
              metadata: { 
                ...fileData.metadata, 
                [field]: value 
              } 
            } 
          : fileData
      )
    );
  };

  const removeFile = (id) => {
    setSelectedFiles(prevFiles => prevFiles.filter(fileData => fileData.id !== id));
    
    // If the file was already processed, remove it from processed set
    if (processedFileIds.has(id)) {
      const newProcessedIds = new Set(processedFileIds);
      newProcessedIds.delete(id);
      setProcessedFileIds(newProcessedIds);
    }
  };

  const handleBulkUpload = async () => {
    if (currentBatch.length === 0) {
      // Check if all files have been processed
      if (processedFileIds.size >= selectedFiles.length) {
        // All files have been processed, show completion
        setCompleted(true);
        return;
      }
      return; // No files to upload in this batch
    }
    
    setUploading(true);
    setError(null);
    
    const totalRemaining = selectedFiles.length - processedFileIds.size;
    const batchNumber = Math.floor(processedFileIds.size / batchSize) + 1;
    const totalBatches = Math.ceil(selectedFiles.length / batchSize);
    
    setProgress({ 
      percent: 0, 
      completed: 0, 
      total: currentBatch.length,
      totalUploaded: processedFileIds.size,
      totalFiles: selectedFiles.length,
      batchNumber,
      totalBatches,
      errors: 0 
    });
    
    try {
      // Show batch upload message
      const toast = document.createElement('div');
      toast.className = 'alert alert-info';
      toast.innerHTML = `<span>Uploading batch ${batchNumber} of ${totalBatches} (${currentBatch.length} files)</span>`;
      document.querySelector('.toast')?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
      
      // Add cover files to each PDF entry before uploading
      const filesWithCovers = currentBatch.map(fileData => {
        const coverFile = findCoverForPDF(fileData);
        return {
          ...fileData,
          coverFile
        };
      });
      
      // Call the bulk upload function with progress callback
      const result = await bulkUploadPreloadedPDFs(filesWithCovers, (progressData) => {
        setProgress({
          ...progressData,
          totalUploaded: processedFileIds.size + progressData.completed,
          totalFiles: selectedFiles.length,
          batchNumber,
          totalBatches
        });
      });
      
      // Mark these files as processed
      const newProcessedIds = new Set(processedFileIds);
      currentBatch.forEach(file => newProcessedIds.add(file.id));
      setProcessedFileIds(newProcessedIds);
      setTotalUploaded(prev => prev + result.successCount);
      
      // Show success message for this batch
      const successToast = document.createElement('div');
      successToast.className = 'alert alert-success';
      successToast.innerHTML = `<span>Successfully uploaded ${result.successCount} PDFs (Batch ${batchNumber}/${totalBatches})</span>`;
      document.querySelector('.toast')?.appendChild(successToast);
      setTimeout(() => successToast.remove(), 3000);
      
      if (result.errorCount > 0) {
        setError(`Failed to upload ${result.errorCount} files in this batch. Check console for details.`);
      }
      
      // Check if all files have been processed
      if (newProcessedIds.size >= selectedFiles.length) {
        setCompleted(true);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess(result.successful);
          }, 2000);
        }
      }
    } catch (err) {
      console.error('Bulk upload error:', err);
      setError(err.message || 'Failed to upload PDFs');
      
      // Show error message
      const errorToast = document.createElement('div');
      errorToast.className = 'alert alert-error';
      errorToast.innerHTML = `<span>${err.message || 'Failed to upload PDFs'}</span>`;
      document.querySelector('.toast')?.appendChild(errorToast);
      setTimeout(() => errorToast.remove(), 3000);
    } finally {
      setUploading(false);
    }
  };

  // Continue with next batch when current batch finishes
  const handleContinueUpload = () => {
    handleBulkUpload();
  };

  // Count PDFs with matching covers
  const matchingCoversCount = selectedFiles.filter(fileData => 
    findCoverForPDF(fileData) !== null
  ).length;

  // Calculate remaining files
  const remainingFiles = selectedFiles.length - processedFileIds.size;

  return (
    <div className="modal modal-open">
      <div className="modal-box relative w-11/12 max-w-4xl">
        <button 
          onClick={onClose}
          className="btn btn-ghost btn-sm absolute right-4 top-4"
          disabled={uploading}
        >
          <X size={20} /> 
        </button>

        <div className="flex flex-col items-left text-left">
          <h3 className="font-bold text-lg mb-4">Bulk Upload PDFs</h3>
          
          {!uploading && !completed && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-primary w-full"
                  >
                    <FileText size={18} className="mr-2" />
                    Select PDFs
                  </button>
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {selectedFiles.length === 0 
                      ? 'No PDFs selected' 
                      : `${selectedFiles.length} PDF${selectedFiles.length !== 1 ? 's' : ''} selected, ${remainingFiles} remaining`}
                  </p>
                </div>
                
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleCoverFilesChange}
                    className="hidden"
                    ref={coverInputRef}
                  />
                  
                  <button
                    onClick={() => coverInputRef.current?.click()}
                    className="btn btn-secondary w-full"
                  >
                    <Image size={18} className="mr-2" />
                    Select Cover Images
                  </button>
                  
                  <p className="text-xs text-gray-500 mt-1">
                    {Object.keys(coverFiles).length === 0 
                      ? 'No covers selected' 
                      : `${Object.keys(coverFiles).length} cover image${Object.keys(coverFiles).length !== 1 ? 's' : ''} selected`}
                  </p>
                </div>
              </div>
              
              <div className="alert alert-info mt-2">
                <div>
                  <p className="text-sm">
                    <strong>Naming Format:</strong> Use "Title by Author.pdf" for PDFs and "Title by Author.jpg" for covers to ensure automatic matching.
                  </p>
                  {selectedFiles.length > 0 && coverFiles && Object.keys(coverFiles).length > 0 && (
                    <p className="text-sm mt-1">
                      <strong>Matched:</strong> {matchingCoversCount} of {selectedFiles.length} PDFs have matching covers.
                    </p>
                  )}
                  {selectedFiles.length > batchSize && (
                    <p className="text-sm mt-1">
                      <strong>Note:</strong> Files will be uploaded in batches of {batchSize}. {processedFileIds.size} of {selectedFiles.length} have been processed.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* File List with Metadata Editor */}
          {!uploading && !completed && selectedFiles.length > 0 && (
            <div className="overflow-y-auto max-h-[400px] border border-base-300 rounded-lg p-2 mb-6">
              {selectedFiles.map((fileData) => {
                const hasCover = findCoverForPDF(fileData) !== null;
                const isProcessed = processedFileIds.has(fileData.id);
                
                return (
                  <div key={fileData.id} className={`p-3 border-b border-base-200 last:border-b-0 ${isProcessed ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate max-w-md" title={fileData.file.name}>
                          {fileData.file.name}
                        </span>
                        {hasCover && (
                          <span className="badge badge-success gap-1">
                            <Image size={12} />
                            Cover matched
                          </span>
                        )}
                        {isProcessed && (
                          <span className="badge badge-info gap-1">
                            <Check size={12} />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <button 
                        onClick={() => removeFile(fileData.id)} 
                        className="btn btn-ghost btn-xs"
                        disabled={uploading}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="label p-0 mb-1">
                          <span className="label-text text-xs">Title*</span>
                        </label>
                        <input
                          type="text"
                          value={fileData.metadata.title}
                          onChange={(e) => updateFileMetadata(fileData.id, 'title', e.target.value)}
                          className="input input-bordered input-sm w-full"
                          placeholder="Enter title"
                          disabled={isProcessed || uploading}
                          required
                        />
                      </div>
                      <div>
                        <label className="label p-0 mb-1">
                          <span className="label-text text-xs">Author*</span>
                        </label>
                        <input
                          type="text"
                          value={fileData.metadata.author}
                          onChange={(e) => updateFileMetadata(fileData.id, 'author', e.target.value)}
                          className="input input-bordered input-sm w-full"
                          placeholder="Enter author"
                          disabled={isProcessed || uploading}
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="label p-0 mb-1">
                        <span className="label-text text-xs">Description (optional)</span>
                      </label>
                      <input
                        type="text"
                        value={fileData.metadata.description || ''}
                        onChange={(e) => updateFileMetadata(fileData.id, 'description', e.target.value)}
                        className="input input-bordered input-sm w-full"
                        placeholder="Enter description (optional)"
                        disabled={isProcessed || uploading}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Progress Bar */}
          {uploading && progress && (
            <div className="my-8">
              <div className="mb-2 flex justify-between items-center">
                <span className="text-sm font-medium">
                  Batch {progress.batchNumber}/{progress.totalBatches}: Uploading PDFs ({progress.completed}/{progress.total})
                </span>
                <span className="text-sm">{progress.percent}%</span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-4">
                <div 
                  className="bg-primary h-4 rounded-full transition-all duration-300" 
                  style={{ width: `${progress.percent}%` }}
                ></div>
              </div>
              
              <div className="mt-4 mb-2 flex justify-between items-center">
                <span className="text-sm font-medium">
                  Overall Progress: {progress.totalUploaded}/{progress.totalFiles} Files
                </span>
                <span className="text-sm">
                  {Math.round((progress.totalUploaded / progress.totalFiles) * 100)}%
                </span>
              </div>
              <div className="w-full bg-base-300 rounded-full h-4">
                <div 
                  className="bg-secondary h-4 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.round((progress.totalUploaded / progress.totalFiles) * 100)}%` }}
                ></div>
              </div>
              
              {progress.errors > 0 && (
                <div className="text-error text-sm mt-2">
                  <AlertCircle size={14} className="inline mr-1" />
                  {progress.errors} error(s) encountered. Upload will continue with remaining files.
                </div>
              )}
            </div>
          )}
          
          {/* Success Message */}
          {completed && (
            <div className="text-center py-10">
              <div className="mb-4 flex justify-center">
                <div className="rounded-full bg-success/20 p-4 inline-flex">
                  <Check size={48} className="text-success" />
                </div>
              </div>
              <h3 className="text-lg font-bold mb-1">Upload Complete!</h3>
              <p className="text-gray-500">
                Your PDFs have been successfully uploaded and are now available in the preloaded library.
              </p>
              <p className="font-medium mt-2">
                {totalUploaded} out of {selectedFiles.length} PDFs uploaded successfully.
              </p>
            </div>
          )}
          
          {/* Error Message */}
          {error && !uploading && !completed && (
            <div className="alert alert-error mb-4">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
          
          {/* Action Buttons */}
          {!completed && (
            <div className="modal-action">
              <button 
                type="button" 
                className="btn btn-ghost"
                onClick={onClose}
                disabled={uploading}
              >
                Cancel
              </button>
              
              {remainingFiles > 0 && (
                <button 
                  type="button" 
                  className="btn btn-primary"
                  onClick={handleBulkUpload}
                  disabled={currentBatch.length === 0 || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" />
                      Uploading Batch {progress?.batchNumber}/{progress?.totalBatches}...
                    </>
                  ) : processedFileIds.size > 0 ? (
                    <>
                      <Upload size={16} className="mr-2" />
                      Upload Next Batch ({Math.min(remainingFiles, batchSize)} of {remainingFiles} PDFs)
                    </>
                  ) : (
                    <>
                      <Upload size={16} className="mr-2" />
                      Upload {currentBatch.length} PDFs (Batch 1/{Math.ceil(selectedFiles.length / batchSize)})
                    </>
                  )}
                </button>
              )}
            </div>
          )}
          
          {/* Close Button for Completed State */}
          {completed && (
            <div className="modal-action">
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="modal-backdrop" onClick={uploading ? null : onClose}></div>
    </div>
  );
} 
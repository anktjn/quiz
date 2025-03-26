import { useState } from "react";

const Upload = ({ onFileUpload, selectedFile }) => {
  // const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Remove setSelectedFile since we're using the parent's state
    onFileUpload(file);
  };

  return (
    <div className="hero bg-base-400">
  <div className="hero-content text-center">
    <div className="max-w-md">
      <h1 className="font-serif text-4xl font-bold">📚 QuizMaster AI</h1>
      <p className="font-sans py-6">Upload a PDF document and instantly generate a 10-question interactive quiz!</p>
      
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        className="file-input file-input-bordered file-input-primary w-full max-w-xs"
      />

      {selectedFile && (
        <div className="mt-4">
          <p className="text-sm mb-2">Selected file: {selectedFile.name}</p>
        </div>
      )}
    </div>
  </div>
</div>

  );
};

export default Upload;

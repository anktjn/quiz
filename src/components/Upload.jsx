import { useState } from "react";

const Upload = ({ onFileUpload, selectedFile }) => {
  // const [selectedFile, setSelectedFile] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    // Remove setSelectedFile since we're using the parent's state
    onFileUpload(file);
  };

  return (
    <div className="hero bg-base-200">
      <div className="hero-content text-center">
        <div className="max-w-md">
          <h1 className="text-4xl font-bold">📚 QuizMaster AI</h1>
          <p className="py-6">Upload a PDF document and instantly generate a 10-question interactive quiz!</p>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="file-input file-input-bordered file-input-primary w-full max-w-xs"
          />
        </div>
      </div>
    </div>
  );
};

export default Upload;

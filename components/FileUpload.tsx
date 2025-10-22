import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
  currentFile: File | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileChange, currentFile }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileChange(e.dataTransfer.files[0]);
    }
  }, [onFileChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileChange(e.target.files[0]);
    } else {
      onFileChange(null);
    }
  };

  return (
    <div>
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`flex justify-center w-full h-32 px-4 transition bg-gray-900 border-2 ${
          isDragging ? 'border-indigo-400' : 'border-gray-600'
        } border-dashed rounded-md appearance-none cursor-pointer hover:border-gray-400 focus:outline-none`}
      >
        <span className="flex items-center space-x-2 text-center">
          <UploadIcon />
          <span className="font-medium text-gray-400">
            {currentFile ? (
              <>{currentFile.name}</>
            ) : (
              <>
                Drop your Knowledge Base file (.md), or{' '}
                <span className="text-indigo-400">click to select</span>
              </>
            )}
          </span>
        </span>
        <input type="file" name="file_upload" className="hidden" accept=".md" onChange={handleChange} />
      </label>
    </div>
  );
};

export default FileUpload;
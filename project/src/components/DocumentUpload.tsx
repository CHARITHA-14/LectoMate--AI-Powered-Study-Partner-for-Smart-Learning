import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Upload, File, CheckCircle, Loader, X } from 'lucide-react';
import { API } from '../config/api';

export const DocumentUpload: React.FC = () => {
  const { loadUserData } = useUser();
  const navigate = useNavigate();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{
    name: string;
    size: string;
    status: 'uploading' | 'processing' | 'completed' | 'error';
    progress: number;
    error?: string;
  }>>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const processFiles = async (files: File[]) => {
    const token = localStorage.getItem('lectomate_token');
    if (!token) {
      alert('Please log in to upload documents');
      return;
    }

    for (const file of files) {
      const newFile = {
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        status: 'uploading' as const,
        progress: 0
      };

      setUploadedFiles(prev => [...prev, newFile]);

      try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', file);

        // Upload file to backend
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadedFiles(prev => 
              prev.map(f => 
                f.name === file.name 
                  ? { ...f, progress }
                  : f
              )
            );
          }
        });

        // Handle completion
        xhr.addEventListener('load', async () => {
          if (xhr.status === 201) {
            let documentId: string | null = null;
            try {
              const uploadResponse = JSON.parse(xhr.responseText);
              documentId = uploadResponse?.data?.document?.id || null;
            } catch (error) {
              console.error('Failed to parse upload response:', error);
            }

            if (!documentId) {
              setUploadedFiles(prev => 
                prev.map(f => 
                  f.name === file.name 
                    ? { ...f, status: 'error', error: 'Upload completed but no document ID returned' }
                    : f
                )
              );
              return;
            }
            setUploadedFiles(prev => 
              prev.map(f => 
                f.name === file.name 
                  ? { ...f, status: 'processing', progress: 100 }
                  : f
              )
            );

            // Poll for processing completion
            const checkProcessingStatus = async () => {
              try {
                const response = await fetch(`${API}/documents/${documentId}/status`, {
                  headers: {
                    'Authorization': `Bearer ${token}`,
                  },
                });

                if (response.ok) {
                  const data = await response.json();
                  const status = data?.data;

                  if (status?.processed) {
                    setUploadedFiles(prev => 
                      prev.map(f => 
                        f.name === file.name 
                          ? { ...f, status: 'completed' }
                          : f
                      )
                    );
                    await loadUserData();
                    // Auto-redirect to Notes page after processing completes
                    setTimeout(() => navigate('/notes'), 800);
                    return;
                  }

                  if (status?.processingError) {
                    setUploadedFiles(prev => 
                      prev.map(f => 
                        f.name === file.name 
                          ? { ...f, status: 'error', error: status.processingError }
                          : f
                      )
                    );
                    return;
                  }

                  setTimeout(checkProcessingStatus, 1500);
                } else {
                  const errorPayload = await response.json().catch(() => null);
                  if (errorPayload?.error) {
                    setUploadedFiles(prev => 
                      prev.map(f => 
                        f.name === file.name 
                          ? { ...f, status: 'error', error: errorPayload.error }
                          : f
                      )
                    );
                  } else {
                    setTimeout(checkProcessingStatus, 2000);
                  }
                }
              } catch (error) {
                console.error('Error checking processing status:', error);
                setUploadedFiles(prev => 
                  prev.map(f => 
                    f.name === file.name 
                      ? { ...f, status: 'error', error: 'Failed to check processing status' }
                      : f
                  )
                );
              }
            };

            // Start checking processing status
            setTimeout(checkProcessingStatus, 2000);
          } else {
            setUploadedFiles(prev => 
              prev.map(f => 
                f.name === file.name 
                  ? { ...f, status: 'error', error: 'Upload failed' }
                  : f
              )
            );
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.name === file.name 
                ? { ...f, status: 'error', error: 'Network error' }
                : f
            )
          );
        });

        // Send request
        xhr.open('POST', `${API}/documents/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(formData);

      } catch (error) {
        console.error('Upload error:', error);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.name === file.name 
              ? { ...f, status: 'error', error: 'Upload failed' }
              : f
          )
        );
      }
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles(prev => prev.filter(f => f.name !== fileName));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Upload Documents</h1>
        <p className="text-gray-600">
          Upload your documents to generate AI-powered notes, flashcards, and quizzes.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Drag and drop your files here
        </h3>
        <p className="text-gray-600 mb-4">
          or click to browse files
        </p>
        <input
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
          onChange={handleFileSelect}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors cursor-pointer"
        >
          Browse Files
        </label>
        <p className="text-sm text-gray-500 mt-4">
          Supports PDF, DOC, DOCX, TXT, PPT, PPTX files up to 10MB
        </p>
      </div>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Processing Files</h3>
          <div className="space-y-4">
            {uploadedFiles.map((file, index) => (
              <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <File size={24} className="text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-600">{file.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {file.status === 'uploading' && (
                      <div className="flex items-center space-x-2">
                        <Loader size={20} className="animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Uploading... {file.progress}%</span>
                      </div>
                    )}
                    {file.status === 'processing' && (
                      <div className="flex items-center space-x-2">
                        <Loader size={20} className="animate-spin text-orange-600" />
                        <span className="text-sm text-gray-600">Processing...</span>
                      </div>
                    )}
                    {file.status === 'completed' && (
                      <div className="flex items-center space-x-2">
                        <CheckCircle size={20} className="text-green-600" />
                        <span className="text-sm text-green-600">Completed</span>
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div className="flex items-center space-x-2">
                        <X size={20} className="text-red-600" />
                        <span className="text-sm text-red-600">{file.error || 'Error'}</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeFile(file.name)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
                {file.status === 'uploading' && (
                  <div className="mt-3">
                    <div className="bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing Info */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-semibold text-blue-900 mb-2">What happens after upload?</h4>
        <ul className="space-y-2 text-blue-800">
          <li>â€¢ AI analyzes your document structure and content</li>
          <li>â€¢ Key concepts are extracted and highlighted</li>
          <li>â€¢ Structured notes are generated with summaries</li>
          <li>â€¢ Flashcards are automatically created for important terms</li>
          <li>â€¢ Quiz questions are generated to test comprehension</li>
        </ul>
      </div>
    </div>
  );
};

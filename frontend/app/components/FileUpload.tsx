'use client';

import { useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

interface FileUploadProps {
    apiEndpoint: string;
}

export default function FileUpload({ apiEndpoint }: FileUploadProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [uploadStatus, setUploadStatus] = useState<Record<string, 'pending' | 'uploading' | 'success' | 'error'>>({});
    const [errorMessages, setErrorMessages] = useState<Record<string, string>>({});

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files).filter(
                file => file.type === 'application/pdf'
            );
            setFiles(prev => [...prev, ...selectedFiles]);

            // Initialize status for new files
            const newStatus: Record<string, 'pending'> = {};
            selectedFiles.forEach(file => {
                newStatus[file.name] = 'pending';
            });
            setUploadStatus(prev => ({ ...prev, ...newStatus }));
        }
    };

    const removeFile = (fileName: string) => {
        setFiles(prev => prev.filter(f => f.name !== fileName));
        setUploadStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[fileName];
            return newStatus;
        });
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[fileName];
            return newProgress;
        });
    };

    const uploadFile = async (file: File) => {
        const fileName = `${Date.now()}-${file.name}`;

        try {
            setUploadStatus(prev => ({ ...prev, [file.name]: 'uploading' }));
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

            // Get Cognito credentials
            const session = await fetchAuthSession();
            const credentials = session.credentials;

            if (!credentials) {
                throw new Error('Not authenticated');
            }

            // Create S3 client with Cognito credentials
            const s3Client = new S3Client({
                region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-west-2',
                credentials: credentials,
            });

            const bucketName = process.env.NEXT_PUBLIC_DOCUMENTS_BUCKET;
            if (!bucketName) {
                throw new Error('Documents bucket not configured');
            }

            // Upload file to S3
            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: `input/${fileName}`,
                Body: file,
                ContentType: 'application/pdf',
            });

            setUploadProgress(prev => ({ ...prev, [file.name]: 50 }));
            await s3Client.send(command);

            setUploadStatus(prev => ({ ...prev, [file.name]: 'success' }));
            setUploadProgress(prev => ({ ...prev, [file.name]: 100 }));
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus(prev => ({ ...prev, [file.name]: 'error' }));
            setErrorMessages(prev => ({ ...prev, [file.name]: error instanceof Error ? error.message : 'Unknown error' }));
            throw error;
        }
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);

        try {
            // Upload files sequentially to avoid overwhelming the API
            for (const file of files) {
                if (uploadStatus[file.name] !== 'success') {
                    await uploadFile(file);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="bg-white rounded-[12px] shadow-sm border border-[#d1d5dc] p-6">
            <h2 className="text-xl font-bold text-[#231f20] mb-4">Upload Documents</h2>
            <p className="text-sm text-[#636466] mb-6">
                Upload PDF documents to the knowledge base. Large files (350-400 pages) are supported.
            </p>

            {/* File Input */}
            <div className="mb-6">
                <label className="block">
                    <div className="border-2 border-dashed border-[#d1d5dc] rounded-[12px] p-8 text-center hover:border-[#0089d0] transition-colors cursor-pointer">
                        <input
                            type="file"
                            multiple
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={uploading}
                        />
                        <div className="text-[#636466]">
                            <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-sm font-medium">Click to select PDF files</p>
                            <p className="text-xs mt-1">or drag and drop</p>
                        </div>
                    </div>
                </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-3 mb-6">
                    {files.map((file) => {
                        const status = uploadStatus[file.name];
                        const progress = uploadProgress[file.name] || 0;
                        const error = errorMessages[file.name];

                        return (
                            <div key={file.name} className="border border-[#d1d5dc] rounded-[12px] p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <p className="text-sm font-medium text-[#231f20] truncate">{file.name}</p>
                                        <p className="text-xs text-[#636466]">{formatFileSize(file.size)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {status === 'success' && (
                                            <span className="text-green-600 text-sm">✓ Uploaded</span>
                                        )}
                                        {status === 'error' && (
                                            <span className="text-red-600 text-sm">✗ Failed</span>
                                        )}
                                        {status === 'pending' && (
                                            <button
                                                onClick={() => removeFile(file.name)}
                                                className="text-red-600 hover:text-red-800 text-sm"
                                                disabled={uploading}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {status === 'uploading' && (
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className="bg-[#0089d0] h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                )}

                                {/* Error Message */}
                                {error && (
                                    <p className="text-xs text-red-600 mt-2">{error}</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Upload Button */}
            {files.length > 0 && (
                <button
                    onClick={handleUpload}
                    disabled={uploading || files.every(f => uploadStatus[f.name] === 'success')}
                    className="w-full bg-[#0089d0] text-white px-6 py-3 rounded-[100px] hover:bg-[#0077b8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    {uploading ? 'Uploading...' : 'Upload Files'}
                </button>
            )}
        </div>
    );
}

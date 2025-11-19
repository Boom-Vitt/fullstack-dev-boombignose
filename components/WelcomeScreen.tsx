/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useCallback, useEffect } from 'react';
import UploadCloudIcon from './icons/UploadCloudIcon';
import TrashIcon from './icons/TrashIcon';

interface WelcomeScreenProps {
    onUpload: (manualName: string) => Promise<void>;
    files: File[];
    setFiles: React.Dispatch<React.SetStateAction<File[]>>;
    manualTitle: string;
    setManualTitle: React.Dispatch<React.SetStateAction<string>>;
    geminiKeyAvailable: boolean;
}

const UploadPage: React.FC<WelcomeScreenProps> = ({ onUpload, files, setFiles, manualTitle, setManualTitle, geminiKeyAvailable }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
        }
    };
    
    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            setFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]);
        }
    }, [setFiles]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);
    
    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (files.length > 0 && manualTitle.trim().length === 0) {
            const firstFileName = files[0].name.replace(/\.[^/.]+$/, '');
            setManualTitle(firstFileName || files[0].name);
        }
    }, [files, manualTitle, setManualTitle]);

    const handleConfirmUpload = async () => {
        try {
            await onUpload(manualTitle);
        } catch (error) {
            // Error is handled by the parent component, but we catch it here
            // to prevent an "uncaught promise rejection" warning in the console.
            console.error("Upload process failed:", error);
        }
    };

    const handleRemoveFile = (indexToRemove: number) => {
        setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-3xl text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">Chat With Your Document</h1>
                <p className="text-gem-offwhite/70 mb-8">
                    Powered by <strong className="font-semibold text-gem-offwhite">FileSearch</strong>. Upload a manual to see RAG in action.
                </p>

                {!geminiKeyAvailable && (
                    <div className="w-full max-w-xl mx-auto mb-8">
                        <div className="w-full bg-red-500/10 border border-red-500/40 rounded-lg py-3 px-5 text-center text-red-300 font-semibold">
                            Set <code className="font-mono text-sm">GEMINI_API_KEY</code> in your <code className="font-mono text-sm">.env.local</code> file to enable uploads.
                        </div>
                    </div>
                )}

                <div className="w-full max-w-xl mx-auto mb-6 text-left">
                    <label htmlFor="manual-title" className="block text-sm font-semibold mb-1 text-gem-offwhite/80">Manual name</label>
                    <input
                        id="manual-title"
                        type="text"
                        value={manualTitle}
                        onChange={(e) => setManualTitle(e.target.value)}
                        placeholder="e.g. LG Washer Manual"
                        className="w-full bg-gem-mist border border-gem-mist/60 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-gem-blue text-gem-offwhite"
                    />
                </div>

                <div 
                    className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-colors mb-6 ${isDragging ? 'border-gem-blue bg-gem-mist/10' : 'border-gem-mist/50'}`}
                    onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                >
                    <div className="flex flex-col items-center justify-center">
                        <UploadCloudIcon />
                        <p className="mt-4 text-lg text-gem-offwhite/80">Drag & drop your PDF, .txt, or .md file here.</p>
                        <input id="file-upload" type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md"/>
                         <label 
                            htmlFor="file-upload" 
                            className="mt-4 cursor-pointer px-6 py-2 bg-gem-blue text-white rounded-full font-semibold hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gem-onyx focus:ring-gem-blue" 
                            title="Select files from your device"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    (document.getElementById('file-upload') as HTMLInputElement)?.click();
                                }
                            }}
                         >
                            Or Browse Files
                        </label>
                    </div>
                </div>

                {files.length > 0 && (
                    <div className="w-full max-w-xl mx-auto mb-6 text-left">
                        <h4 className="font-semibold mb-2">Selected Files ({files.length}):</h4>
                        <ul className="max-h-36 overflow-y-auto space-y-1 pr-2">
                            {files.map((file, index) => (
                                <li key={`${file.name}-${index}`} className="text-sm bg-gem-mist/50 p-2 rounded-md flex justify-between items-center group">
                                    <span className="truncate" title={file.name}>{file.name}</span>
                                    <div className="flex items-center flex-shrink-0">
                                        <span className="text-xs text-gem-offwhite/50 ml-2">{(file.size / 1024).toFixed(2)} KB</span>
                                        <button 
                                            onClick={() => handleRemoveFile(index)}
                                            className="ml-2 p-1 text-red-400 hover:text-red-300 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            aria-label={`Remove ${file.name}`}
                                            title="Remove this file"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                <div className="w-full max-w-xl mx-auto">
                    <button 
                        onClick={handleConfirmUpload}
                        disabled={!geminiKeyAvailable || files.length === 0 || manualTitle.trim().length === 0}
                        className="w-full px-6 py-3 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-bold transition-colors disabled:bg-gem-mist/50 disabled:cursor-not-allowed"
                        title={!geminiKeyAvailable ? "Set GEMINI_API_KEY in .env.local first" : files.length === 0 ? "Add at least one file" : manualTitle.trim().length === 0 ? "Provide a manual name" : "Upload this manual"}
                    >
                        Upload Manual
                    </button>
                </div>
                
                <div className="mb-12" />
            </div>
        </div>
    );
};

export default UploadPage;

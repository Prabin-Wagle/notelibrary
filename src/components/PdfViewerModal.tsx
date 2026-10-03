import React from 'react';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import { X } from 'lucide-react';

// Import CSS
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

// Worker URL (Must match pdfjs-dist version in package.json)
const workerUrl = `https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

interface PdfViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    title: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ isOpen, onClose, fileUrl, title }) => {
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full h-full max-w-6xl rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in duration-300">
                {/* Header */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 line-clamp-1">{title}</h2>
                        <p className="text-xs text-gray-500">Secure PDF Viewer</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Viewer Body */}
                <div className="flex-1 overflow-hidden relative bg-gray-100">
                    <Worker workerUrl={workerUrl}>
                        <Viewer
                            fileUrl={fileUrl}
                            plugins={[defaultLayoutPluginInstance]}
                        />
                    </Worker>
                </div>
            </div>
        </div>
    );
};

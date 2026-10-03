// src/components/BlogContentRenderer.tsx
import React from 'react';
import parse, { DOMNode, Element } from 'html-react-parser';
import { Viewer, Worker } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';

// Import CSS
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

interface Props {
    content: string;
}

const BlogContentRenderer: React.FC<Props> = ({ content }) => {
    const defaultLayoutPluginInstance = defaultLayoutPlugin();

    // The replace function decides what to do with each HTML element
    const replace = (domNode: DOMNode) => {
        if (domNode instanceof Element && domNode.name === 'iframe') {
            const src = domNode.attribs.src || '';
            let pdfUrl = '';

            // Check if this iframe is holding a PDF
            // Case 1: Direct PDF Link
            if (src.endsWith('.pdf')) {
                pdfUrl = src;
            }
            // Case 2: Google Viewer Link (we need to extract the real URL)
            else if (src.includes('docs.google.com/gview') || src.includes('docs.google.com/viewer')) {
                try {
                    const urlParams = new URLSearchParams(src.split('?')[1]);
                    const extractedUrl = urlParams.get('url');
                    if (extractedUrl) {
                        pdfUrl = extractedUrl;
                    }
                } catch (e) {
                    console.error("Error parsing Google Viewer URL", e);
                }
            }

            // If we found a PDF URL, return the React Component instead of the iframe
            if (pdfUrl) {
                return (
                    <div style={{ height: '750px', width: '100%', margin: '20px 0', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                        <Worker workerUrl={workerUrl}>
                            <Viewer
                                fileUrl={pdfUrl}
                                plugins={[defaultLayoutPluginInstance]}
                            />
                        </Worker>
                    </div>
                );
            }
        }
    };

    return (
        <div className="prose max-w-none">
            {parse(content, { replace })}
        </div>
    );
};

export default BlogContentRenderer;

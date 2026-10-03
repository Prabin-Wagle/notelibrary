import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

/**
 * Normalizes HTML entities and spaces back into plain text or LaTeX equivalents
 * so KaTeX doesn't fail on things like "amp;" or "&nbsp;".
 */
const cleanLatex = (latex: string): string => {
    return latex
        .replace(/&amp;/gi, '&')
        .replace(/\bamp;/gi, '&') // Handles stray "amp;" missing the &
        .replace(/&nbsp;/gi, '\\ ') // Space
        .replace(/<br\s*\/?>/gi, '\\\\') // Newline
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/<sup>(.*?)<\/sup>/gi, '^{$1}')
        .replace(/<sub>(.*?)<\/sub>/gi, '_{$1}');
};
interface LatexRendererProps {
    /** The text content that may contain LaTeX expressions */
    children: string | number;
    /** Whether to render in display mode (block) or inline mode */
    displayMode?: boolean;
    /** Additional CSS class names */
    className?: string;
}

/**
 * Renders text with LaTeX/KaTeX support.
 * 
 * Supports multiple LaTeX formats:
 * - Inline: \(...\) or $...$
 * - Display: \[...\] or $$...$$
 * - Raw KaTeX: Entire string is treated as LaTeX if it starts with common LaTeX commands
 */
export const LatexRenderer: React.FC<LatexRendererProps> = React.memo(({
    children,
    displayMode = false,
    className = ''
}) => {
    const renderedContent = useMemo(() => {
        if (typeof children === 'number') {
            return String(children);
        }
        if (!children || typeof children !== 'string') {
            return '';
        }

        try {
            // Check if the entire string is a pure LaTeX expression
            const trimmed = children.trim();

            // Pure display mode: \[...\] or $$...$$
            if ((trimmed.startsWith('\\[') && trimmed.endsWith('\\]')) ||
                (trimmed.startsWith('$$') && trimmed.endsWith('$$'))) {
                const content = cleanLatex(trimmed.startsWith('\\[')
                    ? trimmed.slice(2, -2)
                    : trimmed.slice(2, -2));
                return katex.renderToString(content, {
                    throwOnError: false,
                    displayMode: true,
                });
            }

            // Pure inline mode: \(...\)
            if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
                const content = cleanLatex(trimmed.slice(2, -2));
                return katex.renderToString(content, {
                    throwOnError: false,
                    displayMode: false,
                });
            }

            // Mixed content: Parse and render LaTeX expressions within text
            let result = children;

            // Process display math $$...$$ first
            result = result.replace(/\$\$([^$]+)\$\$/g, (_, latex) => {
                try {
                    return katex.renderToString(cleanLatex(latex), { throwOnError: false, displayMode: true });
                } catch {
                    return `$$${latex}$$`;
                }
            });

            // Process \[...\]
            result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
                try {
                    return katex.renderToString(cleanLatex(latex), { throwOnError: false, displayMode: true });
                } catch {
                    return `\\[${latex}\\]`;
                }
            });

            // Process inline math $...$  (not preceded by \)
            result = result.replace(/(?<!\\)\$([^$]+)\$/g, (_, latex) => {
                try {
                    return katex.renderToString(cleanLatex(latex), { throwOnError: false, displayMode: false });
                } catch {
                    return `$${latex}$`;
                }
            });

            // Process \(...\)
            result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
                try {
                    return katex.renderToString(cleanLatex(latex), { throwOnError: false, displayMode: false });
                } catch {
                    return `\\(${latex}\\)`;
                }
            });

            // Process free-floating \begin{...} ... \end{...} that isn't wrapped in $$
            result = result.replace(/(\\begin\{[a-z*]+\}[\s\S]*?\\end\{[a-z*]+\})/g, (_, latex) => {
                try {
                    return katex.renderToString(cleanLatex(latex), { throwOnError: false, displayMode: true });
                } catch {
                    return latex; // fallback
                }
            });

            return result;
        } catch (error) {
            console.error('LaTeX rendering error:', error);
            return escapeHtml(children);
        }
    }, [children, displayMode]);

    return (
        <span
            className={`latex-content ${className}`}
            dangerouslySetInnerHTML={{ __html: renderedContent }}
        />
    );
});

/**
 * Simple HTML escape function bypass
 * We want to allow basic HTML tags like <img>, <sub>, <sup>, <br> to render in questions.
 */
function escapeHtml(text: string): string {
    return text;
}

/**
 * Renders pure KaTeX without mixed content parsing.
 */
export const PureLatexRenderer: React.FC<LatexRendererProps> = React.memo(({
    children,
    displayMode = false,
    className = ''
}) => {
    const html = useMemo(() => {
        if (typeof children === 'number') {
            return String(children);
        }
        if (!children || typeof children !== 'string') {
            return '';
        }
        try {
            return katex.renderToString(children, {
                throwOnError: false,
                displayMode,
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
            return children;
        }
    }, [children, displayMode]);

    return (
        <span
            className={className}
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
});

export default LatexRenderer;

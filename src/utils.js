/**
 * Utility functions for the note.svg application
 */

// Constants for localStorage
const NOTESVG_STORAGE_KEY = 'notesvg-document';

/**
 * Rounds a number to a specified number of decimal places
 * @param {number} num - The number to round
 * @param {number} [decimals=1] - The number of decimal places to round to
 * @returns {string} - The rounded number as a string
 */
export function roundNumber(num, decimals = 1) {
    return num.toFixed(decimals);
}

/**
 * Checks if a string is a valid SVG
 * @param {string} text - The text to check
 * @returns {boolean} - True if the text is a valid SVG, false otherwise
 */
export function isValidSvg(text) {
    return text.trim().startsWith('<svg') && text.trim().endsWith('</svg>');
}

/**
 * Creates a download for a blob
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename to use
 */
export function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 0);
}

/**
 * Parses a size string in the format "widthxheight"
 * @param {string} sizeStr - The size string to parse
 * @returns {{width: number, height: number}|null} - The parsed width and height, or null if invalid
 */
export function parseSizeString(sizeStr) {
    const dims = sizeStr.split('x') || [];
    
    const width = parseInt(dims[0]?.trim());
    const height = parseInt(dims[1]?.trim());
    
    if (!isNaN(width) && !isNaN(height)) {
        return { width, height };
    }
    
    return null;
}

/**
 * Saves the document to localStorage
 * @param {Object} document - The document to save
 * @param {Function} serializeDocument - Function to serialize the document
 */
export function saveToLocalStorage(document, serializeDocument) {
    try {
        // Serialize the document without adding the "Edit" link
        const svgString = serializeDocument(document, false);
        localStorage.setItem(NOTESVG_STORAGE_KEY, svgString);
        console.log('Document saved to localStorage');
    } catch (error) {
        console.error('Failed to save document to localStorage:', error);
    }
}

/**
 * Loads the document from localStorage
 * @param {Function} deserializeDocument - Function to deserialize the document
 * @param {Function} createDefaultDocument - Function to create a default document if none exists
 * @returns {Object} - The loaded document or a default document if none exists
 */
export function loadFromLocalStorage(deserializeDocument, createDefaultDocument) {
    try {
        const svgString = localStorage.getItem(NOTESVG_STORAGE_KEY);
        
        if (svgString && isValidSvg(svgString)) {
            console.log('Document loaded from localStorage');
            return deserializeDocument(svgString);
        }
    } catch (error) {
        console.error('Failed to load document from localStorage:', error);
    }
    
    // Return a default document if none exists or if there was an error
    return createDefaultDocument();
}

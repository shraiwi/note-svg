/**
 * Main entry point for the note.svg application
 */

import { StrokeRenderer } from "./stroke.js";
import { DocumentEditor } from "./document-editor.js";
import { transform } from "./notesvg.js";
import * as txml from "./txml.js";
import { setupButtonHandlers, setupCanvas, updateDocument, serializeDocument } from "./ui.js";
import { isValidSvg, loadFromLocalStorage, saveToLocalStorage } from "./utils.js";

/**
 * Creates a default note document with SVG structure
 * @returns {Object} The initialized note document
 */
function createDefaultDocument() {
    return {
        tagName: 'svg',
        noteSvgAttributes: {
            width: 360,
            height: 360
        },
        attributes: {
            xmlns: "http://www.w3.org/2000/svg",
            style: "border: 2px solid #000",
        },
        children: [
            {
                tagName: 'metadata',
                attributes: {},
                noteSvgAttributes: {},
                children: [
                    {
                        tagName: 'notesvg',
                        attributes: {},
                        noteSvgAttributes: {
                            version: "1.0"
                        },
                        children: []
                    }
                ]
            },
        ]
    };
}

/**
 * Deserializes an SVG string to a noteDocument
 * @param {string} svgString - The SVG string to deserialize
 * @returns {Object} - The deserialized noteDocument
 */
function deserializeDocument(svgString) {
    if (!isValidSvg(svgString)) {
        throw new Error('Invalid SVG string');
    }
    
    // Parse the SVG string using txml
    const parsedNodes = txml.parse(svgString);
    
    // The first node should be the SVG element
    if (parsedNodes && parsedNodes.length > 0) {
        const svgNode = parsedNodes[0];
        
        // Apply transform to add noteSvgAttributes
        transform(svgNode);
        
        return svgNode;
    }
    
    throw new Error('Failed to parse SVG');
}

// Create a note document with SVG structure - load from localStorage or use default
let noteDocument = loadFromLocalStorage(deserializeDocument, createDefaultDocument);
const renderer = new StrokeRenderer(noteDocument);

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Set up button event listeners
    setupButtonHandlers(noteDocument, renderer, deserializeDocument);
    
    // Set up canvas and event listeners
    setupCanvas(noteDocument, renderer);
    
    // Save document to localStorage when the page is about to unload
    window.addEventListener('beforeunload', () => {
        saveToLocalStorage(noteDocument, serializeDocument);
    });
});

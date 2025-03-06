/**
 * UI-related functionality for the note.svg application
 */

import { StrokeRenderer } from "./stroke.js";
import { toSvg } from "./notesvg.js";
import { downloadBlob, isValidSvg, parseSizeString, saveToLocalStorage } from "./utils.js";

/**
 * Link element to add to exported SVGs
 * @type {Object}
 */
const LINK_ELEMENT = {
    tagName: 'a',
    attributes: {
        href: window.location.origin,
        target: "_blank"
    },
    children: [
        {
            tagName: 'text',
            attributes: {
                x: "100%",
                y: "100%",
                dx: "-5",
                dy: "-5",
                "text-anchor": "end",
                "dominant-baseline": "text-after-edge",
                fill: "#000",
                "font-family": "sans-serif",
                "font-size": "12px",
                "font-weight": "bold",
                "text-decoration": "underline",
            },
            children: ["Edit"]
        }
    ]
};

/**
 * Saves the document to localStorage
 * @param {Object} noteDocument - The document to save
 */
function saveDocumentToLocalStorage(noteDocument) {
    saveToLocalStorage(noteDocument, serializeDocument);
}

/**
 * Updates the document dimensions and renderer
 * @param {Object} noteDocument - The note document to update
 * @param {StrokeRenderer} renderer - The renderer instance
 */
export function updateDocument(noteDocument, renderer) {
    const container = document.getElementById('container');
    const buttonContainer = document.getElementById('button-container');
    const penContainer = document.getElementById('pen-container');

    container.style.width = noteDocument.noteSvgAttributes.width + 'px';
    container.style.height = noteDocument.noteSvgAttributes.height + 'px';
    
    // Set button container width to match the container
    buttonContainer.style.width = noteDocument.noteSvgAttributes.width + 'px';
    penContainer.style.width = noteDocument.noteSvgAttributes.width + 'px';

    renderer.resizeCanvas();

    // Update the renderer
    renderer.svg = noteDocument;
    renderer.drawBack();
    
    // Save the updated document to localStorage
    saveDocumentToLocalStorage(noteDocument);
}

/**
 * Serializes the noteDocument to an SVG string
 * @param {Object} noteDocument - The note document to serialize
 * @param {boolean} [addLink=true] - Whether to add a link to the SVG
 * @returns {string} - The serialized SVG string
 */
export function serializeDocument(noteDocument, addLink = true) {    
    // Add link if not there
    if (addLink) {
        noteDocument.children ||= [];

        const hasLink = noteDocument.children.find((item) => {
            if (typeof item === 'string') return false;
            
            return item.tagName === 'a' 
                && item.attributes?.href === window.location.origin;
        }) !== undefined;

        if (!hasLink) noteDocument.children.push(LINK_ELEMENT);
    }

    return toSvg(noteDocument);
}

/**
 * Sets up the canvas elements and event listeners
 * @param {Object} noteDocument - The note document
 * @param {StrokeRenderer} renderer - The renderer instance
 */
export function setupCanvas(noteDocument, renderer) {
    // Get the parent container to set dimensions
    const container = document.getElementById('container');
    
    // Style and position the canvases
    const backCanvas = renderer.ctxBack.canvas;
    const frontCanvas = renderer.ctxFront.canvas;
    
    frontCanvas.style.pointerEvents = 'none'; // Let events pass through to back canvas
    
    // Replace the placeholder canvas with our two canvases
    container.appendChild(backCanvas);
    container.appendChild(frontCanvas);
    
    // Handle pointer down event
    backCanvas.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        
        // Start a new stroke with the pointer event
        renderer.beginStroke(e.pointerId, e);
        
        // Capture the pointer to ensure we get all events
        backCanvas.setPointerCapture(e.pointerId);
    });
    
    // Handle pointer move event
    backCanvas.addEventListener('pointermove', (e) => {
        e.preventDefault();
        
        // Update the stroke with the pointer event
        renderer.moveStroke(e.pointerId, e);
    });
    
    // Handle pointer up event
    backCanvas.addEventListener('pointerup', (e) => {
        e.preventDefault();
        
        // End the stroke with the pointer event
        renderer.endStroke(e.pointerId, e);
        
        // Release the pointer
        backCanvas.releasePointerCapture(e.pointerId);
    });
    
    // Handle pointer leave event
    backCanvas.addEventListener('pointerleave', (e) => {
        // We don't end the stroke here because we've captured the pointer
        // and will still receive move and up events
    });

    updateDocument(noteDocument, renderer);
}

/**
 * Sets up the save button event handler
 * @param {HTMLButtonElement} saveButton - The save button element
 * @param {Object} noteDocument - The note document
 */
function setupSaveButton(saveButton, noteDocument) {
    saveButton.addEventListener('click', () => {
        try {
            // Serialize the document to SVG
            const svgString = serializeDocument(noteDocument);
            
            // Create a blob and download link
            const blob = new Blob([svgString], { type: 'image/svg+xml' });
            downloadBlob(blob, 'note.svg');
        } catch (error) {
            alert(`Error saving document ${error}`);
            console.error('Error saving document:', error);
        }
    });
}

/**
 * Sets up the copy button event handler
 * @param {HTMLButtonElement} copyButton - The copy button element
 * @param {Object} noteDocument - The note document
 */
function setupCopyButton(copyButton, noteDocument) {
    copyButton.addEventListener('click', async () => {
        try {
            // Serialize the document to SVG
            const svgString = serializeDocument(noteDocument);
            
            // Use the clipboard API to copy the SVG string
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(svgString);
            } else {
                prompt("Copy this SVG code:", svgString);
            }

            console.log('Note copied to clipboard');
            alert("SVG copied to clipboard!");
        } catch (error) {
            console.error('Failed to copy note to clipboard:', error);
        }
    });
}

/**
 * Sets up the upload button event handler
 * @param {HTMLButtonElement} uploadButton - The upload button element
 * @param {Object} noteDocument - The note document
 * @param {StrokeRenderer} renderer - The renderer instance
 * @param {Function} deserializeDocument - Function to deserialize SVG string
 */
function setupUploadButton(uploadButton, noteDocument, renderer, deserializeDocument) {
    uploadButton.addEventListener('click', () => {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.svg';
        
        fileInput.addEventListener('change', (e) => {
            // Get the input element
            const target = /** @type {HTMLInputElement} */ (e.target);
            const file = target.files?.[0];
            if (file) {
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    try {
                        // Ensure we have a string result
                        const fileReader = /** @type {FileReader} */ (event.target);
                        const result = fileReader.result;
                        if (typeof result !== 'string') {
                            throw new Error('Expected string result from FileReader');
                        }
                        
                        // Deserialize the SVG string to a noteDocument
                        const newDocument = deserializeDocument(result);
                        
                        // Replace the current document with the new one
                        Object.assign(noteDocument, newDocument);
                        updateDocument(noteDocument, renderer);

                        console.log('Document loaded successfully');
                    } catch (error) {
                        console.error('Error loading document:', error);
                        alert(`Error loading document: ${error}`);
                    }
                };
                
                reader.readAsText(file);
            }
        });
        
        // Trigger the file input dialog
        fileInput.click();
    });
}

/**
 * Sets up the paste button event handler
 * @param {HTMLButtonElement} pasteButton - The paste button element
 * @param {Object} noteDocument - The note document
 * @param {StrokeRenderer} renderer - The renderer instance
 * @param {Function} deserializeDocument - Function to deserialize SVG string
 */
function setupPasteButton(pasteButton, noteDocument, renderer, deserializeDocument) {
    pasteButton.addEventListener('click', async () => {
        try {
            // Get text from clipboard
            const text = navigator.clipboard
                ? await navigator.clipboard.readText()
                : (prompt("Paste the SVG code here:") || "");
            
            // Check if it's an SVG
            if (isValidSvg(text)) {
                // Deserialize the SVG string to a noteDocument
                const newDocument = deserializeDocument(text);
                
                Object.assign(noteDocument, newDocument);
                updateDocument(noteDocument, renderer);
                
                console.log('Note pasted from clipboard');
            } else {
                console.log('Clipboard content is not an SVG');
                alert(`Clipboard contents are not an SVG`);
            }
        } catch (error) {
            console.error('Failed to paste from clipboard:', error);
            alert(`Error loading document: ${error}`);
        }
    });
}

/**
 * Sets up the resize button event handler
 * @param {HTMLButtonElement} resizeButton - The resize button element
 * @param {Object} noteDocument - The note document
 * @param {StrokeRenderer} renderer - The renderer instance
 */
function setupResizeButton(resizeButton, noteDocument, renderer) {
    resizeButton.addEventListener('click', () => {
        const sizeStr = prompt("Enter a size (i.e. 480x480)", 
            `${noteDocument.noteSvgAttributes.width}x${noteDocument.noteSvgAttributes.height}`) || "";
        
        const size = parseSizeString(sizeStr);
        
        if (size) {
            noteDocument.noteSvgAttributes.width = size.width;
            noteDocument.noteSvgAttributes.height = size.height;
            updateDocument(noteDocument, renderer);
        }
    });
}

/**
 * Sets up the drawing tool buttons
 * @param {HTMLButtonElement} pencilButton - The pencil button element
 * @param {HTMLButtonElement} eraserButton - The eraser button element
 * @param {Object} noteDocument - The note document
 * @param {StrokeRenderer} renderer - The renderer instance
 */
function setupDrawingTools(pencilButton, eraserButton, noteDocument, renderer) {
    // Pen and eraser button handlers
    pencilButton.addEventListener('click', () => {
        // Set the renderer tool to pen
        renderer.tool = {
            type: "pen",
            color: '#000',
            diameter: 2,
            tolerance: 1.5,
        };
        
        // Update UI to show selected tool
        pencilButton.classList.add('selected');
        eraserButton.classList.remove('selected');
    });
    
    eraserButton.addEventListener('click', () => {
        // Set the renderer tool to eraser
        renderer.tool = {
            type: "eraser",
            diameter: 10,
        };
        
        // Update UI to show selected tool
        eraserButton.classList.add('selected');
        pencilButton.classList.remove('selected');
    });

    eraserButton.addEventListener('dblclick', () => {
        // Prompt to clear document
        if (confirm("Erase all strokes?")) {
            renderer.documentEditor.clearPaths();
            renderer.drawBack();
        }
    });
}

/**
 * Sets up event handlers for all UI buttons
 * @param {Object} noteDocument - The note document to interact with
 * @param {StrokeRenderer} renderer - The renderer instance
 * @param {Function} deserializeDocument - Function to deserialize SVG string
 */
export function setupButtonHandlers(noteDocument, renderer, deserializeDocument) {
    // Get all buttons
    const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save-button'));
    const copyButton = /** @type {HTMLButtonElement} */ (document.getElementById('copy-button'));
    const uploadButton = /** @type {HTMLButtonElement} */ (document.getElementById('upload-button'));
    const pasteButton = /** @type {HTMLButtonElement} */ (document.getElementById('paste-button'));
    const resizeButton = /** @type {HTMLButtonElement} */ (document.getElementById('resize-button'));
    
    // Get pen and eraser buttons
    const pencilButton = /** @type {HTMLButtonElement} */ (document.getElementById('pencil-button'));
    const eraserButton = /** @type {HTMLButtonElement} */ (document.getElementById('eraser-button'));
    
    // Set up individual button handlers
    setupSaveButton(saveButton, noteDocument);
    setupCopyButton(copyButton, noteDocument);
    setupUploadButton(uploadButton, noteDocument, renderer, deserializeDocument);
    setupPasteButton(pasteButton, noteDocument, renderer, deserializeDocument);
    setupResizeButton(resizeButton, noteDocument, renderer);
    setupDrawingTools(pencilButton, eraserButton, noteDocument, renderer);
}

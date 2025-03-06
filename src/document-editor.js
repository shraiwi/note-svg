/**
 * Document editing functionality for the note.svg application
 * 
 * This module handles all document manipulation operations including:
 * - Creating path nodes from stroke data
 * - Managing document structure modifications
 * - Processing intersections for eraser functionality
 * - Converting raw stroke points to SVG path data
 */

import { ShapeInfo, Intersection } from "./kld-intersections.js";
import { roundNumber } from "./utils.js";

/**
 * @typedef {import("./stroke.js").PenTool} PenTool
 * @typedef {import("./stroke.js").EraserTool} EraserTool
 * @typedef {import("./stroke.js").Tool} Tool
 * @typedef {import("./stroke.js").RenderNode} RenderNode
 */

/**
 * Handles document structure modifications
 */
export class DocumentEditor {
    /**
     * Creates a new DocumentEditor instance
     * @param {import("./notesvg").SvgNode} document - The SVG document to edit
     */
    constructor(document) {
        /** @type {RenderNode} */
        this.document = /** @type {RenderNode} */ (document);
    }

    /**
     * Creates a path node from stroke data
     * @param {Array<Array<number>>} stroke - The stroke points
     * @param {PenTool} tool - The tool used for the stroke
     * @returns {RenderNode} The created path node
     */
    createPathFromStroke(stroke, tool) {
        const d = this.generatePathData(stroke);

        const pathNode = {
            tagName: "path",
            attributes: { d, fill: "none" },
            noteSvgAttributes: { 
                stroke: tool.color, 
                strokeWidth: tool.diameter 
            },
            renderAttributes: { path: new Path2D(d), stroke },
            children: [] // Add empty children array to satisfy type requirements
        };
        
        return pathNode;
    }

    /**
     * Adds a path node to the document
     * @param {RenderNode} pathNode - The path node to add
     */
    addPathToDocument(pathNode) {
        this.document.children.push(pathNode);
    }

    /**
     * Creates a path from stroke data and adds it to the document
     * @param {Array<Array<number>>} stroke - The stroke points
     * @param {PenTool} tool - The tool used for the stroke
     * @returns {RenderNode} The created path node
     */
    finalizePenStroke(stroke, tool) {
        const pathNode = this.createPathFromStroke(stroke, tool);
        this.addPathToDocument(pathNode);
        return pathNode;
    }

    /**
     * Generates SVG path data from stroke points
     * @param {Array<Array<number>>} stroke - The stroke points
     * @returns {string} The SVG path data
     */
    generatePathData(stroke) {
        if (stroke.length < 2) {
            return '';
        }

        let bezierCurves = [];
        let d = '';
        
        try {
            // Use fitCurve to simplify the curve
            // The maxError parameter controls how closely the curve follows the original points
            // @ts-ignore - fitCurve is loaded via script tag
            bezierCurves = window.fitCurve(stroke, 2.0);
            
            // Convert the bezier curves to an SVG path string
            if (bezierCurves.length > 0) {
                // Start with a move to the first point
                const firstCurve = bezierCurves[0];
                d += `M ${roundNumber(firstCurve[0][0])} ${roundNumber(firstCurve[0][1])} `;
                
                // Add cubic bezier curves
                for (const curve of bezierCurves) {
                    // Each curve is [startPoint, control1, control2, endPoint]
                    d += `C ${roundNumber(curve[1][0])} ${roundNumber(curve[1][1])}, `;
                    d += `${roundNumber(curve[2][0])} ${roundNumber(curve[2][1])}, `;
                    d += `${roundNumber(curve[3][0])} ${roundNumber(curve[3][1])} `;
                }
            } else {
                // Fallback if fitCurve doesn't produce any curves (e.g., for very short strokes)
                d = `M ${roundNumber(stroke[0][0])} ${roundNumber(stroke[0][1])} `;
                for (let i = 1; i < stroke.length; i++) {
                    d += `L ${roundNumber(stroke[i][0])} ${roundNumber(stroke[i][1])} `;
                }
            }
        } catch (error) {
            console.error("Error in fitCurve:", error);
            // Fallback to simple polyline if fitCurve fails
            d = `M ${stroke[0][0]} ${stroke[0][1]} `;
            for (let i = 1; i < stroke.length; i++) {
                d += `L ${stroke[i][0]} ${stroke[i][1]} `;
            }
        }

        return d;
    }

    /**
     * Filters nodes that intersect with a shape
     * @param {Object} shape - The shape to check for intersections
     * @param {RenderNode} node - The node to filter
     * @param {Array} [removed=[]] - Array to store removed nodes
     * @param {boolean} [keepIntersecting=false] - Whether to keep or remove intersecting nodes
     * @param {boolean} [recurse=true] - Whether to recursively filter children
     * @returns {Array} Array of removed nodes
     */
    filterIntersecting(shape, node, removed = [], keepIntersecting = false, recurse = true) {
        if (typeof node === 'string') return removed;

        node.children = node.children.filter((/** @type {RenderNode | string} */ child) => {
            if (typeof child === "string") return true;

            let childIntersects = false;
            if (child.tagName === 'path') {
                child.renderAttributes ||= {};
                // @ts-ignore - ShapeInfo.path is defined in the kld-intersections library
                child.renderAttributes.shape ||= ShapeInfo.path(child.attributes.d);
        
                // Check for intersections between the path and the line
                // @ts-ignore - Intersection.intersect is defined in the kld-intersections library
                childIntersects = Intersection.intersect(child.renderAttributes.shape, shape).status === "Intersection";
            }

            if (childIntersects) removed.push(child);
            
            if (recurse) this.filterIntersecting(shape, child, [], keepIntersecting, recurse);

            return keepIntersecting || !childIntersects;
        });

        return removed;
    }

    /**
     * Processes an eraser stroke segment and removes intersecting paths
     * @param {Array<number>} start - The start point of the eraser stroke segment
     * @param {Array<number>} end - The end point of the eraser stroke segment
     * @returns {Array} Array of removed nodes
     */
    processEraserStroke(start, end) {
        // @ts-ignore - ShapeInfo.line is defined in the kld-intersections library
        const line = ShapeInfo.line(start, end);
        const removed = [];
        
        // Check for intersections with paths in the document
        this.filterIntersecting(line, this.document, removed);
        
        return removed;
    }

    /**
     * Clears all path elements from the document or a specific node
     * Used for the eraser tool's double-click functionality
     * @param {RenderNode} [node=this.document] - The node to clear paths from
     * @param {Array} [removed=[]] - Array to store removed nodes
     * @param {boolean} [recurse=true] - Whether to recursively clear paths from children
     * @returns {Array} Array of removed path nodes
     */
    clearPaths(node = this.document, removed = [], recurse = true) {
        if (typeof node === 'string') return removed;
        
        if (!node.children) {
            node.children = [];
            return removed;
        }
        
        node.children = node.children.filter((child) => {
            if (typeof child === 'string') return true;
            
            // If it's a path, add it to removed and filter it out
            if (child.tagName === 'path') {
                removed.push(child);
                return false;
            }
            
            // Process children recursively if recurse is true
            if (recurse) {
                this.clearPaths(child, removed, recurse);
            }
            
            return true;
        });
        
        return removed;
    }
}

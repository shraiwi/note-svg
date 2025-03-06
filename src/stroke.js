/**
 * Stroke rendering for the note.svg application
 * 
 * This module focuses on rendering strokes on canvas elements:
 * 1. Front canvas: A transparent overlay for rendering live strokes
 * 2. Back canvas: A canvas for rendering all completed strokes
 * 
 * Document editing operations are delegated to the DocumentEditor class.
 */

import { DocumentEditor } from "./document-editor.js";

/**
 * @typedef {Object} ShapeInfoStatic
 * @property {function(string): Object} path - Creates a path shape from an SVG path string
 * @property {function(Array<number>, Array<number>): Object} line - Creates a line shape from two points
 */

/**
 * @typedef {Object} IntersectionStatic
 * @property {function(Object, Object): {status: string}} intersect - Checks for intersections between two shapes
 */

/**
 * @typedef {(points: Array<Array<number>>, maxError: number) => Array<Array<Array<number>>>} FitCurveFunction
 */

/**
 * @typedef {Object} InkPresenter
 * @property {function(PointerEvent, Object): void} updateInkTrailStartPoint
 */

/**
 * @typedef {Object} InkAPI
 * @property {function(Object): Promise<InkPresenter>} requestPresenter
 */

/**
 * A renderable node.
 * @typedef { import("./notesvg").SvgNode & { 
 *  renderAttributes?: {
 *      path?: Path2D,
 *      points?: Array<Array<number>>,
 *      shape?: any,
 *  }, 
 *  children: Array<RenderNode | string> 
 * } } RenderNode
 */

/**
 * Pen tool configuration
 * @typedef {{
 *  type: "pen",
 *  color: string,
 *  diameter: number,
 *  tolerance: number,
 * }} PenTool
 */

/**
 * Eraser tool configuration
 * @typedef {{
 *  type: "eraser",
 *  diameter: number,
 * }} EraserTool
 */

/**
 * Tool type union
 * @typedef {PenTool | EraserTool} Tool
 */

/**
 * Default tool configuration
 * @type {Tool}
 */
const DEFAULT_TOOL = {
    type: "pen",
    color: '#000',
    diameter: 2,
    tolerance: 1.5,
};

/**
 * Handles stroke rendering
 */
export class StrokeRenderer {
    /**
     * Creates a new StrokeRenderer instance
     * @param {import("./notesvg").SvgNode} svg - The SVG document to render
     * @param {Tool} [tool=DEFAULT_TOOL] - The initial drawing tool
     */
    constructor(svg, tool = DEFAULT_TOOL) {
        // Create canvas elements
        const canvasBack = document.createElement('canvas');
        const canvasFront = document.createElement('canvas');

        /** @type {CanvasRenderingContext2D} */
        this.ctxBack = canvasBack.getContext('2d');
        
        /** @type {CanvasRenderingContext2D} */
        this.ctxFront = canvasFront.getContext('2d', { alpha: true, desynchronized: false });
        
        /** @type {Record<number, { tool: Tool, stroke: Array<Array<number>> }>} */
        this.liveStrokes = {};
        
        /** @type {RenderNode} */
        this.svg = /** @type {RenderNode} */ (svg);

        /** @type {Tool} */
        this.tool = tool;

        /** @type {DocumentEditor} */
        this.documentEditor = new DocumentEditor(svg);

        // Initialize Ink API if available for reduced latency
        /** @type { InkAPI | undefined } */
        const ink = /** @type { { ink?: InkAPI } } */ (navigator).ink;
        if (ink) console.log("using Ink API to reduce latency");

        /** @type {Promise<InkPresenter>|null} */
        this.inkPresenter = ink && ink.requestPresenter();
    }

    /**
     * Gets the bounding box of a node and its children
     * @param {RenderNode | string} node - The node to get the bounding box for
     * @param {boolean} [recurse=true] - Whether to recursively check children
     * @returns {Object|null} - The bounding box or null if node is a string
     */
    getBoundingBox(node, recurse = true) {
        if (typeof node === 'string') return null;
        
        const bbox = {
            min: [0, 0],
            max: [this.svg.noteSvgAttributes.width, this.svg.noteSvgAttributes.height]
        };

        if (node.tagName === 'path') {
            node.renderAttributes ||= {};
            // Path shape is handled by the document editor
            console.log(node.renderAttributes.shape?.getBoundingBox());
        }

        if (recurse) {
            for (const child of node.children || []) {
                const childBbox = this.getBoundingBox(child);
                if (childBbox) {
                    bbox.min[0] = Math.min(bbox.min[0], childBbox.min[0]);
                    bbox.min[1] = Math.min(bbox.min[1], childBbox.min[1]);
                    bbox.max[0] = Math.min(bbox.max[0], childBbox.max[0]);
                    bbox.max[1] = Math.min(bbox.max[1], childBbox.max[1]);
                }
            }
        }
        
        return bbox;
    }
    
    /**
     * Resizes the canvas to match the SVG dimensions
     * @throws {Error} If the document root is not an SVG node
     */
    resizeCanvas() {
        if (this.svg.tagName !== 'svg') {
            throw new Error("Document root is not an SVG node!");
        }

        const pixelScale = window.devicePixelRatio;
        
        const canvasWidth = this.svg.noteSvgAttributes.width * pixelScale;
        const canvasHeight = this.svg.noteSvgAttributes.height * pixelScale;
        
        this.ctxBack.canvas.width = this.ctxFront.canvas.width = canvasWidth;
        this.ctxBack.canvas.height = this.ctxFront.canvas.height = canvasHeight;

        this.ctxBack.transform(pixelScale, 0, 0, pixelScale, 0, 0);
        this.ctxFront.transform(pixelScale, 0, 0, pixelScale, 0, 0);
    }

    /**
     * Clears the front canvas
     */
    clearFront() {
        this.ctxFront.clearRect(0, 0,
            this.ctxFront.canvas.width, this.ctxBack.canvas.height);
    }

    /**
     * Clears and redraws the back canvas with all completed strokes
     */
    drawBack() {
        this.ctxBack.clearRect(0, 0, 
            this.ctxBack.canvas.width, this.ctxBack.canvas.height);
        this.drawNode(this.svg);
    }
    
    /**
     * Draws a node and optionally its children to the back canvas
     * @param {RenderNode | string} node - The node to draw
     * @param {boolean} [recurse=true] - Whether to recursively draw children
     */
    drawNode(node, recurse = true) {
        if (typeof node === "string") return;

        this.ctxBack.lineCap = 'round';
        this.ctxBack.lineJoin = 'round';
        // Don't set fillStyle here as it's not used for paths

        switch (node.tagName) {
            case "path":
                node.renderAttributes ||= {};
                node.renderAttributes.path ||= new Path2D(node.attributes.d); // cache path if there

                // Set stroke style based on node attributes or default to black
                this.ctxBack.beginPath();
                this.ctxBack.strokeStyle = node.noteSvgAttributes?.stroke || '#000';
                this.ctxBack.lineWidth = node.noteSvgAttributes?.strokeWidth || 2;
                this.ctxBack.stroke(node.renderAttributes.path);
                break;

            default:
                break;
        }

        if (recurse) 
            for (const child of node.children || []) this.drawNode(child);
    }

    /**
     * Draws the difference between the previous and current stroke position
     * @param {Tool} tool - The tool being used
     * @param {Array<Array<number>>} stroke - The stroke points
     */
    drawStrokeDiff(tool, stroke, pointerEvent = null) {
        if (stroke.length < 2) return;
        
        switch (tool.type) {
            case 'pen': {
                const latestStart = stroke[Math.max(0, stroke.length - 2)];
                // Draw line segment from last point in stroke to new point on front buffer
                const latestEnd = stroke[stroke.length - 1];
                
                this.ctxFront.beginPath();
                this.ctxFront.moveTo(latestStart[0], latestStart[1]);
                this.ctxFront.lineTo(latestEnd[0], latestEnd[1]);
                this.ctxFront.strokeStyle = tool.color;
                this.ctxFront.lineWidth = tool.diameter;
                this.ctxFront.stroke();

                if (this.inkPresenter && pointerEvent) {
                    this.inkPresenter.then((presenter) => {
                        presenter.updateInkTrailStartPoint(pointerEvent, 
                            { color: tool.color, diameter: tool.diameter });
                    })
                }
                break;
            }
            case 'eraser': {
                const latestEnd = stroke[stroke.length - 1];

                this.clearFront();
                // Draw a circle for erasers
                this.ctxFront.clearRect(0, 0, 
                    this.ctxFront.canvas.width, this.ctxFront.canvas.height);
                this.ctxFront.beginPath();
                this.ctxFront.arc(latestEnd[0], latestEnd[1], 
                    this.tool.diameter * 0.5, 0, Math.PI * 2);
                this.ctxFront.lineWidth = 2.0;
                this.ctxFront.strokeStyle = '#000';
                this.ctxFront.stroke();
                break;
            }
        }
    }

    /**
     * Begins a new stroke when the pointer is pressed
     * @param {number} id - The pointer ID
     * @param {PointerEvent} event - The pointer event
     */
    beginStroke(id, event) {
        const rect = this.ctxFront.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const stroke = [];
        this.liveStrokes[id] = { tool: this.tool, stroke };

        stroke.push([x, y]);

        this.drawStrokeDiff(this.tool, stroke);
    }

    /**
     * Updates a stroke as the pointer moves
     * @param {number} id - The pointer ID
     * @param {PointerEvent} event - The pointer event
     */
    moveStroke(id, event) {
        const rect = this.ctxFront.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const { stroke, tool } = this.liveStrokes[id] || {};
        if (!stroke) return;

        if (tool?.type === 'eraser') {
            const latestStart = stroke[Math.max(0, stroke.length - 1)];
            
            if (latestStart) {
                // Process eraser stroke using the document editor
                const removed = this.documentEditor.processEraserStroke(latestStart, [x, y]);

                if (removed.length > 0) this.drawBack();
            }
        }

        stroke.push([x, y]);
        this.drawStrokeDiff(tool, stroke, event);
    }

    /**
     * Finalizes a stroke when the pointer is released
     * @param {number} id - The pointer ID
     * @param {PointerEvent} event - The pointer event
     */
    endStroke(id, event) {
        this.moveStroke(id, event);

        // Get the stroke and tool
        const { stroke = null, tool = null } = this.liveStrokes[id];
        if (!stroke) return;
        
        // Handle different tool types
        if (tool.type === "pen" && stroke.length >= 2) {
            // Delegate to document editor
            this.documentEditor.finalizePenStroke(stroke, tool);
        } 
        // For eraser, we've already removed the intersecting paths during moveStroke
        // No need to add a new path to the document

        // Clear the front buffer
        this.ctxFront.clearRect(0, 0, 
            this.ctxFront.canvas.width, this.ctxFront.canvas.height);

        delete this.liveStrokes[id];

        // Trigger back buffer render
        this.drawBack();
    }
}

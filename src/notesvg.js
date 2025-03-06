/**
 * SVG node handling for the note.svg application
 * 
 * This module provides utilities for transforming and serializing SVG nodes
 * for the note.svg application. It handles the conversion between the internal
 * representation and the SVG format.
 */

/**
 * SVG root node
 * @typedef {Object} NodeSvg
 * @property {string} tagName - Always "svg"
 * @property {Object} attributes - SVG attributes
 * @property {Object} noteSvgAttributes - Note.svg specific attributes
 * @property {number} noteSvgAttributes.width - Width of the SVG
 * @property {number} noteSvgAttributes.height - Height of the SVG
 * @property {Array<SvgNode|string>} children - Child nodes
 */

/**
 * Note.svg metadata node
 * @typedef {Object} NodeNoteSvg
 * @property {string} tagName - Always "notesvg"
 * @property {Object} attributes - SVG attributes
 * @property {Object} noteSvgAttributes - Note.svg specific attributes
 * @property {string} noteSvgAttributes.version - Note.svg version
 * @property {Array<SvgNode|string>} children - Child nodes
 */

/**
 * Path node
 * @typedef {Object} NodePath
 * @property {string} tagName - Always "path"
 * @property {Object} attributes - SVG attributes
 * @property {Object} noteSvgAttributes - Note.svg specific attributes
 * @property {string} noteSvgAttributes.stroke - Stroke color
 * @property {number} noteSvgAttributes.strokeWidth - Stroke width
 * @property {Array<SvgNode|string>} children - Child nodes
 */

/**
 * A note.svg node
 * @typedef { import("./txml.js").tNode & { 
 *  noteSvgAttributes?: Record<string, any>, 
 *  children: Array<SvgNode | string> 
 * } } SvgNode
 */

/**
 * In-place transforms a tree of XML nodes into SvgNodes
 * @param {import("./txml.js").tNode | string} node - The node to transform
 * @returns {SvgNode | string} - The transformed node
 */
export function transform(node) {
    if (typeof node === 'string') return node;

    // Add noteSvgAttributes based on node type
    switch (node.tagName) {
        case 'svg':            
            (/** @type {SvgNode} */ (node)).noteSvgAttributes = {
                width: parseInt(node.attributes.width) || 0,
                height: parseInt(node.attributes.height) || 0
            };

            // Remove parsed attributes
            delete node.attributes.width;
            delete node.attributes.height;
            break;

        case 'notesvg':
            (/** @type {SvgNode} */ (node)).noteSvgAttributes = {
                version: node.attributes.version || undefined
            };
            // Remove parsed attributes
            delete node.attributes.version;
            break;

        case 'path':
            (/** @type {SvgNode} */ (node)).noteSvgAttributes = {
                stroke: node.attributes.stroke || '#000',
                strokeWidth: parseFloat(node.attributes['stroke-width']) || 1
            };

            // Remove parsed attributes
            delete node.attributes.stroke;
            delete node.attributes['stroke-width'];
            break;
    }

    // Recursively transform children in-place
    for (const child of node.children || []) {
        transform(child);
    }
}

/**
 * Converts a tree of SvgNodes to an SVG string
 * @param {SvgNode | string} node - The node to convert
 * @param {string | null} [overrideStroke=null] - The color to override the strokes with.
 * @param {string | null} [overrideBg=null] - The color to override the background color with.
 * @returns {string} - The SVG string representation
 */
export function toSvg(node, overrideStroke=null, overrideBg=null) {
    if (typeof node === 'string') return node;
    // Start with existing attributes from node.
    let attributes = { ...node.attributes };
    // For specific tag names, merge properties from noteSvgAttributes appropriately.
    switch (node.tagName) {
        case "svg":
            // For 'svg', add width and height from noteSvgAttributes.
            attributes.width = node.noteSvgAttributes.width;
            attributes.height = node.noteSvgAttributes.height;
            if (overrideStroke && overrideBg)
                attributes.style = `border: 2px solid ${overrideStroke}; background-color: ${overrideBg};`;
            break;
        case "notesvg":
            // For 'notesvg', add version from noteSvgAttributes.
            attributes.version = node.noteSvgAttributes.version;
            break;
        case "path":
            // For 'path', serialize the array of commands in d to a string.
            attributes.stroke = overrideStroke || node.noteSvgAttributes.stroke;
            attributes["stroke-width"] = node.noteSvgAttributes.strokeWidth;
            break;
    }
    // Construct attribute string.
    let attrString = "";
    for (const key in attributes) {
        attrString += ` ${key}="${attributes[key]}"`;
    }
    // Open tag.
    let svg = `<${node.tagName}${attrString}>`;
    // Recursively serialize children.
    if (node.children && node.children.length > 0) {
        for (const child of node.children) {
            svg += toSvg(child, overrideStroke, overrideBg);
        }
    }
    // Closing tag.
    svg += `</${node.tagName}>`;
    return svg;
}

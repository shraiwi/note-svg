## `note.svg`: A Minimal SVG Subset for Handwritten Annotations

`note.svg` is a lightweight SVG subset for storing handwritten notes and annotations. It uses a small subset of SVG chosen to be the bare minimum for storing handwritten paths.
### Allowed Elements

#### `<svg>`: Root Element
- **Purpose:** Wraps the entire `note.svg` document.
- **Required Attributes:**
    - `xmlns="http://www.w3.org/2000/svg"`
    - `width` and `height` (or a `viewBox`) that defines the drawing area.
- **Allowed Children:**
	- Optional `<metadata>` element. If present, it is recommended to be the first element.
	- Any number of `<path>` elements.
#### `<metadata>`: Versioning and Metadata
- **Purpose:** Provides versioning information and other descriptive metadata.
- **Required Children:** 
	- `<notesvg/>` element with the following attributes:
		- `version`: The `note.svg` spec version.
- **Example Content:**
    ```xml
    <metadata>
      <notesvg version="1.0"/>
    </metadata>
    ```
#### `<path>`: Handwritten Strokes
- **Purpose:** Represents freeform handwritten strokes.
- **Allowed Path Data Commands:**  
    - **`M {x} {y}`**: Move to the starting point.
    - **`L {x} {y}`**: Draw a line to the next point.
- **Allowed Attributes:**
    - `d`: The path data using only `M` and `L` commands.
    - `stroke`: Stroke color as a 6-digit hex color code (`#abcdef`)
    - `stroke-width`: Stroke thickness as a number.
    - `fill`: Always set to `"none"`.
- **Allowed Children**: None. Recommended to be self-closing.

### Example `note.svg` Document

Below is a complete `note.svg` document that includes metadata for versioning, layers for separating elements, and the necessary drawing primitives.

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="300" viewBox="0 0 500 300">
  <!-- Metadata for versioning and additional information -->
  <metadata>
    <notesvg version="0.1"/>
  </metadata>

  <path d="M 30 50 L 35 55 L 40 53 L 45 60 L 50 58" 
    stroke="#000000" stroke-width="2" fill="none"/>
</svg>
```

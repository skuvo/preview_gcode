# G-code Visualization Tool

A web-based tool for visualizing, editing, and analyzing G-code for CNC machines, 3D printers, and other computer-controlled manufacturing equipment.

## Features

### Real-time G-code Visualization
- **Interactive Canvas**: Visualize G-code paths in real-time as you edit
- **Node Visualization**: Clearly see path nodes with numbered indices
- **Hover Interaction**: Hover over nodes to see their corresponding code line
- **Expandable Nodes**: Click on overlapping nodes to expand and view all paths

### Powerful G-code Editor
- **Syntax Highlighting**: Color-coded G-code for better readability
- **Line Numbers**: Clear line numbering that corresponds to node indices
- **Find & Replace**: Comprehensive search functionality with options
- **Code Formatting**: One-click G-code formatting for clean, consistent code
- **Error Checking**: Built-in validation to identify potential G-code issues

### Coordinate Table
- **Synchronized Editing**: Edit coordinates in a table format that updates in real-time with the G-code
- **Bidirectional Updates**: Changes in the table reflect in the G-code and vice versa
- **Row Management**: Add or delete coordinate rows easily
- **Visual Selection**: Select rows to highlight corresponding paths

### User-Friendly Interface
- **Bilingual Support**: Switch between Chinese and English interfaces
- **Responsive Design**: Works on various screen sizes
- **Persistent Settings**: Your language preference is saved between sessions

## How to Use

### Getting Started
1. Open the tool in a web browser (no installation required)
2. The default G-code example will be loaded and visualized automatically
3. Edit the G-code in the editor or use the coordinate table to modify paths

### Editing G-code
- Type directly in the editor to modify G-code
- Use the toolbar buttons for additional functionality:
  - 🔍 Find and replace text
  - 📝 Format G-code for better readability
  - ⚠️ Check for errors in your G-code
  - 🔄 Refresh the visualization

### Working with the Coordinate Table
- Use the ↓ button to update the table from current G-code
- Use the ↑ button to apply table changes to the G-code
- Click + to add a new coordinate row
- Select a row and click - to delete it
- Click on any cell to edit coordinates directly

### Interacting with the Visualization
- Hover over nodes to see their index and corresponding code line
- Click on overlapping nodes to expand and view all paths
- Click on the center of expanded nodes to collapse the view

### Changing Language
- Click on the language buttons (中文/English) in the top-right corner to switch between Chinese and English

## Technical Details

### Supported G-code Commands
- G0/G1: Linear movement
- G90: Absolute positioning
- G91: Relative positioning
- Comments (using semicolon)

### Browser Compatibility
- Works with modern browsers that support HTML5 Canvas
- Recommended browsers: Chrome, Firefox, Safari, Edge

## Development

This tool is built using vanilla JavaScript, HTML5, and CSS, with no external dependencies. The visualization is rendered using the HTML5 Canvas API.

Key components:
- `index.html`: Main structure and UI elements
- `style.css`: Styling and layout
- `script.js`: All functionality including G-code parsing, visualization, and UI interaction

## License

MIT License

## Acknowledgements

This tool was created to simplify G-code visualization and editing for makers, hobbyists, and professionals working with CNC machines and 3D printers. 
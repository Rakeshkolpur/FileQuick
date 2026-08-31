# PDF Editor Application

A comprehensive PDF editing web application that converts PDFs to editable format while preserving formatting.

## Features

- Upload and convert PDF documents to editable format
- Drag-and-drop text editing with formatting options (font size, color, alignment)
- Page management (add, delete, duplicate pages)
- Image insertion and manipulation
- Document download in PDF or DOCX format
- Modern Google Docs-like interface with smooth animations

## Tech Stack

### Frontend
- React.js
- React Konva for canvas-based editing
- Framer Motion for animations
- React Router for navigation
- Axios for API requests

### Backend
- Flask (Python) for PDF processing
- PyMuPDF for PDF rendering and manipulation
- pdfplumber for structure extraction
- python-docx for Word document creation
- Express.js for server proxy

## Setup

### Prerequisites
- Node.js (v14+)
- Python (v3.8+)
- Git

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd pdf-editor-app
```

2. Install frontend dependencies
```bash
npm install
```

3. Install backend dependencies
```bash
cd server
pip install -r requirements.txt
cd ..
```

### Running the Application

1. Start the development server (frontend)
```bash
npm run dev
```

2. Start the backend server
```bash
npm run server
```

3. Access the application at `http://localhost:5173`

## Project Structure

```
.
├── src/
│   ├── components/
│   │   └── tools/                      # one component per tool (image/ pdf/ conversion/)
│   ├── lib/                            # shared engines (pdfjs, pdfAnnotate, api, zip, …)
│   ├── data/
│   │   └── tools.jsx                   # tool registry (id, title, lazy loader)
│   ├── routes.jsx                      # app routes
│   └── main.jsx                        # application entry point
├── server/
│   ├── convert_server.py               # the one Flask service — every server-side endpoint
│   ├── requirements.txt                # Python dependencies
│   └── Dockerfile                      # production image (LibreOffice + fonts baked in)
└── package.json                        # `npm run dev`, `npm run server`, `npm run build`
```

All server-side work (Word↔PDF, unlock, protect, compress, fill & sign) runs through the
single `server/convert_server.py` Flask app on port 5000. Start it with `npm run server`.

## Usage

1. Navigate to the PDF Editor tool from the homepage
2. Upload a PDF file by dragging and dropping or using the file browser
3. Edit the document using the toolbar options:
   - Add text with formatting options
   - Insert images
   - Manage pages
   - Apply text formatting (font, size, color, alignment)
4. Save your document as PDF or Word
5. Download the edited document

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

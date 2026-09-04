import React, { useState, useRef, useEffect } from 'react';

const PdfToJpg = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfUrl, setPdfUrl] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImages, setPageImages] = useState([]);
  const [convertedPages, setConvertedPages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageQuality, setImageQuality] = useState(90);
  const [pageRange, setPageRange] = useState('all');
  const [customRange, setCustomRange] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [, setIsRendering] = useState(false);
  
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const pdfOutputRef = useRef(null);
  const resultsSectionRef = useRef(null);
  
  // Load PDF.js library
  useEffect(() => {
    const loadLibraries = async () => {
      setLoading(true);
      
      try {
        // Use the bundled pdf.js (same as every other PDF tool) — no CDN, works offline.
        if (!window.pdfjsLib) {
          const { pdfjsLib } = await import('../../../lib/pdfjs');
          window.pdfjsLib = pdfjsLib;
        }
      } catch (err) {
        console.error('Error loading libraries:', err);
        setError(`Failed to load necessary libraries: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadLibraries();
    
    // Cleanup
    return () => {
      const scripts = document.querySelectorAll('script[src*="pdf.js"]');
      scripts.forEach(script => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      });
    };
  }, []);
  
  const handleButtonClick = () => {
    fileInputRef.current.click();
  };
  
  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      handleFile(file);
    }
  };
  
  const handleFile = async (file) => {
    // Check if file is a PDF
    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }
    
    setError(null);
    resetState();
    
    try {
      setIsProcessing(true);
      setPdfName(file.name);
      
      // Create object URL for the file
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setPdfFile(file);
      
      // Load the PDF using PDF.js
      const loadingTask = window.pdfjsLib.getDocument(url);
      
      loadingTask.promise.then(async (pdf) => {
        setTotalPages(pdf.numPages);
        
        // Reset page state
        setCurrentPage(1);
        setPageImages([]);
        
        // Scroll to the PDF preview after a short delay
        setTimeout(() => {
          if (pdfOutputRef.current) {
            pdfOutputRef.current.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        }, 300);
        
        setIsProcessing(false);
      }).catch(error => {
        console.error('Error loading PDF:', error);
        setError(`Error loading PDF: ${error.message}`);
        setIsProcessing(false);
      });
    } catch (err) {
      console.error('Error handling PDF file:', err);
      setError(`Error handling PDF: ${err.message}`);
      setIsProcessing(false);
    }
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFile(file);
    }
  };
  
  const renderPage = async (pageNum) => {
    if (!pdfUrl || !window.pdfjsLib) return;
    
    try {
      setIsRendering(true);
      const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);
      
      // Use a higher scale for better image quality
      const viewport = page.getViewport({ scale: 2.0 });
      
      // Set canvas dimensions
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Render PDF page into canvas context
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to image
      const imgData = canvas.toDataURL('image/jpeg', imageQuality / 100);
      
      // Create preview image with page number
      setPageImages(prev => {
        // Check if we already have this page
        const exists = prev.findIndex(p => p.pageNum === pageNum) !== -1;
        if (exists) {
          // Replace existing page
          return prev.map(p => p.pageNum === pageNum ? { pageNum, imgData } : p);
        } else {
          // Add new page
          return [...prev, { pageNum, imgData }];
        }
      });
      
      setIsRendering(false);
      return imgData;
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      setError(`Error rendering page ${pageNum}: ${err.message}`);
      setIsRendering(false);
      return null;
    }
  };
  
  const convertPdfToJpg = async () => {
    if (!pdfUrl || !window.pdfjsLib) {
      setError('Please upload a PDF file first or wait for the library to load');
      return;
    }
    
    setError(null);
    setConvertedPages([]);
    setIsProcessing(true);
    setProgress(0);
    
    try {
      // Parse page range
      let pagesToConvert = [];
      
      if (pageRange === 'all') {
        // Convert all pages
        pagesToConvert = Array.from({ length: totalPages }, (_, i) => i + 1);
      } else if (pageRange === 'current') {
        // Convert only current page
        pagesToConvert = [currentPage];
      } else if (pageRange === 'custom') {
        // Parse custom range (e.g., "1,3,5-7")
        try {
          const parts = customRange.split(',').map(part => part.trim());
          
          for (const part of parts) {
            if (part.includes('-')) {
              // Range like "5-7"
              const [start, end] = part.split('-').map(Number);
              if (isNaN(start) || isNaN(end) || start < 1 || end > totalPages) {
                throw new Error(`Invalid range: ${part}`);
              }
              for (let i = start; i <= end; i++) {
                pagesToConvert.push(i);
              }
            } else {
              // Single page like "3"
              const pageNum = Number(part);
              if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
                throw new Error(`Invalid page number: ${part}`);
              }
              pagesToConvert.push(pageNum);
            }
          }
        } catch (err) {
          setError(`Error parsing page range: ${err.message}`);
          setIsProcessing(false);
          return;
        }
      }
      
      // Remove duplicates and sort
      pagesToConvert = [...new Set(pagesToConvert)].sort((a, b) => a - b);
      
      if (pagesToConvert.length === 0) {
        setError('No valid pages to convert');
        setIsProcessing(false);
        return;
      }
      
      console.log(`Converting ${pagesToConvert.length} pages: ${pagesToConvert.join(', ')}`);
      
      // Process each page
      const convertedImages = [];
      for (let i = 0; i < pagesToConvert.length; i++) {
        const pageNum = pagesToConvert[i];
        
        // Update progress
        setProgress(Math.round(((i + 0.5) / pagesToConvert.length) * 100));
        
        // Check if we already have this page rendered
        const existingPage = pageImages.find(p => p.pageNum === pageNum);
        if (existingPage) {
          convertedImages.push({
            pageNum,
            imgData: existingPage.imgData,
            fileName: `${pdfName.replace('.pdf', '')}_page_${pageNum}.jpg`
          });
          continue;
        }
        
        // Render the page if not already rendered
        const imgData = await renderPage(pageNum);
        if (imgData) {
          convertedImages.push({
            pageNum,
            imgData,
            fileName: `${pdfName.replace('.pdf', '')}_page_${pageNum}.jpg`
          });
        }
      }
      
      setConvertedPages(convertedImages);
      
      // Scroll to results section
      setTimeout(() => {
        if (resultsSectionRef.current) {
          resultsSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }, 300);
      
    } catch (err) {
      console.error('Error converting PDF to JPG:', err);
      setError(`Error converting PDF to JPG: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress(100);
    }
  };
  
  const downloadImage = (imgData, fileName) => {
    try {
      const link = document.createElement('a');
      link.href = imgData;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading image:', err);
      setError(`Error downloading image: ${err.message}`);
    }
  };
  
  const downloadAllImages = () => {
    try {
      convertedPages.forEach((page, index) => {
        // Stagger downloads slightly to prevent browser issues
        setTimeout(() => {
          downloadImage(page.imgData, page.fileName);
        }, index * 300);
      });
    } catch (err) {
      console.error('Error downloading all images:', err);
      setError(`Error downloading all images: ${err.message}`);
    }
  };
  
  const resetState = () => {
    // Clean up object URLs
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }
    
    setPdfFile(null);
    setPdfName('');
    setPdfUrl(null);
    setTotalPages(0);
    setCurrentPage(1);
    setPageImages([]);
    setConvertedPages([]);
    setProgress(0);
    setPageRange('all');
    setCustomRange('');
  };
  
  return (
    <div className="flex flex-col space-y-4">
      {/* Tool navbar */}
      <div className="bg-gray-900 p-4 flex space-x-4 rounded-t-xl">
        <button className="px-4 py-2 flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
          <span>PDF to JPG</span>
        </button>
      </div>
      
      {/* Main content area */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-b-xl">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
            Convert PDF to JPG Images
          </h1>
          
          {/* Upload Area - Show if no PDF is uploaded yet */}
          {!pdfFile && (
            <div 
              className={`
                border-4 border-dashed rounded-2xl p-8 text-center transition-all duration-300 mb-8
                ${isDragging 
                  ? 'border-pink-500 bg-pink-50 dark:bg-pink-900 dark:bg-opacity-10 animate-pulse scale-105' 
                  : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50 dark:border-gray-600 dark:hover:border-pink-400 dark:hover:bg-gray-700'
                }
                cursor-pointer relative overflow-hidden group
              `}
              onClick={handleButtonClick}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-pink-200 to-purple-200 dark:from-pink-900 dark:to-purple-900 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-xl"></div>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={onSelectFile}
                accept="application/pdf"
                className="hidden"
              />
              
              <div className="py-6">
                <div className="mb-4 flex justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-16 w-16 ${isDragging ? 'text-pink-600' : 'text-gray-400'} transition-colors duration-300`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className={`text-xl font-semibold mb-2 ${isDragging ? 'text-pink-600' : 'text-gray-700'} dark:text-white transition-colors duration-300`}>
                  {isDragging ? 'Drop your PDF here!' : 'Drag & Drop your PDF here'}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  or click to browse your files
                </p>
                {error && (
                  <p className="text-red-500 text-sm mb-4">{error}</p>
                )}
                <div className="text-sm text-gray-400 dark:text-gray-500">
                  Supports PDF files up to 100MB
                </div>
              </div>
            </div>
          )}
          
          {/* PDF Preview */}
          {pdfFile && (
            <div className="mb-8 bg-white dark:bg-gray-700 rounded-xl shadow-md overflow-hidden" ref={pdfOutputRef}>
              <div className="bg-pink-600 text-white py-3 px-6 flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  {pdfName} ({totalPages} {totalPages === 1 ? 'page' : 'pages'})
                </h2>
                <button
                  onClick={resetState}
                  className="text-white hover:text-pink-200 transition-colors"
                  title="Remove PDF"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6">
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Page Range
                  </label>
                  <div className="flex flex-wrap gap-4 mb-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="all"
                        checked={pageRange === 'all'}
                        onChange={() => setPageRange('all')}
                        className="form-radio h-4 w-4 text-pink-600"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">All Pages</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="current"
                        checked={pageRange === 'current'}
                        onChange={() => setPageRange('current')}
                        className="form-radio h-4 w-4 text-pink-600"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Current Page</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        value="custom"
                        checked={pageRange === 'custom'}
                        onChange={() => setPageRange('custom')}
                        className="form-radio h-4 w-4 text-pink-600"
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Custom Range</span>
                    </label>
                  </div>
                  
                  {pageRange === 'custom' && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={customRange}
                        onChange={(e) => setCustomRange(e.target.value)}
                        placeholder="e.g. 1,3,5-7"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 px-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Enter page numbers separated by commas, or ranges like 1-5
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Image Quality ({imageQuality}%)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={imageQuality}
                    onChange={(e) => setImageQuality(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>Lower Quality (Smaller Files)</span>
                    <span>Higher Quality (Larger Files)</span>
                  </div>
                </div>
                
                <div className="flex justify-center">
                  <button
                    onClick={convertPdfToJpg}
                    disabled={isProcessing || loading}
                    className={`px-6 py-3 rounded-lg text-white text-center font-medium
                      ${isProcessing || loading
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-pink-600 hover:bg-pink-700'
                      } transition-colors`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center space-x-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Converting... {progress}%</span>
                      </div>
                    ) : (
                      'Convert PDF to JPG'
                    )}
                  </button>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                    Preview
                  </h3>
                  
                  <div className="rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 flex justify-center items-center">
                    <iframe
                      src={pdfUrl && `${pdfUrl}#page=${currentPage}`}
                      title="PDF Preview"
                      className="w-full h-[500px] border-0"
                    />
                  </div>
                  
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center space-x-4 mt-4">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage <= 1}
                        className={`p-2 rounded ${
                          currentPage <= 1
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-pink-600 hover:bg-pink-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      
                      <span className="text-gray-700 dark:text-gray-300">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className={`p-2 rounded ${
                          currentPage >= totalPages
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-pink-600 hover:bg-pink-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  )}
                  
                  {/* Hidden canvas for PDF rendering */}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              </div>
            </div>
          )}
          
          {/* Converted Images Results */}
          {convertedPages.length > 0 && (
            <div className="mb-8 bg-white dark:bg-gray-700 rounded-xl shadow-md p-6" ref={resultsSectionRef}>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center justify-between">
                <span>Converted Images ({convertedPages.length})</span>
                <button
                  onClick={downloadAllImages}
                  className="text-sm px-3 py-1 bg-green-100 text-green-600 rounded hover:bg-green-200 dark:bg-green-900 dark:bg-opacity-30 dark:text-green-400 dark:hover:bg-opacity-50 transition-colors"
                >
                  Download All
                </button>
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {convertedPages.map((page, index) => (
                  <div
                    key={index}
                    className="relative bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden group"
                  >
                    <div className="aspect-w-8 aspect-h-11 bg-gray-100 dark:bg-gray-900">
                      <img
                        src={page.imgData}
                        alt={`Page ${page.pageNum}`}
                        className="object-contain w-full h-full"
                      />
                    </div>
                    
                    <div className="p-3">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        Page {page.pageNum}
                      </p>
                    </div>
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => downloadImage(page.imgData, page.fileName)}
                        className="p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600"
                        title="Download image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* How it works section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8 mt-8">
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">1. Upload PDF</h3>
                <p className="text-gray-600 dark:text-gray-400">Upload your PDF document. You can preview the pages before conversion.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">2. Choose Settings</h3>
                <p className="text-gray-600 dark:text-gray-400">Select page range, adjust image quality, and customize conversion options.</p>
              </div>
              <div className="flex flex-col items-center text-center p-4">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900 rounded-full flex items-center justify-center text-pink-600 dark:text-pink-400 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">3. Download JPGs</h3>
                <p className="text-gray-600 dark:text-gray-400">Convert and download high-quality JPG images from your PDF pages.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfToJpg; 
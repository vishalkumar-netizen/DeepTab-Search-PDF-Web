// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'PARSE_PDF') {
        extractTextFromPDF(msg.url)
            .then(text => sendResponse({ text: text }))
            .catch(err => {
                console.error("PDF extraction failed", err);
                sendResponse({ text: "" });
            });
        return true; // Indicates asynchronous response
    }
});

async function extractTextFromPDF(url) {
    // Fetch the PDF file
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();

    // Load PDF using pdf.js
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from every page
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Join the text blocks
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + ' ';
    }
    
    return fullText;
}
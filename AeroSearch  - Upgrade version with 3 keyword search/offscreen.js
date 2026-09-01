// Configure worker path for PDF.js processing
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
}

// Listen for extraction requests from background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'PARSE_PDF') {
        extractTextFromPDF(msg.url)
            .then(text => sendResponse({ text: text }))
            .catch(err => {
                console.error("PDF extraction failed:", err);
                sendResponse({ text: "" });
            });
        return true; // Indicates asynchronous response channel
    }
});

/**
 * Fetches and parses a PDF document to extract all text contents across pages.
 * @param {string} url - The URL or blob path of the PDF document.
 * @returns {Promise<string>} The full concatenated text of the PDF.
 */
async function extractTextFromPDF(url) {
    let pdf = null;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();

        const loadingTask = pdfjsLib.getDocument({
            data: arrayBuffer,
            stopAtErrors: false
        });

        pdf = await loadingTask.promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();

                // Concatenate string items safely
                const pageText = textContent.items
                    .map(item => item.str || '')
                    .join(' ');

                fullText += pageText + ' ';

                // Release individual page memory
                if (typeof page.cleanup === 'function') {
                    page.cleanup();
                }
            } catch (pageErr) {
                console.warn(`Error extracting text from page ${i}:`, pageErr);
            }
        }

        return fullText.trim();
    } catch (error) {
        console.error("Error processing PDF in offscreen document:", error);
        return "";
    } finally {
        if (pdf) {
            try {
                pdf.destroy();
            } catch (destroyErr) {
                // Ignore cleanup errors
            }
        }
    }
}
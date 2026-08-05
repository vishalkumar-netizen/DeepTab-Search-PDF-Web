let state = {
    status: 'IDLE', // IDLE, SEARCHING, PAUSED
    tabs: [],
    currentIndex: 0,
    totalTabs: 0,
    keyword: '',
    closeNoMatch: false,
    matchFound: false
};

// 🌟 FIX 1: Robust UI Opening Fallback
try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        chrome.sidePanel.setPanelBehavior({ openPanelOnActionIconClick: true }).catch(() => {});
    }
} catch(e) {}

chrome.action.onClicked.addListener((tab) => {
    // Fallback: If side panel doesn't open automatically, force a floating popup window
    if (chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
            chrome.windows.create({ url: 'popup.html', type: 'popup', width: 340, height: 500 });
        });
    } else {
        chrome.windows.create({ url: 'popup.html', type: 'popup', width: 340, height: 500 });
    }
});

// 🌟 FIX 2: Bulletproof Offscreen Setup that won't crash on older browsers
async function setupOffscreenDocument() {
    try {
        if (chrome.offscreen.hasDocument) {
            if (await chrome.offscreen.hasDocument()) return;
        } else {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
            if (contexts.length > 0) return;
        }
    } catch (e) {
        // Ignore checks if browser is older
    }
    
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_PARSER'],
            justification: 'Parse PDF files securely to extract text'
        });
    } catch (err) {
        if (!err.message.includes('Only a single offscreen document')) {
            console.error('Offscreen Error:', err);
        }
    }
}

// 🌟 FIX 3: Removed the bug that was intercepting and blocking the PDF scan
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'GET_STATE') {
        sendResponse(state);
    } else if (msg.action === 'START') {
        state.keyword = msg.keyword.toLowerCase();
        state.closeNoMatch = msg.closeNoMatch;
        state.status = 'SEARCHING';
        state.currentIndex = 0;
        state.matchFound = false;
        
        chrome.tabs.query({ currentWindow: true }, (tabs) => {
            // Ignore chrome:// and the extension itself so it doesn't close them
            state.tabs = tabs.filter(t => {
                const u = t.url || "";
                return !u.startsWith('chrome://') && !u.startsWith('chrome-extension://');
            });
            state.totalTabs = state.tabs.length;
            broadcastState();
            setupOffscreenDocument().then(processNextTab);
        });
    } else if (msg.action === 'PAUSE') {
        state.status = 'PAUSED';
        broadcastState();
    } else if (msg.action === 'RESUME') {
        state.status = 'SEARCHING';
        broadcastState();
        processNextTab();
    } else if (msg.action === 'STOP') {
        state.status = 'IDLE';
        broadcastState();
    }
    
    // CRITICAL FIX: No "return true;" here anymore. It now correctly lets offscreen.js reply!
});

function broadcastState() {
    chrome.runtime.sendMessage({ action: 'STATE_UPDATE', state: state }).catch(() => {});
}

async function processNextTab() {
    if (state.status !== 'SEARCHING') return;
    
    // Check if we have reached the end of the tabs
    if (state.currentIndex >= state.tabs.length) {
        state.status = 'IDLE';
        if (!state.matchFound) {
            showNotification("Search Finished", "No match found in any tab.");
        } else {
            showNotification("Search Complete 🎯", "Finished scanning all tabs.");
        }
        broadcastState();
        return;
    }

    const currentTab = state.tabs[state.currentIndex];
    state.currentIndex++;
    broadcastState();
    
    // Safely get the URL and Title to prevent undefined crashes
    const url = currentTab.url || currentTab.pendingUrl || "";
    const title = currentTab.title || url || "Unknown Tab";
    
    // Update popup with current tab title
    chrome.runtime.sendMessage({ action: 'TAB_UPDATE', title: title }).catch(() => {});

    try {
        let isMatch = false;

        // Determine if it's a PDF or HTML page safely
        if (url.toLowerCase().includes('.pdf')) {
            try {
                // Ask offscreen document to parse PDF Safely
                const response = await chrome.runtime.sendMessage({
                    action: 'PARSE_PDF',
                    url: url
                });
                const text = response && response.text ? response.text.toLowerCase() : "";
                isMatch = text.includes(state.keyword);
            } catch (pdfErr) {
                console.log("PDF skipped or unreadable:", pdfErr);
            }
        } else {
            try {
                // Execute script to extract text from normal HTML page safely
                const results = await chrome.scripting.executeScript({
                    target: { tabId: currentTab.id },
                    func: () => document.body ? document.body.innerText.toLowerCase() : ""
                });
                const text = results && results[0] && results[0].result ? results[0].result : "";
                isMatch = text.includes(state.keyword);
            } catch (htmlErr) {
                console.log("Restricted page skipped:", htmlErr);
            }
        }

        if (isMatch) {
            state.matchFound = true;
            
            if (state.closeNoMatch) {
                // SCENARIO 2: BULK CLEANUP
                setTimeout(processNextTab, 300);
            } else {
                // SCENARIO 1: ONE-BY-ONE
                await chrome.tabs.update(currentTab.id, { active: true }).catch(() => {});
                showNotification("Match Found! 🎯", `Found "${state.keyword}" in tab: ${title}`);
                
                // PAUSE here. Wait for you to press "Resume".
                state.status = 'PAUSED';
                broadcastState();
                return; 
            }
        } else {
            // NO MATCH FOUND
            if (state.closeNoMatch) {
                // Bulk Cleanup: Delete the useless tab.
                await chrome.tabs.remove(currentTab.id).catch(() => {});
            }
            setTimeout(processNextTab, 300); 
        }

    } catch (fatalError) {
        setTimeout(processNextTab, 300); 
    }
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVQ4T2NkYGD4z8DAwMgwCoGAkZGB4T9UHAOYGIYgRjEwMAABUwMDEwPDf6g4BqCaIQxYNBkYGNiQNCGahGwQMmPQDUBXDIv/uEwYdQMoFoPDIQZGwAijFhAMYf4j1gICwAAArXUuS8w1k1EAAAAASUVORK5CYII=',
        title: title,
        message: message,
        priority: 2
    });
}
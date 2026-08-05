document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');
    const keywordInput = document.getElementById('keyword');
    const closeNoMatch = document.getElementById('closeNoMatch');
    const progressText = document.getElementById('progressText');
    const statusText = document.getElementById('statusText');

    // Update UI based on background state
    function updateUI(state) {
        progressText.innerText = `${state.currentIndex} / ${state.totalTabs}`;
        
        // 🌟 FIX: Restore the keyword and checkbox automatically!
        if (state.keyword) {
            keywordInput.value = state.keyword;
        }
        if (state.closeNoMatch !== undefined) {
            closeNoMatch.checked = state.closeNoMatch;
        }
        
        if (state.status === 'IDLE') {
            btnStart.disabled = false;
            btnPause.disabled = true;
            btnResume.disabled = true;
            btnStop.disabled = true;
            statusText.innerText = state.totalTabs > 0 ? (state.matchFound ? "Match found!" : "Search completed") : "Ready to scan";
        } else if (state.status === 'SEARCHING') {
            btnStart.disabled = true;
            btnPause.disabled = false;
            btnResume.disabled = true;
            btnStop.disabled = false;
            statusText.innerText = "Scanning tabs...";
        } else if (state.status === 'PAUSED') {
            btnStart.disabled = true;
            btnPause.disabled = true;
            btnResume.disabled = false; // Only Resume and Stop are clickable
            btnStop.disabled = false;
            statusText.innerText = "Paused";
        }
    }

    // Ping background to get current state the moment the popup opens
    chrome.runtime.sendMessage({ action: 'GET_STATE' }, updateUI);

    // Listen for live progress updates while the popup is open
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.action === 'STATE_UPDATE') updateUI(msg.state);
        if (msg.action === 'TAB_UPDATE') statusText.innerText = msg.title;
    });

    btnStart.addEventListener('click', () => {
        const keyword = keywordInput.value.trim();
        if (!keyword) return alert("Please enter a keyword.");
        chrome.runtime.sendMessage({ 
            action: 'START', 
            keyword: keyword, 
            closeNoMatch: closeNoMatch.checked 
        });
    });

    btnPause.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'PAUSE' }));
    btnResume.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'RESUME' }));
    btnStop.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'STOP' }));
});
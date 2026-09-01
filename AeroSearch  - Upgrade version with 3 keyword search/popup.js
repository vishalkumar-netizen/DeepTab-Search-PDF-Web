document.addEventListener('DOMContentLoaded', () => {
    const btnStart = document.getElementById('btnStart');
    const btnPause = document.getElementById('btnPause');
    const btnResume = document.getElementById('btnResume');
    const btnStop = document.getElementById('btnStop');

    // Multi-keyword inputs
    const keyword1Input = document.getElementById('keyword1');
    const keyword2Input = document.getElementById('keyword2');
    const keyword3Input = document.getElementById('keyword3');

    const closeNoMatch = document.getElementById('closeNoMatch');
    const progressText = document.getElementById('progressText');
    const statusText = document.getElementById('statusText');

    // Update UI based on background state
    function updateUI(state) {
        if (!state) return;

        progressText.innerText = `${state.currentIndex || 0} / ${state.totalTabs || 0}`;
        
        // Restore active keywords into the input boxes when popup reopens
        if (state.keywords && Array.isArray(state.keywords)) {
            if (keyword1Input) keyword1Input.value = state.keywords[0] || '';
            if (keyword2Input) keyword2Input.value = state.keywords[1] || '';
            if (keyword3Input) keyword3Input.value = state.keywords[2] || '';
        } else if (state.keyword) {
            // Fallback for previous single keyword state
            if (keyword1Input) keyword1Input.value = state.keyword;
        }

        if (state.closeNoMatch !== undefined && closeNoMatch) {
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
        // Collect and clean keywords from all 3 inputs
        const k1 = keyword1Input ? keyword1Input.value.trim() : '';
        const k2 = keyword2Input ? keyword2Input.value.trim() : '';
        const k3 = keyword3Input ? keyword3Input.value.trim() : '';

        // Filter out empty input boxes dynamically
        const keywords = [k1, k2, k3].filter(k => k.length > 0);

        if (keywords.length === 0) {
            statusText.innerText = "Please enter at least one keyword.";
            statusText.style.color = "#ef4444";
            return;
        }

        // Reset status text color
        statusText.style.color = "#6b7280";

        chrome.runtime.sendMessage({ 
            action: 'START', 
            keywords: keywords, 
            closeNoMatch: closeNoMatch ? closeNoMatch.checked : false 
        });
    });

    btnPause.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'PAUSE' }));
    btnResume.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'RESUME' }));
    btnStop.addEventListener('click', () => chrome.runtime.sendMessage({ action: 'STOP' }));
});
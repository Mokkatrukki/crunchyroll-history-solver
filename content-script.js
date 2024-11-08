let isScanning = false;
let scrollTimeout;

// Function to collect history items
function collectCrunchyrollHistory() {
    if (!isScanning) return;
    
    console.log('Scanning...');
    let cards = document.querySelectorAll('.history-playable-card__body--lxFhG');
    console.log('Found cards:', cards.length);

    let historyData = [];

    cards.forEach((card, index) => {
        try {
            let seriesLink = card.querySelector('a.history-playable-card__show-link--fe0Xz');
            let episodeLink = card.querySelector('a.history-playable-card__title-link--vSAJy');
            let dateInfo = card.querySelector('.history-playable-card__footer-meta--mE2XC');

            if (!seriesLink || !episodeLink) {
                console.warn(`Skipping card ${index} - missing required elements`);
                return;
            }

            let episodeTitle = episodeLink.textContent;
            let episodeMatch = episodeTitle.match(/S(\d+)\s*E(\d+)\s*-\s*(.*)/);
            
            let historyItem = {
                series: {
                    title: seriesLink.textContent.trim(),
                    url: seriesLink.href
                },
                episode: {
                    fullTitle: episodeTitle,
                    season: episodeMatch ? parseInt(episodeMatch[1]) : null,
                    number: episodeMatch ? parseInt(episodeMatch[2]) : null,
                    name: episodeMatch ? episodeMatch[3].trim() : null,
                    url: episodeLink.href
                },
                metadata: {
                    date: dateInfo ? dateInfo.textContent.trim() : null,
                    index: index
                }
            };

            if (!episodeMatch) {
                let simpleEpisodeMatch = episodeTitle.match(/E(\d+)\s*-\s*(.*)/);
                if (simpleEpisodeMatch) {
                    historyItem.episode.season = 1;
                    historyItem.episode.number = parseInt(simpleEpisodeMatch[1]);
                    historyItem.episode.name = simpleEpisodeMatch[2].trim();
                }
            }

            historyData.push(historyItem);

        } catch (error) {
            console.error(`Error processing card ${index}:`, error);
        }
    });

    // Merge with existing data
    chrome.storage.local.get('crunchyrollHistory', (result) => {
        let existingData = result.crunchyrollHistory?.data || [];
        let existingUrls = new Set(existingData.map(item => item.episode.url));
        
        // Add only new items
        let newItems = historyData.filter(item => !existingUrls.has(item.episode.url));
        let mergedData = [...existingData, ...newItems];
        
        chrome.storage.local.set({
            crunchyrollHistory: {
                data: mergedData,
                lastUpdated: new Date().toISOString(),
                isScanning: isScanning
            }
        }, () => {
            console.log('History saved:', mergedData.length, 'total items', 
                      '(', newItems.length, 'new items )');
            chrome.runtime.sendMessage({
                action: "updateStatus",
                totalItems: mergedData.length,
                newItems: newItems.length,
                isScanning: isScanning
            });
        });
    });
}

// Listen for scroll events when scanning is active
function handleScroll() {
    if (!isScanning) return;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(collectCrunchyrollHistory, 500);
}

// Listen for messages from the side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startScanning") {
        isScanning = true;
        window.addEventListener('scroll', handleScroll);
        collectCrunchyrollHistory(); // Initial collection
        sendResponse({status: "Scanning started"});
    }
    else if (request.action === "stopScanning") {
        isScanning = false;
        window.removeEventListener('scroll', handleScroll);
        sendResponse({status: "Scanning stopped"});
    }
    return true;
});
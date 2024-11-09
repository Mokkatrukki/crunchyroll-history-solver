// ====================
// DATA COLLECTION
// ====================

/**
 * Collects history data from Crunchyroll history page
 * @param {Function} getWatchStatus - Function to determine watch status
 * @param {Object} collector - Reference to main collector object for state access
 * @returns {Promise<void>}
 */
export async function collectHistory(collector) {
    if (!collector.isScanning) return;
    
    try {
        console.log('Scanning...');
        let cards = document.querySelectorAll('.history-playable-card--qVdzv');
        console.log('Found cards:', cards.length);

        let historyData = processHistoryCards(cards, collector);
        await saveHistoryData(historyData, collector);

    } catch (error) {
        console.error('Error collecting history:', error);
        collector.stopScanning();
    }
}

/**
 * Process individual history cards from the page
 * @param {NodeList} cards - DOM elements representing history cards
 * @param {Object} collector - Reference to main collector object
 * @returns {Array} Processed history data
 */
function processHistoryCards(cards, collector) {
    let historyData = [];

    cards.forEach((card, index) => {
        try {
            const cardData = extractCardData(card, index, collector);
            if (cardData) {
                historyData.push(cardData);
            }
        } catch (error) {
            console.error(`Error processing card ${index}:`, error);
        }
    });

    return historyData;
}

/**
 * Extract data from a single history card
 * @param {Element} card - DOM element of the history card
 * @param {number} index - Index of the card
 * @param {Object} collector - Reference to main collector object
 * @returns {Object|null} Extracted card data or null if invalid
 */
function extractCardData(card, index, collector) {
    let seriesLink = card.querySelector('a.history-playable-card__show-link--fe0Xz');
    let episodeLink = card.querySelector('a.history-playable-card__title-link--vSAJy');
    let dateInfo = card.querySelector('.history-playable-card__footer-meta--mE2XC');

    if (!seriesLink || !episodeLink) {
        console.warn(`Skipping card ${index} - missing required elements`);
        return null;
    }

    let episodeTitle = episodeLink.textContent;
    let episodeMatch = episodeTitle.match(/S(\d+)\s*E(\d+)\s*-\s*(.*)/);
    let watchStatus = collector.getWatchStatus(card);
    
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
            url: episodeLink.href,
            watchStatus: watchStatus
        },
        metadata: {
            date: dateInfo ? dateInfo.textContent.trim() : null,
            index: index
        }
    };

    // Handle episodes without season number
    if (!episodeMatch) {
        let simpleEpisodeMatch = episodeTitle.match(/E(\d+)\s*-\s*(.*)/);
        if (simpleEpisodeMatch) {
            historyItem.episode.season = 1;
            historyItem.episode.number = parseInt(simpleEpisodeMatch[1]);
            historyItem.episode.name = simpleEpisodeMatch[2].trim();
        }
    }

    return historyItem;
}

/**
 * Save collected history data to chrome storage
 * @param {Array} historyData - Collected history data
 * @param {Object} collector - Reference to main collector object
 * @returns {Promise<void>}
 */
async function saveHistoryData(historyData, collector) {
    await chrome.storage.local.get('crunchyrollHistory', (result) => {
        let existingData = result.crunchyrollHistory?.data || [];
        let existingUrls = new Set(existingData.map(item => item.episode.url));
        
        let newItems = historyData.filter(item => !existingUrls.has(item.episode.url));
        let mergedData = [...existingData, ...newItems];
        
        // Update the session counter
        collector.totalNewItemsInSession += newItems.length;

        chrome.storage.local.set({
            crunchyrollHistory: {
                data: mergedData,
                lastUpdated: new Date().toISOString(),
                isScanning: collector.isScanning
            }
        }, () => {
            console.log('History saved:', mergedData.length, 'total items', 
                      '(', collector.totalNewItemsInSession, 'new items in this session)');
            chrome.runtime.sendMessage({
                action: "updateStatus",
                totalItems: mergedData.length,
                newItems: collector.totalNewItemsInSession,
                isScanning: collector.isScanning
            });
        });
    });
}
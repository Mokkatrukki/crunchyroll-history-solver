// ====================
// INITIALIZATION
// ====================
(function() {
    // Clean up existing instance if it exists
    if (window.crunchyrollHistoryCollector) {
        try {
            window.crunchyrollHistoryCollector.cleanup();
        } catch (e) {
            console.log('Cleanup of old instance failed:', e);
        }
    }

    window.crunchyrollHistoryCollector = {
        isScanning: false,
        scrollTimeout: null,
        totalNewItemsInSession: 0,

// ====================
// EVENT MANAGEMENT
// ====================
        cleanup: function() {
            this.stopScanning();
            this.removeEventListeners();
        },

        removeEventListeners: function() {
            window.removeEventListener('scroll', this.handleScroll);
        },

        handleScroll: function() {
            if (!this.isScanning) return;
            clearTimeout(this.scrollTimeout);
            this.scrollTimeout = setTimeout(() => this.collectHistory(), 500);
        },

// ====================
// STATUS DETECTION
// ====================
        getWatchStatus: function(card) {
            try {
                const statusElement = card.querySelector('.history-playable-card__thumbnail-wrapper--xOHuX .playable-thumbnail__duration--p-Ldq');
                if (!statusElement) return 'unknown';

                const statusText = statusElement.textContent.trim();
                
                if (statusText === 'Watched') {
                    return 'watched';
                }
                
                const minutesMatch = statusText.match(/(\d+)m left/);
                if (minutesMatch) {
                    const minutesLeft = parseInt(minutesMatch[1]);
                    if (minutesLeft <= 5) {
                        return 'watched';
                    } else if (minutesLeft <= 20) {
                        return 'partial';
                    } else {
                        return 'unwatched';
                    }
                }

                return 'unknown';
            } catch (error) {
                console.error('Error getting watch status:', error);
                return 'unknown';
            }
        },

// ====================
// DATA COLLECTION
// ====================
        collectHistory: async function() {
            if (!this.isScanning) return;
            
            try {
                console.log('Scanning...');
                let cards = document.querySelectorAll('.history-playable-card--qVdzv');
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
                        let watchStatus = this.getWatchStatus(card);
                        
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

// ====================
// STORAGE MANAGEMENT
// ====================
                await chrome.storage.local.get('crunchyrollHistory', (result) => {
                    let existingData = result.crunchyrollHistory?.data || [];
                    let existingUrls = new Set(existingData.map(item => item.episode.url));
                    
                    let newItems = historyData.filter(item => !existingUrls.has(item.episode.url));
                    let mergedData = [...existingData, ...newItems];
                    
                    // Update the session counter
                    this.totalNewItemsInSession += newItems.length;

                    chrome.storage.local.set({
                        crunchyrollHistory: {
                            data: mergedData,
                            lastUpdated: new Date().toISOString(),
                            isScanning: this.isScanning
                        }
                    }, () => {
                        console.log('History saved:', mergedData.length, 'total items', 
                                  '(', this.totalNewItemsInSession, 'new items in this session)');
                        chrome.runtime.sendMessage({
                            action: "updateStatus",
                            totalItems: mergedData.length,
                            newItems: this.totalNewItemsInSession,
                            isScanning: this.isScanning
                        });
                    });
                });
            } catch (error) {
                console.error('Error collecting history:', error);
                this.stopScanning();
            }
        },

// ====================
// SCANNING CONTROLS
// ====================
        startScanning: function() {
            this.isScanning = true;
            this.totalNewItemsInSession = 0;  // Reset counter when starting new scan
            window.addEventListener('scroll', this.handleScroll.bind(this));
            this.collectHistory();
            console.log('Scanning started');
        },

        stopScanning: function() {
            this.isScanning = false;
            this.totalNewItemsInSession = 0;  // Reset counter when stopping
            window.removeEventListener('scroll', this.handleScroll.bind(this));
            console.log('Scanning stopped');
        },

// ====================
// MESSAGE HANDLING
// ====================
        initialize: function() {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                console.log('Message received:', request.action);
                if (request.action === "startScanning") {
                    this.startScanning();
                    sendResponse({status: "Scanning started"});
                }
                else if (request.action === "stopScanning") {
                    this.stopScanning();
                    sendResponse({status: "Scanning stopped"});
                }
                return true;
            });

            console.log('Crunchyroll History Collector initialized');
        }
    };

    // Initialize the collector
    window.crunchyrollHistoryCollector.initialize();
})();
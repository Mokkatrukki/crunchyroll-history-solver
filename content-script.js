// Get the URL for the module
const moduleURL = chrome.runtime.getURL('historyCollector.js');

// Load the module dynamically
(async function() {
    try {
        const { collectHistory } = await import(moduleURL);
        
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
            collectHistory,

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
                this.scrollTimeout = setTimeout(() => this.collectHistory(this), 500);
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
// SCANNING CONTROLS
// ====================
            startScanning: function() {
                this.isScanning = true;
                this.totalNewItemsInSession = 0;  // Reset counter when starting new scan
                window.addEventListener('scroll', this.handleScroll.bind(this));
                this.collectHistory(this);
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
        
    } catch (error) {
        console.error('Error loading history collector module:', error);
    }
})();
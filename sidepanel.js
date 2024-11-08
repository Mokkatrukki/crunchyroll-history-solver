class CrunchyrollHistoryViewer {
    constructor() {
        this.contentElement = document.getElementById('history-content');
        this.lastUpdatedElement = document.getElementById('last-updated');
        this.statusElement = document.getElementById('statusText');
        this.initializeEventListeners();
        this.loadHistory();
    }
    getEpisodeColor(watchStatus) {
        switch (watchStatus) {
            case 'watched':
                return '#4CAF50'; // Green
            case 'partial':
                return '#FFC107'; // Yellow
            case 'unwatched':
                return '#424242'; // Gray
            default:
                return '#424242'; // Default gray
        }
    }

    initializeEventListeners() {
        document.getElementById('startScan').addEventListener('click', () => {
            this.startScanning();
        });

        document.getElementById('stopScan').addEventListener('click', () => {
            this.stopScanning();
        });

        // Listen for status updates
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "updateStatus") {
                this.updateStatus(request);
                this.loadHistory();
            }
        });

        document.getElementById('resetHistory').addEventListener('click', async () => {
            if (confirm('Are you sure you want to reset your collected history? This cannot be undone.')) {
                await chrome.storage.local.remove('crunchyrollHistory');
                this.contentElement.innerHTML = '<p style="text-align: center; color: #888;">No history data available.</p>';
                this.lastUpdatedElement.textContent = 'Last updated: Never';
                this.statusElement.textContent = 'History reset complete';
            }
        });
    }

    async startScanning() {
        try {
            // First, find or create history tab
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: "findHistoryTab" }, resolve);
            });

            if (response.found) {
                // Try to start scanning
                await chrome.tabs.sendMessage(response.tabId, { action: "startScanning" });
                document.body.classList.add('scanning');
                this.statusElement.textContent = 'Scanning in progress...';
            } else {
                // Open new history tab
                this.statusElement.textContent = 'Opening Crunchyroll history page...';
                await chrome.tabs.create({ 
                    url: "https://www.crunchyroll.com/history",
                    active: true
                });
                this.statusElement.textContent = 'Please try scanning again once the page loads';
            }
        } catch (error) {
            console.error('Error starting scan:', error);
            this.statusElement.textContent = 'Error: Please refresh the history page and try again';
        }
    }

    async stopScanning() {
        try {
            const response = await new Promise(resolve => {
                chrome.runtime.sendMessage({ action: "findHistoryTab" }, resolve);
            });

            if (response.found) {
                await chrome.tabs.sendMessage(response.tabId, { action: "stopScanning" });
                document.body.classList.remove('scanning');
                this.statusElement.textContent = 'Scanning stopped';
            }
        } catch (error) {
            console.error('Error stopping scan:', error);
            this.statusElement.textContent = 'Error stopping scan';
            document.body.classList.remove('scanning');
        }
    }


    updateStatus(status) {
        if (status.isScanning) {
            this.statusElement.textContent = `Scanning... Found ${status.totalItems} episodes total (${status.newItems} new)`;
        } else {
            this.statusElement.textContent = `Scan complete. Total: ${status.totalItems} episodes`;
        }
    }

    async loadHistory() {
        const stored = await chrome.storage.local.get('crunchyrollHistory');
        if (stored.crunchyrollHistory) {
            this.renderHistory(stored.crunchyrollHistory);
        } else {
            this.contentElement.innerHTML = '<p style="text-align: center; color: #888;">No history data available. Visit Crunchyroll history page to collect data.</p>';
        }
    }

    renderHistory(historyData) {
        this.contentElement.innerHTML = '';
        const seriesMap = this.groupBySeries(historyData.data);
        
        Object.entries(seriesMap).forEach(([title, data]) => {
            const seriesElement = this.createSeriesElement(title, data);
            this.contentElement.appendChild(seriesElement);
        });

        if (historyData.lastUpdated) {
            this.lastUpdatedElement.textContent = `Last updated: ${new Date(historyData.lastUpdated).toLocaleString()}`;
        }
    }

    groupBySeries(historyData) {
        const seriesMap = {};
        
        historyData.forEach(item => {
            if (!seriesMap[item.series.title]) {
                seriesMap[item.series.title] = {
                    url: item.series.url,
                    episodes: [],
                    seasons: new Set()
                };
            }
            seriesMap[item.series.title].episodes.push(item.episode);
            seriesMap[item.series.title].seasons.add(item.episode.season);
        });

        // Sort episodes and convert seasons to array
        Object.values(seriesMap).forEach(series => {
            series.episodes.sort((a, b) => {
                if (a.season !== b.season) return a.season - b.season;
                return a.number - b.number;
            });
            series.seasons = Array.from(series.seasons).sort();
        });

        return seriesMap;
    }

    createSeriesElement(title, data) {
        const container = document.createElement('div');
        container.className = 'series-container';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'series-title';
        titleElement.innerHTML = `<a href="${data.url}" target="_blank" style="color: inherit; text-decoration: none;">${title}</a>`;
        container.appendChild(titleElement);

        data.seasons.forEach(season => {
            const seasonEpisodes = data.episodes.filter(ep => ep.season === season);
            if (seasonEpisodes.length > 0) {
                const seasonLabel = document.createElement('div');
                seasonLabel.className = 'season-label';
                seasonLabel.textContent = `Season ${season}`;
                container.appendChild(seasonLabel);

                const grid = document.createElement('div');
                grid.className = 'episodes-grid';

                // Find max episode number for this season
                const maxEpisode = Math.max(...seasonEpisodes.map(ep => ep.number));
                
                // Create all episode slots up to max
                for (let i = 1; i <= maxEpisode; i++) {
                    const epElement = document.createElement('div');
                    epElement.className = 'episode';
                    
                    const watched = seasonEpisodes.find(ep => ep.number === i);
                    if (watched) {
                        const backgroundColor = this.getEpisodeColor(watched.watchStatus);
                        epElement.style.backgroundColor = backgroundColor;
                        
                        // Add watch status to tooltip
                        let tooltipText = `${watched.name}\n`;
                        tooltipText += watched.watchStatus === 'partial' ? '(Partially watched)' : 
                                     watched.watchStatus === 'watched' ? '(Watched)' : 
                                     '(Not watched)';
                        
                        epElement.title = tooltipText;
                        epElement.addEventListener('click', () => {
                            window.open(watched.url, '_blank');
                        });
                    } else {
                        epElement.style.backgroundColor = '#424242';
                    }
                    
                    epElement.textContent = i;
                    grid.appendChild(epElement);
                }

                container.appendChild(grid);
            }
        });

        return container;
    }
}

// Initialize the viewer when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CrunchyrollHistoryViewer();
});
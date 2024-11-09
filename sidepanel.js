import { renderHistory } from './uiRenderer.js';

class CrunchyrollHistoryViewer {
    constructor() {
        this.contentElement = document.getElementById('history-content');
        this.lastUpdatedElement = document.getElementById('last-updated');
        this.statusElement = document.getElementById('statusText');
        this.initializeEventListeners();
        this.loadHistory();
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
            renderHistory(this.contentElement, this.lastUpdatedElement, stored.crunchyrollHistory);
        } else {
            this.contentElement.innerHTML = '<p style="text-align: center; color: #888;">No history data available. Visit Crunchyroll history page to collect data.</p>';
        }
    }
}

// Initialize the viewer when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CrunchyrollHistoryViewer();
});
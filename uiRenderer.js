// ====================
// HTML TEMPLATES
// ====================
const templates = {
    emptyHistory: `
        <p style="text-align: center; color: #888;">
            No history data available. Visit Crunchyroll history page to collect data.
        </p>
    `,

    seriesContainer: (title, url) => `
        <div class="series-container">
            <div class="series-title">
                <a href="${url}" target="_blank" style="color: inherit; text-decoration: none;">${title}</a>
            </div>
        </div>
    `,

    seasonLabel: (seasonNumber) => `
        <div class="season-label">Season ${seasonNumber}</div>
    `,

    episodesGrid: `<div class="episodes-grid"></div>`,

    episode: (number, watchStatus, name, url, backgroundColor) => {
        const tooltipText = watchStatus === 'partial' ? '(Partially watched)' : 
                          watchStatus === 'watched' ? '(Watched)' : 
                          '(Not watched)';
        return `
            <div class="episode" 
                 style="background-color: ${backgroundColor};"
                 title="${name}\n${tooltipText}"
                 data-url="${url}">
                ${number}
            </div>
        `;
    }
};

// ====================
// STYLING & THEMING
// ====================
export function getEpisodeColor(watchStatus) {
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

// ====================
// UI RENDERING
// ====================
export function renderHistory(contentElement, lastUpdatedElement, historyData) {
    if (!historyData || !historyData.data || historyData.data.length === 0) {
        contentElement.innerHTML = templates.emptyHistory;
        return;
    }

    contentElement.innerHTML = '';
    const seriesMap = groupBySeries(historyData.data);
    
    Object.entries(seriesMap).forEach(([title, data]) => {
        const seriesHtml = templates.seriesContainer(title, data.url);
        const seriesElement = createElementFromHTML(seriesHtml);
        
        // Add seasons to the series container
        data.seasons.forEach(season => {
            const seasonEpisodes = data.episodes.filter(ep => ep.season === season);
            if (seasonEpisodes.length > 0) {
                appendSeasonContent(seriesElement, season, seasonEpisodes);
            }
        });

        contentElement.appendChild(seriesElement);
    });

    if (historyData.lastUpdated) {
        lastUpdatedElement.textContent = `Last updated: ${new Date(historyData.lastUpdated).toLocaleString()}`;
    }

    // Add click event listeners to all episodes
    addEpisodeClickListeners(contentElement);
}

// ====================
// HELPER FUNCTIONS
// ====================
function createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}

function groupBySeries(historyData) {
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

function appendSeasonContent(seriesElement, season, seasonEpisodes) {
    // Add season label
    const seasonLabelHtml = templates.seasonLabel(season);
    seriesElement.insertAdjacentHTML('beforeend', seasonLabelHtml);

    // Add episodes grid
    const gridElement = createElementFromHTML(templates.episodesGrid);
    
    // Find max episode number for this season
    const maxEpisode = Math.max(...seasonEpisodes.map(ep => ep.number));
    
    // Create all episode slots up to max
    for (let i = 1; i <= maxEpisode; i++) {
        const watched = seasonEpisodes.find(ep => ep.number === i);
        let episodeHtml;
        
        if (watched) {
            const backgroundColor = getEpisodeColor(watched.watchStatus);
            episodeHtml = templates.episode(
                i,
                watched.watchStatus,
                watched.name,
                watched.url,
                backgroundColor
            );
        } else {
            episodeHtml = templates.episode(
                i,
                'unwatched',
                'Episode not found',
                '#',
                '#424242'
            );
        }
        
        gridElement.insertAdjacentHTML('beforeend', episodeHtml);
    }

    seriesElement.appendChild(gridElement);
}

function addEpisodeClickListeners(contentElement) {
    contentElement.querySelectorAll('.episode[data-url]').forEach(episode => {
        episode.addEventListener('click', () => {
            const url = episode.getAttribute('data-url');
            if (url && url !== '#') {
                window.open(url, '_blank');
            }
        });
    });
}
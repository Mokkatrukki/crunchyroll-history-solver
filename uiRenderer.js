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
    contentElement.innerHTML = '';
    const seriesMap = groupBySeries(historyData.data);
    
    Object.entries(seriesMap).forEach(([title, data]) => {
        const seriesElement = createSeriesElement(title, data);
        contentElement.appendChild(seriesElement);
    });

    if (historyData.lastUpdated) {
        lastUpdatedElement.textContent = `Last updated: ${new Date(historyData.lastUpdated).toLocaleString()}`;
    }
}

// ====================
// DATA GROUPING
// ====================
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

// ====================
// ELEMENT CREATION
// ====================
function createSeriesElement(title, data) {
    const container = document.createElement('div');
    container.className = 'series-container';
    
    const titleElement = document.createElement('div');
    titleElement.className = 'series-title';
    titleElement.innerHTML = `<a href="${data.url}" target="_blank" style="color: inherit; text-decoration: none;">${title}</a>`;
    container.appendChild(titleElement);

    data.seasons.forEach(season => {
        const seasonEpisodes = data.episodes.filter(ep => ep.season === season);
        if (seasonEpisodes.length > 0) {
            appendSeasonContent(container, season, seasonEpisodes);
        }
    });

    return container;
}

function appendSeasonContent(container, season, seasonEpisodes) {
    const seasonLabel = document.createElement('div');
    seasonLabel.className = 'season-label';
    seasonLabel.textContent = `Season ${season}`;
    container.appendChild(seasonLabel);

    const grid = createEpisodesGrid(seasonEpisodes);
    container.appendChild(grid);
}

function createEpisodesGrid(seasonEpisodes) {
    const grid = document.createElement('div');
    grid.className = 'episodes-grid';

    // Find max episode number for this season
    const maxEpisode = Math.max(...seasonEpisodes.map(ep => ep.number));
    
    // Create all episode slots up to max
    for (let i = 1; i <= maxEpisode; i++) {
        const epElement = createEpisodeElement(i, seasonEpisodes);
        grid.appendChild(epElement);
    }

    return grid;
}

function createEpisodeElement(episodeNumber, seasonEpisodes) {
    const epElement = document.createElement('div');
    epElement.className = 'episode';
    
    const watched = seasonEpisodes.find(ep => ep.number === episodeNumber);
    if (watched) {
        const backgroundColor = getEpisodeColor(watched.watchStatus);
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
    
    epElement.textContent = episodeNumber;
    return epElement;
}
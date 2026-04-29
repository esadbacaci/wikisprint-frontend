const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000') + '/api';

export const getPageContent = async (title) => {
    try {
        const response = await fetch(`${BACKEND_URL}/page/${encodeURIComponent(title)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch page content');
        }
        return await response.json();
    } catch (error) {
        console.error("Error in getPageContent:", error);
        throw error;
    }
};

export const getRandomArticle = async () => {
    try {
        // rnnamespace=0 means we only get main articles (no categories, talk pages etc.)
        const url = `https://tr.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.query && data.query.random && data.query.random.length > 0) {
            return data.query.random[0].title;
        }
        throw new Error('No random article found');
    } catch (error) {
        console.error("Error in getRandomArticle:", error);
        throw error;
    }
};

export const searchWikipediaArticles = async (query) => {
    try {
        if (!query || query.trim().length < 2) return [];
        const url = `https://tr.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
        const response = await fetch(url);
        const data = await response.json();
        // data format is: [search_term, [titles], [descriptions], [links]]
        return data[1] || [];
    } catch (error) {
        console.error("Error in searchWikipediaArticles:", error);
        return [];
    }
};

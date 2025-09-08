// Configuration for API endpoints
// Update BACKEND_URL to your Railway deployment URL
const API_CONFIG = {
    // For local development, use empty string (relative URLs)
    // For production, use your Railway URL like: 'https://your-app.railway.app'
    BACKEND_URL: '', // Update this to your Railway URL in production
    
    // API endpoints
    endpoints: {
        limitless: '/api/limitless/',
        twitter: '/api/twitter/search'
    }
};

// Export for use in index.html
if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
}
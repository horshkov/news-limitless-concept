require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Twitter Bearer Token - use the provided one directly
let twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

// Enable CORS for our proxy
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Proxy endpoint for Limitless API
app.get('/api/limitless/*', async (req, res) => {
    try {
        // Extract the path after /api/limitless/
        const apiPath = req.path.replace('/api/limitless/', '');
        const queryString = req.originalUrl.split('?')[1] || '';
        const limitlessUrl = `https://api.limitless.exchange/${apiPath}${queryString ? '?' + queryString : ''}`;
        
        console.log('Proxying request to:', limitlessUrl);
        
        const response = await fetch(limitlessUrl);
        const data = await response.json();
        
        res.json(data);
    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ error: 'Proxy request failed', details: error.message });
    }
});

// Get Twitter Bearer Token (use the provided one or try to generate)
async function getTwitterBearerToken() {
    // First, try using the provided bearer token
    if (twitterBearerToken) {
        console.log('Using provided Twitter Bearer token');
        return twitterBearerToken;
    }
    
    // If no bearer token provided, try to generate one
    try {
        const credentials = Buffer.from(
            `${process.env.TWITTER_API_KEY}:${process.env.TWITTER_API_SECRET}`
        ).toString('base64');
        
        const response = await fetch('https://api.twitter.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: 'grant_type=client_credentials'
        });
        
        const data = await response.json();
        if (data.access_token) {
            twitterBearerToken = data.access_token;
            console.log('Twitter Bearer token obtained successfully');
            return twitterBearerToken;
        } else {
            console.error('Failed to get Twitter bearer token:', data);
            return process.env.TWITTER_BEARER_TOKEN; // Fall back to env variable
        }
    } catch (error) {
        console.error('Error getting Twitter bearer token:', error);
        return process.env.TWITTER_BEARER_TOKEN; // Fall back to env variable
    }
}

// Twitter API proxy endpoint
app.get('/api/twitter/search', async (req, res) => {
    try {
        const token = await getTwitterBearerToken();
        if (!token) {
            return res.status(500).json({ error: 'Failed to authenticate with Twitter' });
        }
        
        // Search for BTC and Bitcoin tweets
        const query = encodeURIComponent('(BTC OR Bitcoin) -is:retweet lang:en');
        const maxResults = req.query.limit || 20;
        
        const twitterUrl = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${maxResults}&tweet.fields=created_at,author_id,public_metrics&expansions=author_id&user.fields=name,username,profile_image_url,verified`;
        
        console.log('Fetching Twitter data...');
        
        const response = await fetch(twitterUrl, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Twitter API error:', response.status, errorText);
            
            // Check specific error types
            if (response.status === 429) {
                console.log('Rate limit exceeded - returning mock tweets');
            } else if (response.status === 403) {
                console.log('Authentication issue - check if app is attached to a project');
            }
            
            // Return mock tweets if API fails
            return res.json({
                data: getMockTweets(),
                includes: { users: [] }
            });
        }
        
        const data = await response.json();
        res.json(data);
        
    } catch (error) {
        console.error('Twitter proxy error:', error);
        // Return mock tweets as fallback
        res.json({
            data: getMockTweets(),
            includes: { users: [] }
        });
    }
});

// Mock tweets for testing/fallback
function getMockTweets() {
    return [
        {
            id: 'mock_1',
            text: 'Bitcoin is showing strong momentum today! $BTC breaking through resistance levels 🚀',
            created_at: new Date().toISOString(),
            author_id: 'mock_user_1',
            public_metrics: {
                retweet_count: 45,
                reply_count: 12,
                like_count: 234,
                quote_count: 5
            }
        },
        {
            id: 'mock_2',
            text: 'Institutional adoption of #Bitcoin continues to grow. Major banks now offering BTC custody services.',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            author_id: 'mock_user_2',
            public_metrics: {
                retweet_count: 89,
                reply_count: 23,
                like_count: 456,
                quote_count: 12
            }
        },
        {
            id: 'mock_3',
            text: 'BTC price analysis: Key support at $107k holding strong. Next target $110k if we break above current resistance.',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            author_id: 'mock_user_3',
            public_metrics: {
                retweet_count: 67,
                reply_count: 34,
                like_count: 789,
                quote_count: 8
            }
        }
    ];
}

// Serve static files
app.use(express.static(__dirname));

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser`);
    
    // Initialize Twitter token on startup
    getTwitterBearerToken();
});
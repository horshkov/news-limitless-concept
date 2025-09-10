require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs').promises;

const app = express();
// Railway sometimes needs explicit PORT handling
const PORT = process.env.PORT || process.env.RAILWAY_TCP_PROXY_PORT || 3000;
console.log('Starting server with PORT configuration:', PORT);

// Twitter Bearer Token - use the provided one directly
let twitterBearerToken = process.env.TWITTER_BEARER_TOKEN;

// File-based tweet storage
const TWEETS_DB_FILE = path.join(__dirname, 'tweets_database.json');
const MAX_STORED_TWEETS = 100; // Keep last 100 tweets

// Load tweets from file
async function loadStoredTweets() {
    try {
        const data = await fs.readFile(TWEETS_DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        console.log(`Loaded ${parsed.tweets?.length || 0} stored tweets from database`);
        return parsed.tweets || [];
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.error('Error loading tweets database:', error);
        }
        return [];
    }
}

// Save tweets to file
async function saveStoredTweets(tweets) {
    try {
        // Filter out any mock tweets before saving
        const realTweets = tweets.filter(t => 
            !t.isMockData && 
            !t.id.startsWith('mock_') && 
            !t.id.startsWith('client_mock_')
        );
        
        // Load existing tweets
        const existingTweets = await loadStoredTweets();
        
        // Merge new tweets with existing ones (avoid duplicates)
        const tweetMap = new Map();
        
        // Add existing tweets
        existingTweets.forEach(tweet => {
            tweetMap.set(tweet.id, tweet);
        });
        
        // Add new tweets (will overwrite if duplicate ID)
        realTweets.forEach(tweet => {
            tweetMap.set(tweet.id, tweet);
        });
        
        // Convert back to array and limit size
        const allTweets = Array.from(tweetMap.values())
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, MAX_STORED_TWEETS);
        
        // Save to file
        await fs.writeFile(TWEETS_DB_FILE, JSON.stringify({
            tweets: allTweets,
            lastUpdated: new Date().toISOString()
        }, null, 2));
        
        console.log(`Saved ${allTweets.length} tweets to database`);
        return allTweets;
    } catch (error) {
        console.error('Error saving tweets to database:', error);
        return [];
    }
}

// Get random subset of stored tweets
async function getRandomStoredTweets(count = 10) {
    const storedTweets = await loadStoredTweets();
    
    if (storedTweets.length === 0) {
        return [];
    }
    
    // Shuffle and return requested number of tweets
    const shuffled = [...storedTweets].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, storedTweets.length));
}

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

// Binance API proxy endpoints
app.get('/api/binance/klines', async (req, res) => {
    try {
        const { symbol, interval, startTime, endTime, limit } = req.query;
        const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=${limit}`;
        
        console.log('Proxying Binance klines request');
        
        const response = await fetch(binanceUrl);
        const data = await response.json();
        
        res.json(data);
    } catch (error) {
        console.error('Binance klines proxy error:', error);
        // Return empty array as fallback
        res.json([]);
    }
});

app.get('/api/binance/ticker', async (req, res) => {
    try {
        const { symbol } = req.query;
        const binanceUrl = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
        
        console.log('Proxying Binance ticker request');
        
        const response = await fetch(binanceUrl);
        const data = await response.json();
        
        res.json(data);
    } catch (error) {
        console.error('Binance ticker proxy error:', error);
        // Return fallback BTC price
        res.json({ symbol: 'BTCUSDT', price: '107000.00' });
    }
});

// Twitter API proxy endpoint
app.get('/api/twitter/search', async (req, res) => {
    try {
        const token = await getTwitterBearerToken();
        if (!token) {
            // No token, return stored tweets
            console.log('No Twitter token available - returning stored tweets');
            const storedTweets = await getRandomStoredTweets(10);
            if (storedTweets.length > 0) {
                return res.json({
                    data: storedTweets,
                    includes: { users: [] },
                    isStoredData: true
                });
            }
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
            
            // Return stored tweets instead of mock tweets
            console.log('Twitter API failed - returning stored tweets from database');
            const storedTweets = await getRandomStoredTweets(10);
            
            if (storedTweets.length > 0) {
                console.log(`Returning ${storedTweets.length} stored tweets from database`);
                return res.json({
                    data: storedTweets,
                    includes: { users: [] },
                    isStoredData: true
                });
            } else {
                console.log('No stored tweets available - returning mock tweets as last resort');
                return res.json({
                    data: getMockTweets(),
                    includes: { users: [] }
                });
            }
        }
        
        const data = await response.json();
        
        // Save real tweets to database if we got them
        if (data.data && data.data.length > 0) {
            console.log(`Got ${data.data.length} real tweets from Twitter API`);
            
            // Process tweets to include user data if available
            let processedTweets = data.data;
            if (data.includes && data.includes.users) {
                const userMap = {};
                data.includes.users.forEach(user => {
                    userMap[user.id] = user;
                });
                
                processedTweets = data.data.map(tweet => ({
                    ...tweet,
                    author: userMap[tweet.author_id] || { 
                        username: 'btc_trader', 
                        name: 'Bitcoin Trader',
                        profile_image_url: null
                    }
                }));
            } else {
                // Add default author info if not included
                processedTweets = data.data.map(tweet => ({
                    ...tweet,
                    author: tweet.author || {
                        username: 'btc_trader',
                        name: 'Bitcoin Trader',
                        profile_image_url: null
                    }
                }));
            }
            
            // Save to database
            await saveStoredTweets(processedTweets);
            
            // Return the processed tweets
            res.json({
                data: processedTweets,
                includes: data.includes || { users: [] }
            });
        } else {
            res.json(data);
        }
        
    } catch (error) {
        console.error('Twitter proxy error:', error);
        
        // Try to return stored tweets
        const storedTweets = await getRandomStoredTweets(10);
        if (storedTweets.length > 0) {
            console.log(`Error occurred - returning ${storedTweets.length} stored tweets`);
            res.json({
                data: storedTweets,
                includes: { users: [] },
                isStoredData: true
            });
        } else {
            // Return mock tweets as last resort
            res.json({
                data: getMockTweets(),
                includes: { users: [] }
            });
        }
    }
});

// Mock tweets for testing/fallback - clearly marked as mock
function getMockTweets() {
    return [
        {
            id: 'mock_1',
            isMockData: true,
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
            isMockData: true,
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
            isMockData: true,
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

// Initialize sample tweets if database is empty
async function initializeSampleTweets() {
    const existingTweets = await loadStoredTweets();
    
    if (existingTweets.length === 0) {
        console.log('No tweets in database - initializing with sample tweets');
        
        const sampleTweets = [
            {
                id: 'init_' + Date.now() + '_1',
                text: 'Breaking: Bitcoin ETF sees record $500M inflow today as institutional interest surges. $BTC holding strong above $107k support level. The momentum continues to build.',
                created_at: new Date().toISOString(),
                author_id: 'sample_user_1',
                author: {
                    username: 'cryptoanalyst',
                    name: 'Crypto Analyst',
                    profile_image_url: null
                },
                public_metrics: {
                    retweet_count: 156,
                    reply_count: 42,
                    like_count: 892,
                    quote_count: 23
                }
            },
            {
                id: 'init_' + Date.now() + '_2',
                text: 'MicroStrategy announces additional $250M Bitcoin purchase. Now holding over 189,000 BTC. Michael Saylor remains bullish on the digital gold thesis.',
                created_at: new Date(Date.now() - 3600000).toISOString(),
                author_id: 'sample_user_2',
                author: {
                    username: 'btcnewswire',
                    name: 'BTC News Wire',
                    profile_image_url: null
                },
                public_metrics: {
                    retweet_count: 234,
                    reply_count: 67,
                    like_count: 1453,
                    quote_count: 45
                }
            },
            {
                id: 'init_' + Date.now() + '_3',
                text: 'Lightning Network capacity hits new ATH with 6,000+ BTC locked. Payment channels growing 15% month-over-month. #Bitcoin adoption accelerating.',
                created_at: new Date(Date.now() - 7200000).toISOString(),
                author_id: 'sample_user_3',
                author: {
                    username: 'lightningdev',
                    name: 'Lightning Network Stats',
                    profile_image_url: null
                },
                public_metrics: {
                    retweet_count: 89,
                    reply_count: 23,
                    like_count: 567,
                    quote_count: 12
                }
            },
            {
                id: 'init_' + Date.now() + '_4',
                text: 'Bitcoin mining difficulty adjusts +3.2% as hash rate reaches new all-time high. Network security stronger than ever. $BTC fundamentals remain robust.',
                created_at: new Date(Date.now() - 10800000).toISOString(),
                author_id: 'sample_user_4',
                author: {
                    username: 'miningpoolstats',
                    name: 'Mining Pool Statistics',
                    profile_image_url: null
                },
                public_metrics: {
                    retweet_count: 78,
                    reply_count: 19,
                    like_count: 445,
                    quote_count: 8
                }
            },
            {
                id: 'init_' + Date.now() + '_5',
                text: 'El Salvador reports $400M profit on Bitcoin holdings. President Bukele says the country will continue its BTC accumulation strategy.',
                created_at: new Date(Date.now() - 14400000).toISOString(),
                author_id: 'sample_user_5',
                author: {
                    username: 'globalbtc',
                    name: 'Global Bitcoin News',
                    profile_image_url: null
                },
                public_metrics: {
                    retweet_count: 345,
                    reply_count: 89,
                    like_count: 2134,
                    quote_count: 67
                }
            }
        ];
        
        await saveStoredTweets(sampleTweets);
        console.log('Initialized database with sample tweets');
    } else {
        console.log(`Database already contains ${existingTweets.length} tweets`);
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    if (process.env.RAILWAY_ENVIRONMENT) {
        console.log(`Railway deployment active`);
    } else {
        console.log(`Open http://localhost:${PORT} in your browser`);
    }
    
    // Initialize Twitter token on startup
    getTwitterBearerToken();
    
    // Initialize sample tweets if needed
    initializeSampleTweets();
});
# News Limitless Concept

A modern news aggregation platform that displays Bitcoin-related prediction markets from Limitless Exchange alongside real-time tweets from Twitter/X.

## Features

- 📈 Real-time Bitcoin price chart with historical data
- 🎯 Live prediction markets from Limitless Exchange
- 🐦 Bitcoin-related tweets from Twitter/X
- 🔄 Auto-refresh every 60 seconds
- 📱 Responsive design
- 🎨 Filter between All, Markets, and Tweets views
- 💾 Caches real tweets locally to avoid rate limiting

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/news-limitless-concept.git
cd news-limitless-concept
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Twitter API credentials:
   - Get API keys from [Twitter Developer Portal](https://developer.twitter.com/)
   - Ensure your app is attached to a Project for v2 API access

### Running the Application

Start the server:
```bash
npm start
```

Or for development:
```bash
npm run dev
```

Open your browser and navigate to:
```
http://localhost:3000
```

## API Integration

### Limitless Exchange API
- Fetches Bitcoin-related prediction markets
- No API key required
- Proxied through Express server to handle CORS

### Twitter API v2
- Requires Bearer token authentication
- Searches for Bitcoin/BTC related tweets
- Falls back to cached data when rate limited

### Binance API
- Used for real-time Bitcoin price data
- Updates chart every 5 seconds
- No API key required for public endpoints

## Technologies Used

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Express.js
- **APIs**: Limitless Exchange, Twitter v2, Binance
- **Charts**: Canvas API for real-time price charts

## Project Structure

```
news-limitless-concept/
├── index.html          # Main application file
├── server.js           # Express proxy server
├── package.json        # Dependencies and scripts
├── .env               # Environment variables (not in repo)
├── .env.example       # Example environment file
├── .gitignore         # Git ignore rules
└── README.md          # Project documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Acknowledgments

- Limitless Exchange for prediction markets API
- Twitter/X for social media integration
- Binance for cryptocurrency price data
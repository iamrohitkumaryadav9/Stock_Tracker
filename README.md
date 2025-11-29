# Quantis - Real-Time Stock Tracker Application

Overview
Quantis is a comprehensive stock tracking application built with Next.js 16.0.5, React 19, and TypeScript. It provides real-time stock price monitoring, personalized alerts, AI-powered insights, and detailed company analysis. The application features an intuitive dashboard with TradingView widgets, watchlist management, and automated email notifications for price alerts.


Features
Real-time Stock Tracking: Live stock price updates using Finnhub API with WebSocket support
Personalized Watchlists: Create and manage custom stock watchlists with real-time price updates
Smart Alerts: Set price alerts and get email notifications
AI-Powered Insights: Company analysis and price predictions using Google Gemini AI
User Authentication: Secure login system with Better Auth
Background Jobs: Automated tasks using Inngest
Responsive Design: Modern UI built with Tailwind CSS and shadcn/ui
Real-time WebSocket Updates: Live price streaming directly from Finnhub WebSocket API
Paper Trading: Practice trading with virtual money, track portfolio performance, and view transaction history
Strategy Backtesting: Test trading strategies on historical data with multiple strategy types (Buy & Hold, Moving Average, RSI)
Social Features: Community feed, posts, comments, likes, and discussions about stocks
Post Management: Delete your own posts with confirmation dialog

And many more, including code architecture and reusability.

Tech Stack
Frontend: Next.js 16.0.5, React 19.1.0, TypeScript
Styling: Tailwind CSS 4, shadcn/ui components
Database: MongoDB 7.0 with Mongoose 9.0
Authentication: Better Auth
Background Jobs: Inngest
APIs: Finnhub (stock data), Google Gemini (AI insights), TradingView (widgets)
Email: Nodemailer
Build Tool: Turbopack

Prerequisites
Node.js 18+
npm or yarn
MongoDB database
API keys for Finnhub, Google Gemini (optional)

Follow these steps to set up the project locally on your machine.

**Installation**

Install the project dependencies using npm:

```bash
npm install
```

**Set Up Environment Variables**

Create a new file named `.env` in the root of your project and add the following content:

```env
NODE_ENV='development'
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# FINNHUB
NEXT_PUBLIC_FINNHUB_API_KEY=
FINNHUB_BASE_URL=https://finnhub.io/api/v1

# MONGODB
MONGODB_URI=

# BETTER AUTH
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000

# GEMINI
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash  # Optional: Override default model (gemini-pro, gemini-1.5-pro, gemini-1.5-flash)

#NODEMAILER
NODEMAILER_EMAIL=
NODEMAILER_PASSWORD=
```

**Running the Project**

```bash
npm run dev
npx inngest-cli@latest dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the project.

**Troubleshooting**

**TradingView Widgets Not Loading (403 Forbidden)**

If TradingView widgets don't load in development, this is **expected behavior**. TradingView blocks requests from `localhost` and `127.0.0.1` for security reasons.

- ✅ **Widgets will work correctly in production** when deployed to a real domain
- ⚠️ In development, widgets will be hidden silently if they fail to load
- 💡 To test widgets locally, you can use tools like [ngrok](https://ngrok.com/) to expose your local server with a public URL

This is a known limitation with TradingView's security policies and not a bug in the application.

**Real-time WebSocket Updates**

The application uses Finnhub's WebSocket API for real-time stock price updates. Prices update automatically without page refresh.

- Real-time price updates appear with a green indicator when connected
- WebSocket automatically reconnects if the connection is lost
- Initial prices are fetched via REST API, then updated via WebSocket
- Works seamlessly in both development and production environments
- Enhanced error handling with detailed diagnostics for connection issues

**Community Feed Features**

The social/community feed allows users to share insights, trades, questions, and news about stocks.

- Create posts with different types (insight, trade, question, news)
- Like and comment on posts
- Delete your own posts with confirmation
- Filter posts by stock symbol
- Real-time updates when new posts are created
- User authentication required for all social features

**Additional Notes**

- The application uses the latest versions of Next.js 16, React 19, MongoDB 7, and Mongoose 9
- All major dependencies have been updated to their latest stable versions
- The application is fully responsive and optimized for all screen sizes
- Error handling is implemented throughout the application for a smooth user experience

---

## 🚀 Advanced Features & Future Enhancements

### 📊 **Analytics & Reporting**
- **Portfolio Analytics Dashboard**: Advanced charts showing portfolio performance over time, sector allocation, risk metrics
- **Trade Journal**: Detailed logging of trading decisions, emotions, and outcomes for learning
- **Performance Reports**: Weekly/monthly/yearly reports with PDF export
- **Tax Reporting**: Generate tax reports for realized gains/losses
- **ROI Calculator**: Calculate returns on investment with different time periods

### 🤖 **AI & Machine Learning**
- **Sentiment Analysis**: Analyze news and social media sentiment for stocks
- **Pattern Recognition**: AI-powered detection of chart patterns (head & shoulders, triangles, etc.)
- **Risk Assessment**: ML models to assess portfolio risk and suggest diversification
- **Automated Trading Signals**: AI-generated buy/sell signals based on multiple indicators
- **News Summarization**: AI-powered summaries of financial news relevant to your portfolio
- **Chatbot Assistant**: AI assistant to answer questions about stocks and trading

### 📱 **Mobile & Notifications**
- **Mobile App**: React Native or PWA for iOS/Android
- **Push Notifications**: Real-time alerts for price movements, news, and social interactions
- **SMS Alerts**: Critical alerts via SMS (Twilio integration)
- **Telegram/Discord Bots**: Integration with messaging platforms for alerts
- **Browser Extensions**: Chrome/Firefox extension for quick stock lookups

### 💬 **Enhanced Social Features**
- **User Profiles**: Detailed user profiles with trading stats, followers, and achievements
- **Direct Messaging**: Private messaging between users
- **Post Editing**: Edit posts after creation with edit history
- **Post Reactions**: Multiple reaction types (like, helpful, insightful, etc.)
- **Post Sharing**: Share posts to external platforms (Twitter, LinkedIn)
- **Mentions & Tags**: @mention users and #tag stocks in posts
- **Post Moderation**: Report inappropriate content, admin moderation tools
- **User Reputation System**: Points/badges for helpful contributions
- **Following System**: Follow users to see their posts in a personalized feed
- **Bookmarks**: Save favorite posts for later reading

### 📈 **Advanced Trading Features**
- **Options Trading**: Support for options contracts (calls, puts, spreads)
- **Crypto Integration**: Add cryptocurrency trading alongside stocks
- **Forex Trading**: Foreign exchange market support
- **Futures Trading**: Futures contracts support
- **Order Types**: Limit orders, stop-loss, trailing stops, bracket orders
- **Paper Trading Competition**: Leaderboards and competitions for paper trading
- **Copy Trading**: Follow and copy successful traders' strategies
- **Portfolio Templates**: Pre-built portfolio templates (aggressive, conservative, etc.)

### 🔔 **Smart Alerts & Automation**
- **Multi-condition Alerts**: Complex alerts with AND/OR logic (e.g., "Price > $100 AND Volume > 1M")
- **Technical Indicator Alerts**: Alerts based on RSI, MACD, moving averages crossing
- **Earnings Calendar Alerts**: Notifications for upcoming earnings reports
- **Dividend Alerts**: Notifications for dividend payments and ex-dates
- **Automated Strategies**: Set up automated trading strategies (e.g., DCA, rebalancing)
- **IFTTT Integration**: Connect with other services for automation

### 📰 **News & Research**
- **News Aggregation**: Aggregate news from multiple sources (Yahoo Finance, Bloomberg, etc.)
- **News Sentiment Scoring**: AI-powered sentiment analysis for news articles
- **Research Reports**: Generate detailed research reports for stocks
- **Earnings Calendar**: Calendar view of upcoming earnings reports
- **Insider Trading Tracker**: Track insider buying/selling activities
- **Institutional Holdings**: Track what institutions are buying/selling
- **Analyst Ratings**: Aggregate analyst ratings and price targets

### 📊 **Advanced Charts & Technical Analysis**
- **Custom Indicators**: Add custom technical indicators
- **Drawing Tools**: Trend lines, Fibonacci retracements, support/resistance levels
- **Chart Patterns**: Automatic detection of chart patterns
- **Multiple Timeframes**: View charts in different timeframes simultaneously
- **Chart Annotations**: Save and share chart annotations
- **Screener**: Advanced stock screener with multiple filters
- **Heatmaps**: Sector and market heatmaps

### 🎯 **Portfolio Management**
- **Multiple Portfolios**: Create and manage multiple portfolios
- **Portfolio Sharing**: Share portfolio performance with others (public/private)
- **Portfolio Templates**: Clone portfolios from templates
- **Rebalancing Tools**: Automated portfolio rebalancing suggestions
- **Tax-Loss Harvesting**: Suggestions for tax-loss harvesting opportunities
- **Dividend Tracking**: Track dividend income and yield
- **Cost Basis Tracking**: Detailed cost basis tracking for tax purposes

### 🔐 **Security & Privacy**
- **Two-Factor Authentication (2FA)**: Enhanced security with 2FA
- **API Key Management**: Secure storage and rotation of API keys
- **Audit Logs**: Track all user actions for security
- **Data Encryption**: End-to-end encryption for sensitive data
- **Privacy Controls**: Granular privacy settings for profiles and portfolios
- **GDPR Compliance**: Data export and deletion features

### 🌐 **Internationalization**
- **Multi-language Support**: Support for multiple languages (i18n)
- **Multi-currency**: Support for different currencies and exchange rates
- **Regional Markets**: Support for international stock markets (LSE, TSE, etc.)
- **Time Zone Handling**: Proper timezone handling for global users

### 📊 **Data & Integrations**
- **Export Data**: Export portfolios, trades, and reports to CSV/PDF/Excel
- **Import Data**: Import trades from brokers (CSV, API)
- **Broker Integration**: Direct integration with popular brokers (Robinhood, TD Ameritrade, etc.)
- **Plaid Integration**: Connect bank accounts for real trading
- **Yahoo Finance API**: Additional data source integration
- **Alpha Vantage Integration**: More technical indicators and data

### 🎮 **Gamification**
- **Achievements & Badges**: Unlock achievements for various milestones
- **Leaderboards**: Rankings for best traders, most helpful users
- **Challenges**: Weekly/monthly trading challenges
- **Streaks**: Daily login and trading streaks
- **Virtual Rewards**: Points system that can be redeemed

### 🔍 **Search & Discovery**
- **Advanced Search**: Search posts, users, stocks with filters
- **Stock Recommendations**: AI-powered stock recommendations based on preferences
- **Trending Stocks**: Show trending stocks based on social activity
- **Similar Stocks**: Find stocks similar to ones you're interested in
- **Watchlist Suggestions**: AI-suggested stocks for your watchlist

### 📱 **User Experience**
- **Dark/Light Mode Toggle**: User preference for theme
- **Customizable Dashboard**: Drag-and-drop dashboard customization
- **Keyboard Shortcuts**: Power user keyboard shortcuts
- **Accessibility**: WCAG compliance for screen readers
- **Offline Mode**: Basic functionality when offline
- **Progressive Web App (PWA)**: Install as app on mobile devices

### 🧪 **Testing & Quality**
- **Unit Tests**: Comprehensive unit test coverage
- **Integration Tests**: End-to-end testing
- **Performance Monitoring**: Real-time performance metrics
- **Error Tracking**: Sentry or similar error tracking
- **A/B Testing**: Feature flagging and A/B testing framework

### 🏗️ **Infrastructure**
- **Caching Layer**: Redis for caching frequently accessed data
- **CDN Integration**: CloudFlare or similar for static assets
- **Database Optimization**: Query optimization and indexing
- **Load Balancing**: Handle high traffic loads
- **Microservices**: Break down into microservices for scalability
- **GraphQL API**: Alternative API layer for flexible queries

### 💼 **Business Features**
- **Subscription Tiers**: Free, Pro, Premium tiers with different features
- **Payment Integration**: Stripe/PayPal for subscriptions
- **Affiliate Program**: Referral system for user acquisition
- **White Label**: Allow others to rebrand the platform
- **API Access**: Public API for developers

---

## 🎯 **Priority Recommendations**

### **High Priority (Quick Wins)**
1. **Post Editing** - Allow users to edit their posts
2. **User Profiles** - Basic user profile pages with stats
3. **Following System** - Follow users and personalized feed
4. **Advanced Alerts** - Multi-condition alerts
5. **Export/Import** - Export portfolios and trades

### **Medium Priority (High Impact)**
1. **Mobile PWA** - Progressive Web App for mobile
2. **Sentiment Analysis** - AI sentiment for news and social posts
3. **Portfolio Analytics** - Advanced analytics dashboard
4. **Options Trading** - Support for options
5. **Broker Integration** - Connect real trading accounts

### **Long-term (Strategic)**
1. **Native Mobile Apps** - iOS and Android apps
2. **Machine Learning Models** - Advanced ML for predictions
3. **Microservices Architecture** - Scalable architecture
4. **International Markets** - Support global markets
5. **Enterprise Features** - B2B features for institutions

---

These features can be implemented incrementally based on user feedback and business priorities. Start with high-priority quick wins to improve user engagement, then move to medium-priority features for competitive advantage, and finally implement long-term strategic features for market leadership.


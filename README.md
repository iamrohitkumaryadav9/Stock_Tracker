                Signalist - Stock Tracker Application

Overview
Signalist is a comprehensive stock tracking application built with Next.js 16.0.5, React 19, and TypeScript. It provides real-time stock price monitoring, personalized alerts, AI-powered insights, and detailed company analysis. The application features an intuitive dashboard with TradingView widgets, watchlist management, and automated email notifications for price alerts.


Features
Real-time Stock Tracking: Live stock price updates using Finnhub API
Personalized Watchlists: Create and manage custom stock watchlists
Smart Alerts: Set price alerts and get email notifications
AI-Powered Insights: Company analysis using Google Gemini AI
User Authentication: Secure login system with Better Auth
Background Jobs: Automated tasks using Inngest
Responsive Design: Modern UI built with Tailwind CSS and shadcn/ui

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

**Additional Notes**

- The application uses the latest versions of Next.js 16, React 19, MongoDB 7, and Mongoose 9
- All major dependencies have been updated to their latest stable versions
- The application is fully responsive and optimized for all screen sizes
- Error handling is implemented throughout the application for a smooth user experience


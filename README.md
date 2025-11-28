                Signalist - Stock Tracker Application

Overview
Signalist is a comprehensive stock tracking application built with Next.js 15.5.2, React 19, and TypeScript. It provides real-time stock price monitoring, personalized alerts, AI-powered insights, and detailed company analysis.


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
Frontend: Next.js 15.5.2, React 19, TypeScript
Styling: Tailwind CSS, shadcn/ui components
Database: MongoDB with Mongoose
Authentication: Better Auth
Background Jobs: Inngest
APIs: Finnhub (stock data), Google Gemini (AI insights)
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


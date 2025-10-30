# Naturacalm Backend API

Backend API for Naturacalm meditation app built with Node.js, TypeScript, Express, and MongoDB.

## Features

- TypeScript for type safety
- Express.js web framework
- MongoDB with Mongoose ODM
- JWT authentication (to be implemented)
- Winston logging
- Error handling middleware
- CORS and security headers (Helmet)
- Request validation
- Environment-based configuration

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB
- **ODM**: Mongoose
- **Cache**: Redis (to be configured)
- **Logger**: Winston
- **Validation**: Express Validator (to be added)
- **Security**: Helmet, CORS
- **Dev Tools**: ts-node-dev, ESLint, Prettier

## Prerequisites

- Node.js 18 or higher
- MongoDB (local or Atlas)
- Redis (optional, for caching)
- npm or yarn

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

4. Update environment variables in `.env` file

## Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/naturacalm
JWT_SECRET=your-secret-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-change-this
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d
REDIS_URL=redis://localhost:6379
R2_ACCOUNT_ID=your-cloudflare-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket-name
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
```

## NPM Scripts

```bash
# Development
npm run dev          # Start development server with hot reload

# Production
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── env.ts        # Environment variables validation
│   │   └── database.ts   # MongoDB connection
│   ├── models/           # Mongoose models
│   ├── controllers/      # Route controllers
│   ├── routes/           # API routes
│   │   └── health.routes.ts
│   ├── middlewares/      # Custom middleware
│   │   └── errorHandler.ts
│   ├── services/         # Business logic
│   ├── utils/            # Utility functions
│   │   ├── asyncHandler.ts
│   │   ├── response.ts
│   │   └── logger.ts
│   ├── types/            # TypeScript types
│   ├── validators/       # Request validation
│   ├── app.ts            # Express app setup
│   └── server.ts         # Server entry point
├── tests/                # Test files
├── logs/                 # Log files
├── dist/                 # Compiled JavaScript (build output)
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment template
├── tsconfig.json         # TypeScript configuration
├── .eslintrc.json        # ESLint configuration
├── .prettierrc           # Prettier configuration
└── package.json          # Dependencies and scripts
```

## API Endpoints

### Health Check

- **GET** `/api/v1/health` - Health check endpoint
  - Returns server status, uptime, and database connection status

### Authentication (To be implemented)

- **POST** `/api/v1/auth/register` - Register new user
- **POST** `/api/v1/auth/login` - Login user
- **POST** `/api/v1/auth/refresh` - Refresh access token
- **POST** `/api/v1/auth/logout` - Logout user

### Users (To be implemented)

- **GET** `/api/v1/users/me` - Get current user profile
- **PATCH** `/api/v1/users/me` - Update user profile

### Tracks (To be implemented)

- **GET** `/api/v1/tracks` - Get all tracks
- **GET** `/api/v1/tracks/:id` - Get track by ID
- **POST** `/api/v1/tracks` - Create track (admin)
- **PATCH** `/api/v1/tracks/:id` - Update track (admin)
- **DELETE** `/api/v1/tracks/:id` - Delete track (admin)

## Development

Start the development server:

```bash
npm run dev
```

The server will start on `http://localhost:5000`

Test the health check endpoint:

```bash
curl http://localhost:5000/api/v1/health
```

## Error Handling

The API uses a centralized error handling middleware that:

- Catches all errors
- Formats error responses consistently
- Logs errors for debugging
- Differentiates between operational and programming errors
- Handles MongoDB validation errors

## Logging

Winston logger is configured with:

- Console logging in development
- File logging for all environments
- Separate error log file
- Timestamp and colorized output
- Log levels: error, warn, info, http, debug

## Code Quality

### ESLint

Run linting:

```bash
npm run lint
```

### Prettier

Format code:

```bash
npm run format
```

## Production Build

Build the project:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## API Documentation

Full API documentation will be available at `/api/v1/docs` (Swagger/OpenAPI - to be implemented)

## License

ISC

## Contributors

Naturacalm Development Team

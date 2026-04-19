# Firecrawl + Gemini Job Scraper API

A REST API that crawls company career pages using Firecrawl and filters for entry-level software developer positions using Google's Gemini AI.

## Features

- 🕷️ **Web Crawling**: Uses Firecrawl to crawl company career pages
- 🤖 **AI Filtering**: Leverages Gemini 2.5-flash to filter entry-level software developer jobs
- ⚡ **Redis Caching**: Upstash Redis caching for improved performance and cost efficiency
- 🏗️ **Modular Architecture**: Loosely coupled services following good design patterns
- 📊 **JSON API**: Clean REST endpoints returning structured data
- 🔧 **Extensible**: Easy to add new companies or modify filtering criteria

## Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Environment Variables:**
   Copy `.env.example` to `.env` and add your API keys:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with your actual API keys:

   ```
   FIRECRAWL_API_KEY=fc-your-actual-firecrawl-key
   GEMINI_API_KEY=your-actual-gemini-key
   PORT=3000
   ```

3. **Start the API:**
   ```bash
   npm start
   ```

## API Endpoints

### Health Check

```http
GET /health
```

Returns API status and service configuration.

### List Companies

```http
GET /companies
```

Returns all configured companies and their career page URLs.

### Crawl All Companies (Filtered)

```http
GET /crawl/all
```

Crawls all company career pages and filters for entry-level software developer positions using Gemini AI.

**Response:**

```json
{
  "success": true,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "results": [
    {
      "company": "Google",
      "entryLevelJobs": [
        {
          "title": "Software Engineer I",
          "experience": "0-2 years",
          "description": "Entry-level software engineering position...",
          "url": "https://careers.google.com/job/123"
        }
      ],
      "totalJobsFound": 1
    }
  ]
}
```

### Crawl Specific Company (Filtered)

```http
GET /crawl/:companyName
```

Crawls a specific company's career page and filters for entry-level positions.

**Example:**

```http
GET /crawl/Google
```

### Crawl Specific Company (Raw Data)

```http
GET /crawl-raw/:companyName
```

Returns raw crawled data without AI filtering for debugging purposes.

### Cache Management

#### Clear All Cache

```http
DELETE /cache
```

Clears all cached job data from Redis.

#### Clear Company Cache

```http
DELETE /cache/:companyName
```

Clears cached data for a specific company (both crawled and filtered data).

**Example:**

```http
DELETE /cache/Google
```

## Caching Strategy

The API implements intelligent caching using Upstash Redis to improve performance and reduce API costs:

- **Crawled Data Cache**: Raw crawled data from Firecrawl (expires in 1 hour by default)
- **Filtered Data Cache**: AI-filtered job results from Gemini (expires in 1 hour by default)
- **Cache Keys**: `jobs:{companyName}:filtered` and `jobs:{url}:crawled`
- **Cache Miss Handling**: Automatically fetches fresh data when cache expires
- **Error Caching**: Failed requests are cached for 5 minutes to prevent rapid retries

### Environment Variables for Caching

```bash
REDIS_URL=https://your-redis-url.upstash.io
REDIS_TOKEN=your-redis-token
CACHE_EXPIRY_SECONDS=3600  # 1 hour default
```

## Performance Benefits

- **Cost Reduction**: Avoid redundant API calls to Firecrawl and Gemini
- **Faster Response Times**: Cached results served in milliseconds
- **Rate Limit Management**: Respect API limits while maintaining functionality
- **Scalability**: Handle more requests without proportional cost increase

## Job Filtering Criteria

The Gemini AI filters for these entry-level software developer roles:

- **Titles**: Software Developer, SDE-1, Graduate Trainee, Entry Level Software Engineer, Junior Developer, Associate Software Engineer
- **Experience**: 0-2 years, 1-3 years, 1-2 years, Entry Level, Fresh Graduate
- **Programs**: Graduate programs, internship-to-hire, fresh graduate positions

**Excludes**: Senior/Lead/Principal roles, positions requiring 3+ years experience, non-software development roles.

## Architecture

### Service Layer Pattern

- **FirecrawlService**: Handles web crawling operations with caching
- **GeminiService**: Manages AI filtering and job analysis with caching
- **CacheService**: Redis-based caching for performance optimization
- **Express App**: REST API layer coordinating services

### Design Principles

- **Single Responsibility**: Each service has one clear purpose
- **Dependency Injection**: Services are injected with API keys
- **Error Handling**: Comprehensive error handling with fallbacks
- **Extensibility**: Easy to add new companies or modify filtering logic

## File Structure

```
├── app.js                    # Main Express application
├── services/
│   ├── firecrawlService.js   # Firecrawl integration
│   ├── geminiService.js      # Gemini AI integration
│   └── cacheService.js       # Redis caching service
├── companies.json           # Company career page URLs
├── package.json             # Dependencies and scripts
├── .env                     # Environment variables (gitignored)
├── .env.example             # Environment template
└── .gitignore              # Git ignore rules
```

## Adding New Companies

Edit `companies.json` to add new companies:

```json
[
  {
    "name": "Your Company",
    "careersUrl": "https://careers.yourcompany.com"
  }
]
```

## Customization

### Modifying Job Filters

Update the system prompt in `GeminiService.filterEntryLevelJobs()` to change filtering criteria.

### Adding New Endpoints

Add new routes in `app.js` following the existing pattern.

### Changing AI Model

Update the model name in `GeminiService` constructor (currently using `gemini-1.5-flash`).

## Error Handling

The API includes comprehensive error handling:

- Invalid company names return 404 with available options
- Service failures return 500 with error details
- Missing API keys are reported in health checks
- Gemini parsing errors include fallback responses

## Rate Limits & Costs

- **Firecrawl**: Respects crawl limits (default: 10 pages per company)
- **Gemini**: Each company crawl triggers one AI request
- Monitor your API usage and costs accordingly

## Development

### Testing Endpoints

```bash
# Health check
curl http://localhost:3000/health

# List companies
curl http://localhost:3000/companies

# Crawl Google jobs
curl http://localhost:3000/crawl/Google
```

### Debugging

- Use `/crawl-raw/:companyName` to see raw crawled data
- Check console logs for detailed error information
- Health endpoint shows service configuration status

import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { FirecrawlService } from './services/firecrawlService.js';
import { GeminiService } from './services/geminiService.js';
import { CacheService } from './services/cacheService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
const cacheService = new CacheService(
  process.env.REDIS_URL,
  process.env.REDIS_TOKEN,
  parseInt(process.env.CACHE_EXPIRY_SECONDS) || 3600
);

const firecrawlService = new FirecrawlService(process.env.FIRECRAWL_API_KEY, cacheService);
const geminiService = new GeminiService(process.env.GEMINI_API_KEY, cacheService);

// Load companies from companies.json
const companiesPath = path.join(process.cwd(), 'companies.json');
const companies = JSON.parse(fs.readFileSync(companiesPath, 'utf8'));

// Middleware
app.use(express.json());

// GET endpoint to crawl all companies and filter entry-level jobs
app.get('/crawl/all', async (req, res) => {
  try {
    // Crawl all companies
    const crawlResults = await firecrawlService.crawlMultipleCompanies(companies);

    // Filter for entry-level jobs using Gemini
    const filteredResults = await geminiService.batchFilterJobs(crawlResults);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      results: filteredResults
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to crawl a specific company and filter entry-level jobs
app.get('/crawl/:companyName', async (req, res) => {
  try {
    const company = companies.find(c => c.name.toLowerCase() === req.params.companyName.toLowerCase());

    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company '${req.params.companyName}' not found`,
        availableCompanies: companies.map(c => c.name)
      });
    }

    // Crawl the specific company
    const crawlResult = await firecrawlService.crawlCompany(company.careersUrl);

    // Filter for entry-level jobs using Gemini
    const filteredJobs = await geminiService.filterEntryLevelJobs(crawlResult, company.name);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      result: filteredJobs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to crawl without Gemini filtering (raw data)
app.get('/crawl-raw/:companyName', async (req, res) => {
  try {
    const company = companies.find(c => c.name.toLowerCase() === req.params.companyName.toLowerCase());

    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company '${req.params.companyName}' not found`,
        availableCompanies: companies.map(c => c.name)
      });
    }

    const crawlResult = await firecrawlService.crawlCompany(company.careersUrl);

    res.json({
      success: true,
      company: company.name,
      url: company.careersUrl,
      timestamp: new Date().toISOString(),
      data: crawlResult
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint to list all available companies
app.get('/companies', (req, res) => {
  res.json({
    success: true,
    count: companies.length,
    companies: companies
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const cacheHealthy = await cacheService.isHealthy();
  const cacheStats = await cacheService.getStats();

  res.json({
    success: true,
    status: 'API is running',
    services: {
      firecrawl: process.env.FIRECRAWL_API_KEY ? 'configured' : 'missing API key',
      gemini: process.env.GEMINI_API_KEY ? 'configured' : 'missing API key',
      redis: cacheHealthy ? 'connected' : 'disconnected'
    },
    cache: {
      healthy: cacheHealthy,
      stats: cacheStats
    },
    timestamp: new Date().toISOString()
  });
});

// Cache management endpoints
app.delete('/cache', async (req, res) => {
  try {
    const cleared = await cacheService.clearAllJobs();
    res.json({
      success: cleared,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete('/cache/:companyName', async (req, res) => {
  try {
    const company = companies.find(c => c.name.toLowerCase() === req.params.companyName.toLowerCase());

    if (!company) {
      return res.status(404).json({
        success: false,
        error: `Company '${req.params.companyName}' not found`,
        availableCompanies: companies.map(c => c.name)
      });
    }

    // Delete both crawled and filtered cache for the company
    const crawledKey = cacheService.generateKey(company.careersUrl, 'crawled');
    const filteredKey = cacheService.generateKey(company.name, 'filtered');

    await cacheService.delete(crawledKey);
    await cacheService.delete(filteredKey);

    res.json({
      success: true,
      message: `Cache cleared for ${company.name}`,
      keysDeleted: [crawledKey, filteredKey],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`Firecrawl + Gemini Job Scraper API running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET /health - Health check`);
  console.log(`  GET /companies - List all companies`);
  console.log(`  GET /crawl/all - Crawl all companies and filter entry-level jobs`);
  console.log(`  GET /crawl/:companyName - Crawl specific company and filter jobs`);
  console.log(`  GET /crawl-raw/:companyName - Crawl specific company (raw data)`);  console.log(`  DELETE /cache - Clear all cached data`);
  console.log(`  DELETE /cache/:companyName - Clear cache for specific company`);});

app.listen(PORT, () => {
  console.log(`Firecrawl Web Scraper API running on http://localhost:${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET /health - Health check`);
  console.log(`  GET /companies - List all companies`);
  console.log(`  GET /crawl/all - Crawl all company career pages`);
  console.log(`  GET /crawl/:companyName - Crawl specific company (e.g., /crawl/Google)`);
});

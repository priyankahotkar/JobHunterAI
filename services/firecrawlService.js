import Firecrawl from '@mendable/firecrawl-js';

export class FirecrawlService {
  constructor(apiKey, cacheService = null) {
    this.firecrawl = new Firecrawl({ apiKey });
    this.cacheService = cacheService;
  }

  /**
   * Crawl a single company career page
   * @param {string} url - Career page URL
   * @param {Object} options - Crawl options
   * @returns {Promise<Object>} Crawled data
   */
  async crawlCompany(url, options = {}) {
    // Check cache first
    if (this.cacheService) {
      const cacheKey = this.cacheService.generateKey(url, 'crawled');
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    const defaultOptions = {
      limit: 10,
      ...options
    };

    try {
      const result = await this.firecrawl.crawl(url, defaultOptions);

      // Cache the result
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateKey(url, 'crawled');
        await this.cacheService.set(cacheKey, result);
      }

      return result;
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);

      // Cache error result for a shorter time
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateKey(url, 'crawled');
        await this.cacheService.set(cacheKey, { error: error.message }, 300); // 5 minutes for errors
      }

      throw error;
    }
  }

  /**
   * Crawl multiple company career pages
   * @param {Array} companies - Array of company objects with name and careersUrl
   * @param {Object} options - Crawl options
   * @returns {Promise<Array>} Array of crawled data
   */
  async crawlMultipleCompanies(companies, options = {}) {
    const results = [];

    for (const company of companies) {
      console.log(`Crawling ${company.name} career page...`);
      try {
        const crawledData = await this.crawlCompany(company.careersUrl, options);
        results.push({
          company,
          crawledData
        });
      } catch (error) {
        console.error(`Failed to crawl ${company.name}:`, error);
        results.push({
          company,
          crawledData: null,
          error: error.message
        });
      }
    }

    return results;
  }
}
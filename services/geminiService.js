import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiService {
  constructor(apiKey, cacheService = null) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.cacheService = cacheService;
  }

  /**
   * Filter job postings for entry-level software developer roles
   * @param {string} crawledData - The crawled data from Firecrawl
   * @param {string} companyName - Name of the company
   * @returns {Promise<Object>} Filtered job data in JSON format
   */
  async filterEntryLevelJobs(crawledData, companyName) {
    // Check cache first
    if (this.cacheService) {
      const cacheKey = this.cacheService.generateKey(companyName, 'filtered');
      const cachedResult = await this.cacheService.get(cacheKey);
      if (cachedResult) {
        return cachedResult;
      }
    }

    const systemPrompt = `You are a job filtering assistant. Your task is to analyze crawled career page data and extract only entry-level software developer positions.

ENTRY-LEVEL CRITERIA:
- Software Developer, SDE-1, Graduate Trainee, Entry Level Software Engineer
- Junior Developer, Associate Software Engineer
- Roles requiring 0-2 years, 1-3 years, or 1-2 years of experience
- Fresh graduate positions, internship-to-hire, or graduate programs
- Entry-level positions in software development, web development, mobile development

EXCLUDE:
- Senior, Lead, Principal, Manager, Architect roles
- Roles requiring 3+ years of experience
- Non-software development roles (QA, DevOps, Data Science unless entry-level software focus)

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:
{
  "company": "Company Name",
  "entryLevelJobs": [
    {
      "title": "Job Title",
      "experience": "0-2 years" or "1-3 years" or "1-2 years" or "Entry Level" or "Fresh Graduate",
      "description": "Brief job description (max 200 chars)",
      "url": "Job posting URL if available"
    }
  ],
  "totalJobsFound": number
}

If no entry-level jobs found, return:
{
  "company": "Company Name",
  "entryLevelJobs": [],
  "totalJobsFound": 0
}

IMPORTANT: Return ONLY the JSON object, no additional text, explanations, or formatting.`;

    try {
      const prompt = `${systemPrompt}\n\nCompany: ${companyName}\n\nCrawled Data:\n${JSON.stringify(crawledData, null, 2)}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Clean the response to ensure it's valid JSON
      const cleanedText = text.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');

      let parsedResult;
      try {
        parsedResult = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON:', cleanedText);
        // Return a fallback structure
        parsedResult = {
          company: companyName,
          entryLevelJobs: [],
          totalJobsFound: 0,
          error: 'Failed to parse response'
        };
      }

      // Cache the result
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateKey(companyName, 'filtered');
        await this.cacheService.set(cacheKey, parsedResult);
      }

      return parsedResult;
    } catch (error) {
      console.error('Gemini API error:', error);
      const errorResult = {
        company: companyName,
        entryLevelJobs: [],
        totalJobsFound: 0,
        error: error.message
      };

      // Cache error result for a shorter time to allow retries
      if (this.cacheService) {
        const cacheKey = this.cacheService.generateKey(companyName, 'filtered');
        await this.cacheService.set(cacheKey, errorResult, 300); // 5 minutes for errors
      }

      return errorResult;
    }
  }

  /**
   * Batch process multiple companies' crawled data
   * @param {Array} companyData - Array of {company, crawledData} objects
   * @returns {Promise<Array>} Array of filtered job data
   */
  async batchFilterJobs(companyData) {
    const results = [];

    for (const { company, crawledData } of companyData) {
      console.log(`Filtering jobs for ${company.name}...`);
      const filteredJobs = await this.filterEntryLevelJobs(crawledData, company.name);
      results.push(filteredJobs);
    }

    return results;
  }
}
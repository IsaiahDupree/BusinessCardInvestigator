/**
 * Service for performing Google searches via SerpAPI
 */
const SerpApi = require('google-search-results-nodejs');
require('dotenv').config();

class GoogleSearchService {
  constructor() {
    this.search = new SerpApi.GoogleSearch(process.env.SERPAPI_KEY);
  }

  /**
   * Search for a business using Google Search
   * @param {string} businessName - Name of the business to search for
   * @returns {Promise<object>} - Search results
   */
  async searchBusiness(businessName) {
    return new Promise((resolve, reject) => {
      const params = {
        q: `${businessName} company information`,
        hl: 'en',
        gl: 'us',
        num: 10
      };

      this.search.json(params, (data) => {
        if (data.error) {
          reject(new Error(`SerpAPI Error: ${data.error}`));
          return;
        }
        
        // Extract organic results and other relevant information
        const results = {
          organicResults: data.organic_results || [],
          knowledgeGraph: data.knowledge_graph || null,
          relatedQuestions: data.related_questions || [],
          websiteUrl: this.extractWebsiteUrl(data)
        };
        
        resolve(results);
      });
    });
  }

  /**
   * Extract the main website URL for a business from search results
   * @param {object} searchData - The search results data
   * @returns {string|null} - The website URL or null if not found
   */
  extractWebsiteUrl(searchData) {
    // Try to get URL from knowledge graph
    if (searchData.knowledge_graph && searchData.knowledge_graph.website) {
      return searchData.knowledge_graph.website;
    }
    
    // Try to get URL from organic results
    if (searchData.organic_results && searchData.organic_results.length > 0) {
      // Look for likely company domain in first few results
      for (let i = 0; i < Math.min(3, searchData.organic_results.length); i++) {
        const result = searchData.organic_results[i];
        if (result.link && !result.link.includes('facebook.com') && 
            !result.link.includes('linkedin.com') && 
            !result.link.includes('twitter.com') &&
            !result.link.includes('instagram.com') &&
            !result.link.includes('wikipedia.org')) {
          return result.link;
        }
      }
    }
    
    return null;
  }
}

module.exports = new GoogleSearchService();

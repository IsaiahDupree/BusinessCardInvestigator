/**
 * Service for interacting with the Perplexity API
 */
const axios = require('axios');
require('dotenv').config();

class PerplexityService {
  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY;
    this.baseUrl = 'https://api.perplexity.ai';
  }

  /**
   * Query the Perplexity API for business information
   * @param {string} businessName - Name of the business to investigate
   * @returns {Promise<object>} - Business information from Perplexity
   */
  async queryBusinessInfo(businessName) {
    try {
      const response = await axios({
        method: 'POST',
        url: `${this.baseUrl}/chat/completions`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        data: {
          model: 'sonar-medium-online',
          messages: [
            {
              role: 'system',
              content: 'You are a business analyst assistant. Provide comprehensive information about businesses.'
            },
            {
              role: 'user',
              content: `I need a detailed analysis of "${businessName}". Please include: 
              1. What industry they operate in
              2. Their main products or services
              3. Company size and structure
              4. Key competitors
              5. Recent news or developments
              6. Potential business challenges they might be facing`
            }
          ],
          options: {
            temperature: 0.2
          }
        }
      });

      return {
        analysis: response.data.choices[0].message.content,
        sources: response.data.choices[0].message.content.match(/https?:\/\/[^\s]+/g) || []
      };
    } catch (error) {
      console.error('Error querying Perplexity API:', error.message);
      throw new Error(`Failed to get business information from Perplexity: ${error.message}`);
    }
  }
}

module.exports = new PerplexityService();

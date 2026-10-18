/**
 * Service for analyzing business data from multiple sources
 * and generating comprehensive reports
 */
const perplexityService = require('./perplexityService');
const googleSearchService = require('./googleSearchService');
const websiteScraper = require('./websiteScraper');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

class BusinessAnalyzer {
  constructor() {
    this.resultsDir = path.join(__dirname, '../../data/results');
    // Ensure results directory exists
    if (!fs.existsSync(this.resultsDir)) {
      fs.mkdirSync(this.resultsDir, { recursive: true });
    }
  }

  /**
   * Investigate a business by collecting data from multiple sources
   * @param {string} businessName - Name of the business to investigate
   * @returns {Promise<object>} - Investigation results
   */
  async investigateBusiness(businessName) {
    console.log(`Starting investigation for: ${businessName}`);
    const resultId = uuidv4();
    const timestamp = new Date().toISOString();
    
    try {
      // Create initial result object
      const investigation = {
        id: resultId,
        businessName,
        timestamp,
        status: 'in_progress',
        data: {},
        summary: null,
        recommendationsList: []
      };
      
      // Save initial state
      this.saveResults(resultId, investigation);
      
      // Step 1: Get Google search results
      console.log('Fetching Google search results...');
      const googleResults = await googleSearchService.searchBusiness(businessName);
      investigation.data.googleSearch = googleResults;
      investigation.status = 'google_search_completed';
      this.saveResults(resultId, investigation);
      
      // Step 2: Get Perplexity analysis
      console.log('Fetching Perplexity analysis...');
      const perplexityResults = await perplexityService.queryBusinessInfo(businessName);
      investigation.data.perplexity = perplexityResults;
      investigation.status = 'perplexity_completed';
      this.saveResults(resultId, investigation);
      
      // Step 3: Scrape business website if available
      if (googleResults.websiteUrl) {
        console.log(`Scraping business website: ${googleResults.websiteUrl}`);
        try {
          const websiteData = await websiteScraper.scrapeWebsite(googleResults.websiteUrl);
          investigation.data.website = websiteData;
        } catch (error) {
          console.error('Error scraping website:', error.message);
          investigation.data.website = { error: error.message };
        }
      } else {
        investigation.data.website = { error: 'No website URL found' };
      }
      
      investigation.status = 'website_scraping_completed';
      this.saveResults(resultId, investigation);
      
      // Step 4: Generate final analysis and recommendations
      investigation.summary = this.generateBusinessSummary(investigation.data);
      investigation.recommendationsList = this.generateRecommendations(investigation.data);
      investigation.status = 'completed';
      
      // Save final results
      this.saveResults(resultId, investigation);
      
      return { 
        id: resultId, 
        status: 'completed',
        businessName
      };
    } catch (error) {
      console.error('Error during business investigation:', error);
      
      // Save error state
      const errorResult = {
        id: resultId,
        businessName,
        timestamp,
        status: 'error',
        error: error.message
      };
      
      this.saveResults(resultId, errorResult);
      
      throw new Error(`Investigation failed: ${error.message}`);
    }
  }

  /**
   * Generate a comprehensive summary of the business
   * @param {object} data - Collected business data
   * @returns {object} - Business summary
   */
  generateBusinessSummary(data) {
    const summary = {
      overview: '',
      industry: '',
      productsServices: [],
      onlinePresence: {
        website: data.website?.domain || 'Not found',
        socialMedia: {}
      },
      competitiveLandscape: '',
      challenges: []
    };
    
    // Extract industry information from Perplexity data
    if (data.perplexity && data.perplexity.analysis) {
      const analysis = data.perplexity.analysis;
      
      // Try to extract industry information
      const industryMatch = analysis.match(/industry:?\s*([^.]+)/i) || 
                           analysis.match(/operates in (?:the\s+)?([^.]+)/i);
      if (industryMatch) {
        summary.industry = industryMatch[1].trim();
      }
      
      // Generate overview
      summary.overview = this.extractOverview(analysis);
      
      // Extract competitive landscape
      const competitiveMatch = analysis.match(/competitors?:?\s*([^.]+(?:\.[^.]+){0,2})/i) ||
                              analysis.match(/competitive landscape:?\s*([^.]+(?:\.[^.]+){0,2})/i);
      if (competitiveMatch) {
        summary.competitiveLandscape = competitiveMatch[1].trim();
      }
      
      // Extract challenges
      const challengesMatch = analysis.match(/challenges?:?\s*([^.]+(?:\.[^.]+){0,2})/i) ||
                             analysis.match(/facing:?\s*([^.]+(?:\.[^.]+){0,2})/i);
      if (challengesMatch) {
        const challengesText = challengesMatch[1].trim();
        summary.challenges = challengesText
          .split(/,|;|\band\b/)
          .map(challenge => challenge.trim())
          .filter(challenge => challenge.length > 5);
      }
    }
    
    // Extract products/services from website data
    if (data.website && data.website.productsServices) {
      summary.productsServices = data.website.productsServices;
    }
    
    // If no products/services from website, try to extract from Perplexity
    if (summary.productsServices.length === 0 && data.perplexity) {
      const analysis = data.perplexity.analysis;
      const productsMatch = analysis.match(/products?(?:\s+and\s+services)?:?\s*([^.]+(?:\.[^.]+){0,2})/i) ||
                           analysis.match(/services?:?\s*([^.]+(?:\.[^.]+){0,2})/i);
      
      if (productsMatch) {
        const productsText = productsMatch[1].trim();
        summary.productsServices = productsText
          .split(/,|;|\band\b/)
          .map(product => product.trim())
          .filter(product => product.length > 2);
      }
    }
    
    // Add social media presence
    if (data.website && data.website.socialLinks) {
      const { facebook, twitter, linkedin, instagram } = data.website.socialLinks;
      if (facebook) summary.onlinePresence.socialMedia.facebook = facebook;
      if (twitter) summary.onlinePresence.socialMedia.twitter = twitter;
      if (linkedin) summary.onlinePresence.socialMedia.linkedin = linkedin;
      if (instagram) summary.onlinePresence.socialMedia.instagram = instagram;
    }
    
    return summary;
  }

  /**
   * Extract a concise overview from analysis text
   * @param {string} analysisText - Text to extract overview from
   * @returns {string} - Business overview
   */
  extractOverview(analysisText) {
    // Try to find the first 1-2 sentences that describe the business
    const firstParagraph = analysisText.split('\n')[0];
    const sentences = firstParagraph.split(/\.(?:\s+|\s*$)/);
    
    // Get the first 1-2 substantial sentences
    const relevantSentences = sentences
      .filter(s => s.length > 15 && !s.includes('welcome') && !s.includes('hello'))
      .slice(0, 2);
    
    if (relevantSentences.length > 0) {
      return relevantSentences.join('. ') + '.';
    }
    
    // Fallback: try to get any sentence with the business name in it
    const businessNameRegex = new RegExp(this.escapeRegExp(this.extractBusinessName(analysisText)), 'i');
    const businessSentence = sentences.find(s => businessNameRegex.test(s) && s.length > 20);
    
    if (businessSentence) {
      return businessSentence.trim() + '.';
    }
    
    // Last resort: just take the first substantial sentence
    return sentences.find(s => s.length > 20)?.trim() + '.' || 'Information not available.';
  }

  /**
   * Extract business name from analysis
   * @param {string} text - Analysis text
   * @returns {string} - Business name
   */
  extractBusinessName(text) {
    const lines = text.split('\n');
    // Check if the first line has the business name
    const firstLine = lines[0];
    
    if (firstLine.includes(':')) {
      return firstLine.split(':')[1].trim();
    }
    
    // Look for business name in first sentence
    const firstSentence = firstLine.split('.')[0];
    const nameMatch = firstSentence.match(/(?:about|on|for|of)\s+([^,.]+)/i);
    
    if (nameMatch) {
      return nameMatch[1].trim();
    }
    
    // Just return the first few words if nothing else works
    return firstSentence.split(' ').slice(0, 3).join(' ');
  }

  /**
   * Escape special characters for RegExp
   * @param {string} string - String to escape
   * @returns {string} - Escaped string
   */
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate business recommendations based on collected data
   * @param {object} data - Collected business data
   * @returns {Array<object>} - List of recommendations
   */
  generateRecommendations(data) {
    const recommendations = [];
    
    // Check website recommendations
    if (data.website) {
      // Missing about page
      if (!data.website.hasAboutPage && !data.website.aboutContent) {
        recommendations.push({
          category: 'Website',
          title: 'Add an About Page',
          description: 'Create a dedicated About page to communicate your company\'s story, mission, and values to build trust with visitors.'
        });
      }
      
      // Missing contact page
      if (!data.website.hasContactPage) {
        recommendations.push({
          category: 'Website',
          title: 'Add a Contact Page',
          description: 'Create a dedicated Contact page to make it easy for potential customers to reach you.'
        });
      }
      
      // Missing services/products page
      if (!data.website.hasServicesPage && data.website.productsServices.length === 0) {
        recommendations.push({
          category: 'Website',
          title: 'Add a Services/Products Page',
          description: 'Create a dedicated page that clearly outlines your offerings to help visitors understand your value proposition.'
        });
      }
      
      // Missing social media links
      const socialLinks = data.website.socialLinks || {};
      if (!socialLinks.facebook && !socialLinks.twitter && !socialLinks.linkedin && !socialLinks.instagram) {
        recommendations.push({
          category: 'Online Presence',
          title: 'Add Social Media Links',
          description: 'Connect your website to your social media accounts to increase your online presence and engagement.'
        });
      }
    }
    
    // Extract challenges from Perplexity analysis and suggest solutions
    if (data.perplexity && data.perplexity.analysis) {
      // Look for challenges in the Perplexity analysis
      const challengesMatches = data.perplexity.analysis.match(/challenges?[^.]+\./gi) || 
                               data.perplexity.analysis.match(/(?:difficulties|struggles|problems)[^.]+\./gi);
      
      if (challengesMatches && challengesMatches.length > 0) {
        // For each identified challenge, suggest a solution
        challengesMatches.slice(0, 3).forEach(challenge => {
          // Generate a recommendation based on the challenge
          const cleanChallenge = challenge.replace(/^challenges?:?\s*/i, '').trim();
          const recommendation = this.generateChallengeRecommendation(cleanChallenge);
          
          if (recommendation) {
            recommendations.push(recommendation);
          }
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Generate a recommendation for a specific business challenge
   * @param {string} challenge - Business challenge
   * @returns {object|null} - Recommendation object
   */
  generateChallengeRecommendation(challenge) {
    // Skip if challenge is too short
    if (challenge.length < 10) return null;
    
    // Look for common challenge keywords and suggest solutions
    const lowerChallenge = challenge.toLowerCase();
    
    if (lowerChallenge.includes('compet')) {
      return {
        category: 'Strategy',
        title: 'Competitive Differentiation',
        description: 'Focus on developing and highlighting your unique value proposition to stand out from competitors.'
      };
    } else if (lowerChallenge.includes('market') && (lowerChallenge.includes('share') || lowerChallenge.includes('penetration'))) {
      return {
        category: 'Marketing',
        title: 'Market Expansion Strategy',
        description: 'Develop targeted marketing campaigns to reach new customer segments and increase market share.'
      };
    } else if (lowerChallenge.includes('digital') || lowerChallenge.includes('online') || lowerChallenge.includes('tech')) {
      return {
        category: 'Digital Transformation',
        title: 'Digital Strategy Enhancement',
        description: 'Invest in digital technologies to improve operations, customer experience, and competitive advantage.'
      };
    } else if (lowerChallenge.includes('customer') && (lowerChallenge.includes('retention') || lowerChallenge.includes('acquisition'))) {
      return {
        category: 'Customer Relations',
        title: 'Customer Loyalty Program',
        description: 'Implement a customer loyalty program to increase retention and encourage repeat business.'
      };
    } else {
      // Generic recommendation for unidentified challenges
      return {
        category: 'Business Development',
        title: 'Strategic Review',
        description: 'Conduct a comprehensive strategic review to address current challenges and identify growth opportunities.'
      };
    }
  }

  /**
   * Save investigation results to a file
   * @param {string} resultId - Investigation ID
   * @param {object} data - Investigation data
   */
  saveResults(resultId, data) {
    const filePath = path.join(this.resultsDir, `${resultId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  /**
   * Get investigation results by ID
   * @param {string} resultId - Investigation ID
   * @returns {object|null} - Investigation results
   */
  getResults(resultId) {
    const filePath = path.join(this.resultsDir, `${resultId}.json`);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    
    return null;
  }
}

module.exports = new BusinessAnalyzer();

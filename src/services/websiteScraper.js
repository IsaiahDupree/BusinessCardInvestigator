/**
 * Service for scraping business websites to extract relevant information
 */
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const url = require('url');

class WebsiteScraper {
  /**
   * Scrape a business website to extract key information
   * @param {string} websiteUrl - URL of the website to scrape
   * @returns {Promise<object>} - Extracted website information
   */
  async scrapeWebsite(websiteUrl) {
    if (!websiteUrl) {
      throw new Error('No website URL provided for scraping');
    }

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.goto(websiteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Allow time for JavaScript to execute
      await page.waitForTimeout(2000);
      
      const content = await page.content();
      const $ = cheerio.load(content);
      
      // Parse the domain
      const parsedUrl = url.parse(websiteUrl);
      const domain = parsedUrl.hostname;

      // Extract important content from the website
      const result = {
        title: $('title').text().trim(),
        domain: domain,
        metaDescription: $('meta[name="description"]').attr('content') || '',
        aboutContent: this.extractAboutContent($),
        productsServices: this.extractProductsServices($),
        contactInfo: this.extractContactInfo($),
        socialLinks: this.extractSocialLinks($),
        screenshots: await this.captureScreenshots(page),
        textContent: this.extractMainTextContent($)
      };

      // Also check for common pages
      result.hasAboutPage = await this.checkPageExists(browser, websiteUrl, ['/about', '/about-us', '/company', '/who-we-are']);
      result.hasContactPage = await this.checkPageExists(browser, websiteUrl, ['/contact', '/contact-us']);
      result.hasServicesPage = await this.checkPageExists(browser, websiteUrl, ['/services', '/products', '/solutions', '/what-we-do']);

      return result;
    } catch (error) {
      console.error('Error scraping website:', error);
      throw new Error(`Failed to scrape website: ${error.message}`);
    } finally {
      await browser.close();
    }
  }

  /**
   * Extract about content from website
   * @param {object} $ - Cheerio instance
   * @returns {string} - About content
   */
  extractAboutContent($) {
    // Look for about sections based on common class names and IDs
    let aboutContent = '';
    
    // Check for about sections with common identifiers
    const aboutSelectors = [
      '#about', 
      '.about', 
      '[id*="about"]', 
      '[class*="about"]',
      'section:contains("About")',
      'div:contains("About Us")',
      '#about-us',
      '.about-us'
    ];
    
    aboutSelectors.forEach(selector => {
      const content = $(selector).text().trim();
      if (content && content.length > aboutContent.length) {
        aboutContent = content;
      }
    });
    
    return aboutContent;
  }

  /**
   * Extract products and services from website
   * @param {object} $ - Cheerio instance
   * @returns {Array<string>} - List of products/services
   */
  extractProductsServices($) {
    const products = [];
    
    // Common selectors for product sections
    const productSelectors = [
      '#products', 
      '.products', 
      '#services', 
      '.services',
      '[id*="product"]', 
      '[class*="product"]',
      '[id*="service"]', 
      '[class*="service"]'
    ];
    
    productSelectors.forEach(selector => {
      $(selector).find('h2, h3, h4, strong').each((i, el) => {
        const title = $(el).text().trim();
        if (title && title.length > 3) {
          products.push(title);
        }
      });
    });
    
    return [...new Set(products)]; // Remove duplicates
  }

  /**
   * Extract contact information from website
   * @param {object} $ - Cheerio instance
   * @returns {object} - Contact information
   */
  extractContactInfo($) {
    const contactInfo = {
      email: '',
      phone: '',
      address: ''
    };
    
    // Extract email addresses
    const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
    const bodyText = $('body').text();
    const emails = bodyText.match(emailRegex) || [];
    
    if (emails.length > 0) {
      // Filter out likely privacy emails
      const filteredEmails = emails.filter(email => 
        !email.includes('privacy') && 
        !email.includes('example') &&
        !email.includes('domain')
      );
      contactInfo.email = filteredEmails[0] || emails[0];
    }
    
    // Extract phone numbers
    const phoneRegex = /(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
    const phones = bodyText.match(phoneRegex) || [];
    if (phones.length > 0) {
      contactInfo.phone = phones[0];
    }
    
    // Extract address - look for address blocks
    $('[class*="address"], [id*="address"], .contact, #contact').each((i, el) => {
      const text = $(el).text().trim();
      if (text && text.length > 10 && contactInfo.address === '') {
        contactInfo.address = text;
      }
    });
    
    return contactInfo;
  }

  /**
   * Extract social media links from website
   * @param {object} $ - Cheerio instance
   * @returns {object} - Social media links
   */
  extractSocialLinks($) {
    const socialLinks = {
      facebook: '',
      twitter: '',
      linkedin: '',
      instagram: ''
    };
    
    // Find social links
    $('a[href*="facebook.com"]').first().each((i, el) => {
      socialLinks.facebook = $(el).attr('href');
    });
    
    $('a[href*="twitter.com"], a[href*="x.com"]').first().each((i, el) => {
      socialLinks.twitter = $(el).attr('href');
    });
    
    $('a[href*="linkedin.com"]').first().each((i, el) => {
      socialLinks.linkedin = $(el).attr('href');
    });
    
    $('a[href*="instagram.com"]').first().each((i, el) => {
      socialLinks.instagram = $(el).attr('href');
    });
    
    return socialLinks;
  }

  /**
   * Capture screenshots of the website
   * @param {object} page - Puppeteer page object
   * @returns {Promise<object>} - Screenshots (as base64)
   */
  async captureScreenshots(page) {
    // Take a full-page screenshot
    const fullPageBuffer = await page.screenshot({ 
      fullPage: true,
      type: 'jpeg',
      quality: 70
    });
    
    // Take a screenshot of the above-the-fold content
    const visibleBuffer = await page.screenshot({ 
      fullPage: false,
      type: 'jpeg',
      quality: 70
    });
    
    return {
      fullPage: fullPageBuffer.toString('base64'),
      aboveTheFold: visibleBuffer.toString('base64')
    };
  }

  /**
   * Extract main text content from the website
   * @param {object} $ - Cheerio instance
   * @returns {string} - Main text content
   */
  extractMainTextContent($) {
    // Remove script and style elements
    $('script, style, meta, link').remove();
    
    // Get text from main content areas
    const contentSelectors = [
      'main', 
      '#main',
      '#content',
      '.content',
      'article',
      '.main-content'
    ];
    
    let mainContent = '';
    contentSelectors.forEach(selector => {
      const content = $(selector).text().trim();
      if (content && content.length > mainContent.length) {
        mainContent = content;
      }
    });
    
    // If no content found from main selectors, get body text
    if (!mainContent) {
      mainContent = $('body').text().trim();
    }
    
    // Clean up the text (remove extra spaces, normalize line breaks)
    return mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  /**
   * Check if specific pages exist on the website
   * @param {object} browser - Puppeteer browser instance
   * @param {string} baseUrl - Base URL of the website
   * @param {Array<string>} pathsToCheck - Paths to check
   * @returns {Promise<boolean>} - Whether any of the pages exist
   */
  async checkPageExists(browser, baseUrl, pathsToCheck) {
    const parsedUrl = url.parse(baseUrl);
    const baseUrlWithoutPath = `${parsedUrl.protocol}//${parsedUrl.host}`;
    
    for (const path of pathsToCheck) {
      const pageUrl = `${baseUrlWithoutPath}${path}`;
      const page = await browser.newPage();
      
      try {
        const response = await page.goto(pageUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 10000 
        });
        
        await page.close();
        
        if (response && response.status() === 200) {
          return true;
        }
      } catch (error) {
        await page.close();
        continue;
      }
    }
    
    return false;
  }
}

module.exports = new WebsiteScraper();

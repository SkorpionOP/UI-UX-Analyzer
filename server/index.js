import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { JSDOM } from "jsdom";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

let genAIClient;
let geminiModel;

async function initializeGeminiClientAndModel() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL ERROR: GEMINI_API_KEY is not set in your .env file.");
    process.exit(1);
  }

  try {
    genAIClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const modelName = "gemini-2.0-flash";
    geminiModel = genAIClient.getGenerativeModel({
      model: modelName,
      generationConfig: {
        maxOutputTokens: 32768,
        temperature: 0.8,
      }
    });
    console.log(`Successfully initialized Gemini model: ${modelName}`);
  } catch (error) {
    console.error("CRITICAL ERROR initializing Gemini client or model:", error.message);
    process.exit(1);
  }
}

initializeGeminiClientAndModel().then(() => {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
});

/**
 * Generate comprehensive website summary for AI processing
 */
function generateWebsiteSummary(html, url = '') {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const summary = {
    metadata: extractMetadata(doc, url),
    structure: analyzeStructure(doc),
    content: extractContent(doc),
    design: analyzeDesign(doc),
    technical: analyzeTechnical(doc),
    accessibility: analyzeAccessibility(doc)
  };

  return summary;
}

/**
 * Extract website metadata
 */
function extractMetadata(doc, url) {
  return {
    title: doc.querySelector('title')?.textContent?.trim() || 'Untitled',
    description: doc.querySelector('meta[name="description"]')?.getAttribute('content') || '',
    keywords: doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '',
    domain: url ? new URL(url).hostname : '',
    language: doc.documentElement.lang || 'en',
    viewport: doc.querySelector('meta[name="viewport"]')?.getAttribute('content') || 'missing'
  };
}

/**
 * Analyze website structure
 */
function analyzeStructure(doc) {
  const structure = {
    hasHeader: !!doc.querySelector('header, .header, #header'),
    hasNav: !!doc.querySelector('nav, .nav, .navigation, .menu'),
    hasMain: !!doc.querySelector('main, .main, #main, .content'),
    hasSidebar: !!doc.querySelector('aside, .sidebar, .side-nav'),
    hasFooter: !!doc.querySelector('footer, .footer, #footer'),
    sections: doc.querySelectorAll('section').length,
    articles: doc.querySelectorAll('article').length
  };

  // Determine layout type
  if (structure.hasSidebar) {
    structure.layoutType = 'sidebar-layout';
  } else if (structure.sections > 3) {
    structure.layoutType = 'multi-section';
  } else if (structure.articles > 0) {
    structure.layoutType = 'article-based';
  } else {
    structure.layoutType = 'simple-page';
  }

  return structure;
}

/**
 * Extract key content information
 */
function extractContent(doc) {
  const headings = {
    h1: [...doc.querySelectorAll('h1')].map(h => h.textContent.trim()).slice(0, 3),
    h2: [...doc.querySelectorAll('h2')].map(h => h.textContent.trim()).slice(0, 5),
    h3: [...doc.querySelectorAll('h3')].map(h => h.textContent.trim()).slice(0, 5)
  };

  const content = {
    headings,
    paragraphCount: doc.querySelectorAll('p').length,
    imageCount: doc.querySelectorAll('img').length,
    linkCount: doc.querySelectorAll('a').length,
    formCount: doc.querySelectorAll('form').length,
    buttonCount: doc.querySelectorAll('button, input[type="button"], input[type="submit"]').length
  };

  // Determine content type
  const bodyText = doc.body?.textContent?.toLowerCase() || '';
  if (bodyText.includes('shop') || bodyText.includes('product') || bodyText.includes('cart') || bodyText.includes('buy')) {
    content.type = 'e-commerce';
  } else if (bodyText.includes('portfolio') || bodyText.includes('work') || bodyText.includes('project')) {
    content.type = 'portfolio';
  } else if (bodyText.includes('blog') || bodyText.includes('article') || content.articles > 0) {
    content.type = 'blog';
  } else if (bodyText.includes('service') || bodyText.includes('business') || bodyText.includes('company')) {
    content.type = 'business';
  } else if (content.formCount > 0) {
    content.type = 'application';
  } else {
    content.type = 'informational';
  }

  return content;
}

/**
 * Analyze design characteristics
 */
function analyzeDesign(doc) {
  const styles = [...doc.querySelectorAll('style, link[rel="stylesheet"]')]
    .map(s => s.textContent || '').join(' ');

  const design = {
    colors: extractColors(styles),
    fonts: extractFonts(styles),
    hasAnimations: /animation|transition|transform/.test(styles),
    hasGridLayout: /display:\s*grid|grid-template/.test(styles),
    hasFlexLayout: /display:\s*flex|flex-direction/.test(styles),
    hasResponsive: /@media/.test(styles),
    darkMode: /dark|night/.test(styles.toLowerCase()),
    designSystem: 'custom'
  };

  // Detect popular frameworks
  const classes = doc.body?.className || '';
  if (classes.includes('bootstrap') || styles.includes('bootstrap')) {
    design.designSystem = 'bootstrap';
  } else if (classes.includes('tailwind') || styles.includes('tailwind')) {
    design.designSystem = 'tailwind';
  } else if (styles.includes('material') || classes.includes('mat-')) {
    design.designSystem = 'material';
  }

  return design;
}

/**
 * Extract color palette from CSS
 */
function extractColors(styles) {
  const hexColors = styles.match(/#[0-9a-fA-F]{3,6}/g) || [];
  const rgbColors = styles.match(/rgb\([^)]+\)/g) || [];
  const namedColors = styles.match(/:\s*(red|blue|green|black|white|gray|yellow|orange|purple|pink|brown)\b/g) || [];
  
  const allColors = [...new Set([...hexColors, ...rgbColors, ...namedColors.map(c => c.replace(':', '').trim())])];
  return allColors.slice(0, 10); // Top 10 colors
}

/**
 * Extract font information
 */
function extractFonts(styles) {
  const fontFamilies = styles.match(/font-family:\s*([^;]+)/g) || [];
  const uniqueFonts = [...new Set(fontFamilies.map(f => f.replace('font-family:', '').trim()))];
  return uniqueFonts.slice(0, 5);
}

/**
 * Analyze technical aspects
 */
function analyzeTechnical(doc) {
  return {
    hasJavaScript: doc.querySelectorAll('script[src], script:not([src])').length > 0,
    externalStylesheets: doc.querySelectorAll('link[rel="stylesheet"]').length,
    inlineStyles: doc.querySelectorAll('style').length,
    metaTags: doc.querySelectorAll('meta').length,
    htmlVersion: doc.doctype ? 'HTML5' : 'Legacy HTML',
    hasServiceWorker: /service-?worker/.test(doc.body?.innerHTML || ''),
    hasManifest: !!doc.querySelector('link[rel="manifest"]')
  };
}

/**
 * Analyze accessibility features
 */
function analyzeAccessibility(doc) {
  return {
    hasAltTexts: [...doc.querySelectorAll('img')].every(img => img.hasAttribute('alt')),
    hasAriaLabels: doc.querySelectorAll('[aria-label], [aria-labelledby]').length > 0,
    hasSemanticHTML: doc.querySelectorAll('header, nav, main, article, section, aside, footer').length > 0,
    hasSkipLinks: !!doc.querySelector('a[href^="#"]'),
    headingStructure: analyzeHeadingStructure(doc),
    formLabels: analyzeFormLabels(doc),
    colorContrast: 'unknown' // Would need additional analysis
  };
}

function analyzeHeadingStructure(doc) {
  const headings = [...doc.querySelectorAll('h1, h2, h3, h4, h5, h6')];
  const levels = headings.map(h => parseInt(h.tagName.charAt(1)));
  
  return {
    hasH1: levels.includes(1),
    multipleH1: levels.filter(l => l === 1).length > 1,
    properHierarchy: isProperHeadingHierarchy(levels)
  };
}

function isProperHeadingHierarchy(levels) {
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i-1] + 1) return false;
  }
  return true;
}

function analyzeFormLabels(doc) {
  const inputs = doc.querySelectorAll('input, textarea, select');
  let labeledInputs = 0;
  
  inputs.forEach(input => {
    if (input.hasAttribute('aria-label') || 
        input.hasAttribute('aria-labelledby') ||
        doc.querySelector(`label[for="${input.id}"]`) ||
        input.closest('label')) {
      labeledInputs++;
    }
  });
  
  return {
    total: inputs.length,
    labeled: labeledInputs,
    percentage: inputs.length ? Math.round((labeledInputs / inputs.length) * 100) : 100
  };
}

/**
 * Create clean HTML template for AI to work with
 */
function createCleanTemplate(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Remove only non-essential elements
  const toRemove = [
    'script[src*="analytics"]',
    'script[src*="gtag"]',
    'script[src*="facebook"]',
    'script[async]:not([essential])',
    'noscript',
    '.ads',
    '.advertisement',
    '[data-ad]'
  ];

  toRemove.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove());
  });

  // Keep essential structure and content
  const template = dom.serialize();
  
  // If still too large, create a structural template
  if (template.length > 50000) {
    return createStructuralTemplate(doc);
  }
  
  return template;
}

function createStructuralTemplate(doc) {
  const template = `<!DOCTYPE html>
<html lang="${doc.documentElement.lang || 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${doc.querySelector('title')?.textContent || 'Website'}</title>
  ${doc.head.querySelector('style')?.outerHTML || ''}
</head>
<body>
  ${doc.querySelector('header')?.outerHTML || ''}
  ${doc.querySelector('nav')?.outerHTML || ''}
  ${doc.querySelector('main')?.outerHTML || doc.body.innerHTML}
  ${doc.querySelector('footer')?.outerHTML || ''}
</body>
</html>`;
  
  return template;
}

// Enhanced CSS inlining
async function inlineExternalCSS(html, baseUrl, maxCssSize = 80000) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href]')];
  
  let totalInlinedSize = 0;

  for (const link of links) {
    let href = link.getAttribute("href");
    if (!href) continue;

    try {
      const cssUrl = new URL(href, baseUrl).href;
      
      if (totalInlinedSize > maxCssSize) break;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const cssResp = await fetch(cssUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; UI-Improver/1.0)',
          'Accept': 'text/css'
        }
      });

      clearTimeout(timeoutId);

      if (!cssResp.ok) continue;

      let cssText = await cssResp.text();
      
      // Optimize CSS
      cssText = cssText.replace(/\/\*[\s\S]*?\*\//g, '')
                      .replace(/\s+/g, ' ')
                      .trim();

      if (totalInlinedSize + cssText.length <= maxCssSize) {
        const styleEl = document.createElement("style");
        styleEl.textContent = cssText;
        link.parentNode.replaceChild(styleEl, link);
        totalInlinedSize += cssText.length;
      }
    } catch (e) {
      console.warn(`Could not inline CSS for ${href}:`, e.message);
    }
  }

  return dom.serialize();
}

app.get("/fetch-html", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter." });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status} - ${response.statusText}`);

    let html = await response.text();
    console.log(`Fetched HTML length: ${html.length}`);

    html = await inlineExternalCSS(html, url);
    console.log(`Final HTML length after CSS inlining: ${html.length}`);

    res.json({
      html,
      originalSize: html.length,
      warning: html.length > 500000 ? "Large HTML detected" : null
    });
  } catch (error) {
    console.error(`Error fetching HTML from URL "${url}":`, error.message);
    res.status(500).json({ error: `Failed to fetch HTML from URL: ${error.message}` });
  }
});

app.post("/analyze-uiux", async (req, res) => {
  const { html, url } = req.body;
  if (!html) return res.status(400).json({ error: "Missing HTML in request body." });

  if (!geminiModel) return res.status(500).json({ error: "Gemini model not initialized." });

  console.log(`Received HTML for analysis: ${html.length} characters`);

  // Generate comprehensive website summary
  const websiteSummary = generateWebsiteSummary(html, url);
  const cleanTemplate = createCleanTemplate(html);
  
  console.log(`Summary generated. Template size: ${cleanTemplate.length} characters`);

  // Create detailed prompt with summary
  const prompt = `You are an expert frontend developer. Based on the following website analysis and template, create a modern, enhanced version.

=== WEBSITE ANALYSIS ===
**Metadata:**
- Title: ${websiteSummary.metadata.title}
- Type: ${websiteSummary.content.type}
- Domain: ${websiteSummary.metadata.domain}
- Description: ${websiteSummary.metadata.description}

**Structure & Layout:**
- Layout Type: ${websiteSummary.structure.layoutType}
- Has Header: ${websiteSummary.structure.hasHeader}
- Has Navigation: ${websiteSummary.structure.hasNav}
- Has Sidebar: ${websiteSummary.structure.hasSidebar}
- Has Footer: ${websiteSummary.structure.hasFooter}
- Sections: ${websiteSummary.structure.sections}

**Content Overview:**
- Main Headings: ${websiteSummary.content.headings.h1.join(', ')}
- Sub Headings: ${websiteSummary.content.headings.h2.slice(0, 3).join(', ')}
- Content Elements: ${websiteSummary.content.paragraphCount} paragraphs, ${websiteSummary.content.imageCount} images, ${websiteSummary.content.buttonCount} buttons

**Current Design:**
- Color Palette: ${websiteSummary.design.colors.join(', ')}
- Fonts: ${websiteSummary.design.fonts.join(', ')}
- Design System: ${websiteSummary.design.designSystem}
- Has Responsive Design: ${websiteSummary.design.hasResponsive}
- Uses Flexbox: ${websiteSummary.design.hasFlexLayout}
- Uses Grid: ${websiteSummary.design.hasGridLayout}

**Accessibility Status:**
- Semantic HTML: ${websiteSummary.accessibility.hasSemanticHTML}
- Alt Texts: ${websiteSummary.accessibility.hasAltTexts}
- ARIA Labels: ${websiteSummary.accessibility.hasAriaLabels}
- Form Labels: ${websiteSummary.accessibility.formLabels.percentage}% labeled

=== ENHANCEMENT INSTRUCTIONS ===
Based on this analysis, create a modernized version that:

1. **Preserves Identity**: Keep the ${websiteSummary.content.type} website's purpose and branding
2. **Enhances Design**: Improve the visual hierarchy, spacing, and modern appeal
3. **Improves Accessibility**: Address the identified accessibility gaps
4. **Modernizes Layout**: Use modern CSS techniques (Grid/Flexbox) appropriately for the ${websiteSummary.structure.layoutType}
5. **Responsive Design**: Ensure mobile-first approach
6. **Performance**: Optimize for loading and interaction

**Specific Focus Areas:**
${websiteSummary.design.hasResponsive ? '- Enhance existing responsive design' : '- Add comprehensive responsive design'}
${websiteSummary.accessibility.hasSemanticHTML ? '- Maintain semantic structure' : '- Improve semantic HTML structure'}
${websiteSummary.design.colors.length > 0 ? `- Work with existing color palette: ${websiteSummary.design.colors.slice(0, 3).join(', ')}` : '- Create cohesive color system'}

=== HTML TEMPLATE TO ENHANCE ===
${cleanTemplate}

Return ONLY the complete enhanced HTML document starting with <!DOCTYPE html> and ending with </html>. All CSS must be internal within <style> tags.`;

  try {
    console.log("Sending website summary to Gemini API...");
    const result = await geminiModel.generateContent(prompt);
    const response = await result.response;
    let improvedHtml = response.text();

    // Clean up response
    improvedHtml = improvedHtml.replace(/```html\n?/g, '').replace(/```\n?/g, '').trim();

    if (!improvedHtml.includes('<!DOCTYPE html>') || !improvedHtml.includes('</html>')) {
      throw new Error('Generated HTML is incomplete');
    }

    console.log("Generated improved HTML length:", improvedHtml.length);

    res.json({
      improvedHtml,
      websiteSummary,
      originalSize: html.length,
      templateSize: cleanTemplate.length,
      outputSize: improvedHtml.length,
      processingMethod: 'summary-based'
    });
  } catch (error) {
    console.error("Gemini API error:", error.message);

    const fallbackHtml = createSmartFallback(cleanTemplate, websiteSummary);
    res.json({
      improvedHtml: fallbackHtml,
      warning: `Used smart fallback: ${error.message}`,
      websiteSummary,
      processingMethod: 'summary-based-fallback'
    });
  }
});

/**
 * Create fallback based on website summary
 */
function createSmartFallback(template, summary) {
  const dom = new JSDOM(template);
  const doc = dom.window.document;

  // Add modern enhancements based on summary
  const style = doc.createElement('style');
  
  // Build CSS based on website type and characteristics
  let css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    html { scroll-behavior: smooth; }
    
    body {
      font-family: ${summary.design.fonts[0] || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'};
      line-height: 1.6;
      color: #333;
    }
  `;

  // Add layout-specific styles
  if (summary.structure.layoutType === 'sidebar-layout') {
    css += `
      .container { display: grid; grid-template-columns: 250px 1fr; gap: 2rem; }
      @media (max-width: 768px) { .container { grid-template-columns: 1fr; } }
    `;
  } else if (summary.content.type === 'e-commerce') {
    css += `
      .product-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
      .btn-primary { background: #007bff; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 0.375rem; }
    `;
  }

  // Add responsive design
  css += `
    @media (max-width: 768px) {
      body { font-size: 16px; padding: 1rem; }
      h1 { font-size: 1.75rem; }
      h2 { font-size: 1.5rem; }
    }
  `;

  style.textContent = css;
  doc.head.appendChild(style);

  return dom.serialize();
}

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    geminiModel: !!geminiModel
  });
});

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});
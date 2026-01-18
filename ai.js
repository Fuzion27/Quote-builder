/**
 * AI Routes - Secure proxy to Claude API
 * 
 * This route handles all AI-related requests, keeping the API key
 * secure on the server side.
 */

const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { optionalAuth } = require('../middleware/auth');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * POST /api/ai/chat
 * 
 * Send a message to Claude with quote context for pricing assistance.
 * 
 * Body:
 * - message: string (required) - The user's question
 * - context: object (optional) - Current quote data for context
 */
router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { message, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ 
        error: 'AI service not configured. Please set ANTHROPIC_API_KEY.' 
      });
    }

    // Build the system prompt with context
    const systemPrompt = buildSystemPrompt(context);

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        { role: 'user', content: message }
      ]
    });

    // Extract text response
    const aiResponse = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    res.json({ 
      response: aiResponse,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens
      }
    });

  } catch (error) {
    console.error('AI chat error:', error);
    
    if (error.status === 401) {
      return res.status(503).json({ error: 'AI service authentication failed' });
    }
    
    if (error.status === 429) {
      return res.status(429).json({ error: 'AI rate limit exceeded. Please try again later.' });
    }

    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

/**
 * POST /api/ai/analyze-quote
 * 
 * Get a comprehensive analysis of the current quote.
 */
router.post('/analyze-quote', optionalAuth, async (req, res) => {
  try {
    const { quote, settings } = req.body;

    if (!quote || !quote.items || quote.items.length === 0) {
      return res.status(400).json({ error: 'Quote with items is required' });
    }

    const systemPrompt = buildSystemPrompt({ quote, settings });
    
    const analysisPrompt = `Analyze this quote and provide:
1. Overall assessment (is this quote competitive and profitable?)
2. Margin analysis (are margins appropriate for this customer type?)
3. Freight optimization opportunities
4. BIPOC sourcing percentage and recommendations
5. Specific actionable recommendations

Be concise and use specific numbers from the quote.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: analysisPrompt }
      ]
    });

    const aiResponse = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    res.json({ analysis: aiResponse });

  } catch (error) {
    console.error('Quote analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze quote' });
  }
});

/**
 * POST /api/ai/suggest-margin
 * 
 * Get margin suggestions based on customer type and order size.
 */
router.post('/suggest-margin', optionalAuth, async (req, res) => {
  try {
    const { customerType, totalCases, totalValue, products } = req.body;

    const prompt = `For a ${customerType} customer ordering ${totalCases} cases (approximately $${totalValue} total value), what margin percentage would you recommend?

Consider:
- Customer type (Food Banks typically get 15-20%, Schools 15-18%, Corporate 20-30%)
- Order volume (larger orders can have slightly lower margins)
- Product mix and typical market rates

Provide a specific recommended margin percentage and brief reasoning.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You are a pricing expert for a food distribution company. Give concise, actionable margin recommendations.',
      messages: [
        { role: 'user', content: prompt }
      ]
    });

    const aiResponse = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    res.json({ suggestion: aiResponse });

  } catch (error) {
    console.error('Margin suggestion error:', error);
    res.status(500).json({ error: 'Failed to get margin suggestion' });
  }
});

/**
 * Build the system prompt with quote context
 */
function buildSystemPrompt(context) {
  let prompt = `You are a pricing assistant for Saba Grocers Initiative, a mission-driven food hub in Oakland, CA that connects BIPOC farmers to underserved communities.

Your role is to help optimize quotes, analyze pricing strategies, and provide actionable recommendations. Always be concise and specific with numbers.

Key priorities for Saba:
1. Maintain sustainable margins (typically 15-25% depending on customer type)
2. Maximize BIPOC vendor sourcing
3. Keep pricing competitive for food banks and schools
4. Optimize logistics costs through volume and route efficiency
`;

  if (context) {
    if (context.quote) {
      prompt += `\n\nCURRENT QUOTE CONTEXT:\n`;
      prompt += `Customer: ${context.quote.customerName || 'Not selected'}\n`;
      prompt += `Customer Type: ${context.quote.customerType || 'Unknown'}\n`;
      prompt += `Delivery Distance: ${context.quote.distance || 'Unknown'} miles\n`;
      
      if (context.quote.items && context.quote.items.length > 0) {
        const totalCases = context.quote.items.reduce((sum, i) => sum + (i.cases || 0), 0);
        const totalValue = context.quote.items.reduce((sum, i) => sum + (i.lineTotal || 0), 0);
        const bipocCount = context.quote.items.filter(i => i.bipoc).length;
        
        prompt += `Total Cases: ${totalCases}\n`;
        prompt += `Total Value: $${totalValue.toFixed(2)}\n`;
        prompt += `BIPOC Items: ${bipocCount} of ${context.quote.items.length} (${Math.round(bipocCount/context.quote.items.length*100)}%)\n`;
        
        prompt += `\nLine Items:\n`;
        context.quote.items.forEach(item => {
          prompt += `- ${item.product}: ${item.cases} cases @ $${item.pricePerCase?.toFixed(2) || '?'}/case, ${item.marginPercent}% margin, ${item.bipoc ? 'BIPOC' : 'non-BIPOC'}\n`;
        });
      }
    }

    if (context.settings) {
      prompt += `\nPRICING SETTINGS:\n`;
      prompt += `Base Freight Rate: $${context.settings.baseFreightRate}/pallet\n`;
      prompt += `Per-Mile Rate: $${context.settings.perMileRate}/mile/pallet\n`;
      prompt += `Pallet Break Surcharge: ${context.settings.palletBreakSurcharge}%\n`;
      
      if (context.settings.volumeTiers) {
        prompt += `Volume Discount Tiers:\n`;
        context.settings.volumeTiers.forEach(tier => {
          prompt += `  ${tier.minCases}-${tier.maxCases} cases: ${tier.discount}% off freight\n`;
        });
      }
    }
  }

  return prompt;
}

module.exports = router;

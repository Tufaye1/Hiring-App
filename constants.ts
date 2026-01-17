import { ProfileContext } from './types';

export const USER_PROFILE: ProfileContext = {
  background: [
    "Experience in media analysis, performance tracking, and campaign reporting",
    "Worked on integrated marketing campaigns and cross-functional coordination",
    "Regularly analyzes KPIs, dashboards, and Excel-based performance data"
  ],
  skills: [
    "Data analysis and reporting",
    "Excel, dashboards, and performance metrics",
    "Understanding of marketing funnels, media performance, and optimization",
    "Ability to translate data into insights for strategy and decision-making"
  ],
  interests: [
    "Marketing roles with data, experimentation, optimization, or growth focus",
    "Product Management, Product Operations, Product Analytics, and Associate PM roles",
    "Strategy, business operations, and analytics-heavy roles",
    "Tech-enabled, product-led, and SaaS companies"
  ],
  intent: [
    "Open to roles that are not a perfect match but offer strong learning and transition potential",
    "Interested in opportunities with as low as 20% relevance if they are promising or interesting"
  ]
};

export const TARGET_LOCATIONS = "Dhaka, Bangladesh or Remote (available to Bangladesh)";

export const SEARCH_PROMPT_TEMPLATE = `
Find currently active job listings posted within the last 24 hours for the following roles in ${TARGET_LOCATIONS}:
- Marketing (growth, performance, brand, digital, CRM, lifecycle)
- Product Management (associate PM, product ops, product analyst)
- Strategy, business operations, analytics, insights

Focus on tech companies, SaaS, agencies, startups, and reputable firms (e.g., Optimizely, SELISE, EKSIMI, etc.).
Do not invent listings. Only return real opportunities found in search results.
`;

export const ANALYSIS_SYSTEM_INSTRUCTION = `
You are a Personal Hiring Intelligence Analyst. Your goal is to analyze job listings against a user's specific profile and output structured data.

PROFILE CONTEXT:
${JSON.stringify(USER_PROFILE, null, 2)}

MATCHING LOGIC:
- Calculate relevance score (0.0 to 1.0).
- Strong match: >= 0.7
- Medium match: 0.4 - 0.69
- Exploratory: 0.2 - 0.39 (Include if they show growth potential, brand value, or exposure to product/data/strategy)
- Weak match: < 0.2 (Discard these unless highly interesting)

OUTPUT FORMAT:
Return a valid JSON array of objects.
Each object must have:
- company (string)
- title (string)
- location (string)
- url (string - use the grounded link if available, otherwise leave empty)
- relevanceScore (number)
- relevanceLabel (string: "Strong Match", "Medium Match", "Exploratory", or "Weak Match")
- reason (string - one line explanation of why this fits or is interesting)
- postedDate (string - approx relative time, e.g. "2 hours ago")

Strictly adhere to JSON format. No markdown code blocks.
`;

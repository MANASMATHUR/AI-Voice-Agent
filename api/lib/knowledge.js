/**
 * Riverwood Estate Knowledge Base
 * Accurate project information for the AI voice agent.
 */

export const RIVERWOOD_KNOWLEDGE = {
  project: {
    name: "Riverwood Estate",
    tagline: "Building Foundations",
    type: "Premium Residential Plotted Township",
    policy: "Deen Dayal Jan Awas Yojna (DDJAY)",
    developer: "Riverwood Projects LLP",
  },

  location: {
    sector: "Sector-7, Kharkhauda",
    district: "Sonipat",
    state: "Haryana",
    village: "Thana Kalan",
    nearbyHub: "IMT Kharkhauda (Industrial Model Township)",
    region: "NCR (National Capital Region)",
  },

  specifications: {
    totalArea: "15.5 acres",
    projectType: "Residential Plotted Colony",
    plotType: "Vastu-friendly plot sizes",
    approval: "DTCP Haryana License under DDJAY",
    zoningPlan: "Approved by Town & Country Planning Department",
  },

  features: [
    "Tree-inspired road names (Bargad Avenue, Neem Ridge, Silver Oak Avenue)",
    "Vastu-friendly plot sizes ideal for independent homes",
    "Planned internal roads and community areas",
    "Government-approved zoning and layout",
    "Premium township identity",
    "10% land reserved for community facilities (parks, amenities)",
  ],

  ddjayBenefits: [
    "Fully licensed by Town & Country Planning Department",
    "Regulated development standards",
    "Government-approved planning",
    "Infrastructure integration with city over time",
    "Transparency and compliance under Haryana Development & Regulation of Urban Areas Act",
  ],

  whyKharkhauda: [
    "Emerging industrial zone near NCR",
    "IMT Kharkhauda - major industrial hub with big manufacturers",
    "Similar growth pattern to Gurgaon and Manesar",
    "Workers and professionals moving nearby",
    "Housing demand increasing",
    "Land prices expected to rise with infrastructure development",
  ],

  investmentHighlights: [
    "Government-approved licensed project",
    "Strategic location near IMT industrial hub",
    "Early entry advantage before major development",
    "Suitable for end-users and long-term investors",
    "Planned township with premium identity",
  ],

  constructionUpdates: [
    {
      phase: "Phase 1",
      status: "In Progress",
      details: "Boundary wall and internal road development underway",
    },
    {
      phase: "Infrastructure",
      status: "Planning Complete",
      details: "Electrical and water infrastructure design finalized",
    },
    {
      phase: "Landscaping",
      status: "Design Phase",
      details: "Tree plantation and green area planning in progress",
    },
  ],
};

export function getProjectSummary() {
  return `Riverwood Estate is a premium ${RIVERWOOD_KNOWLEDGE.specifications.totalArea} residential plotted township in ${RIVERWOOD_KNOWLEDGE.location.sector}, ${RIVERWOOD_KNOWLEDGE.location.district}. It's a DDJAY-licensed project near the upcoming IMT Kharkhauda industrial hub, making it ideal for both homebuyers and investors.`;
}

export function getLocationBenefits() {
  return `Kharkhauda is emerging as a major industrial zone near NCR. The IMT Kharkhauda hub will bring major manufacturers, creating demand for housing. Similar growth happened in Gurgaon and Manesar - Kharkhauda is entering the same phase now.`;
}

export function getRandomConstructionUpdate() {
  const updates = [
    "Boundary wall construction is progressing well",
    "Internal road development is underway",
    "Infrastructure planning has been completed",
    "Landscaping design is being finalized",
    "Plot demarcation work is ongoing",
    "Entry gate design has been approved",
  ];
  return updates[Math.floor(Math.random() * updates.length)];
}

export function getSystemPromptKnowledge() {
  return `
PROJECT KNOWLEDGE (Use this for accurate responses):

RIVERWOOD ESTATE FACTS:
- Name: Riverwood Estate by Riverwood Projects LLP
- Tagline: "Building Foundations"
- Location: Sector-7, Kharkhauda, District Sonipat, Haryana
- Total Area: 15.5 acres (NOT 25 acres)
- Type: Premium Residential Plotted Township
- Policy: DDJAY (Deen Dayal Jan Awas Yojna) - Haryana government scheme
- Approval: Licensed by DTCP Haryana, approved zoning plan

KEY SELLING POINTS:
1. Government-licensed under DDJAY - fully regulated, transparent
2. Near IMT Kharkhauda - major industrial hub (like Gurgaon/Manesar growth story)
3. Vastu-friendly plots for independent homes
4. Premium township identity with tree-named roads (Bargad Avenue, Neem Ridge, Silver Oak Avenue)
5. 10% land reserved for parks and community amenities

WHY INVEST NOW:
- Early entry before major IMT development
- Similar growth pattern to Gurgaon/Manesar
- Housing demand will increase with industrial workers
- Government-approved = safe investment

CURRENT STATUS:
- Boundary wall and road construction in progress
- Infrastructure planning completed
- Plot bookings open

LOCATION ADVANTAGE:
- Kharkhauda is becoming major industrial zone
- IMT Kharkhauda will house big manufacturers
- Workers/professionals will need nearby housing
- Land appreciation expected with infrastructure growth
`;
}

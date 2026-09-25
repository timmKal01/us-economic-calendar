// Impact rating, category, and canonical link for each release. The ratings follow
// how markets conventionally treat these releases (NFP/CPI/GDP/FOMC move everything;
// regional and niche series rarely do). They are an editorial judgement, stated as such
// in the README, not something the agencies publish.

const RULES = [
    // [title pattern, impact, category, BLS news-release code]
    [/^Employment Situation/i, 'high', 'labor', 'empsit'],
    [/^Consumer Price Index/i, 'high', 'inflation', 'cpi'],
    // BEA titles it both ways: "Gross Domestic Product, ..." and "GDP (Advance Estimate), ...".
    [/^(?:Gross Domestic Product|GDP)\b(?!.*\bby (?:State|County|Metro))/i, 'high', 'growth'],
    [/^Personal Income and Outlays/i, 'high', 'inflation'],
    [/^FOMC Rate Decision/i, 'high', 'central-bank'],
    [/Advance Monthly Sales for Retail|^Advance Monthly Retail/i, 'high', 'consumer'],
    [/^Producer Price Index/i, 'medium', 'inflation', 'ppi'],
    [/^Job Openings and Labor Turnover Survey/i, 'medium', 'labor', 'jolts'],
    [/^Employment Cost Index/i, 'medium', 'labor', 'eci'],
    [/Import and Export Price/i, 'medium', 'inflation', 'ximpim'],
    [/^Productivity and Costs/i, 'medium', 'labor', 'prod2'],
    [/International Trade in Goods and Services/i, 'medium', 'trade'],
    [/^Advance Economic Indicators/i, 'medium', 'trade'],
    [/^New Residential Construction/i, 'medium', 'housing'],
    [/^New Residential Sales/i, 'medium', 'housing'],
    [/Durable Goods/i, 'medium', 'manufacturing'],
    [/^Construction Spending/i, 'low', 'housing'],
    [/Manufacturers' Shipments/i, 'low', 'manufacturing'],
    [/Wholesale Trade|Business Inventories|Retail Inventories/i, 'low', 'trade'],
    [/^Real Earnings/i, 'low', 'labor', 'realer'],
    [/State Employment and Unemployment/i, 'low', 'labor', 'laus'],
    [/Metropolitan Area Employment/i, 'low', 'labor', 'metro'],
    [/State Job Openings/i, 'low', 'labor', 'jltst'],
    [/Weekly Earnings/i, 'low', 'labor', 'wkyeng'],
    [/Business Employment Dynamics/i, 'low', 'labor', 'cewbd'],
    [/Employment and Wages/i, 'low', 'labor', 'cewqtr'],
    [/International Transactions|International Investment Position/i, 'low', 'trade'],
    [/Personal Income by State|GDP by State|by County|by Metropolitan/i, 'low', 'growth'],
    [/Quarterly Services|Quarterly Financial|E-Commerce|Housing Vacancies/i, 'low', 'other'],
];

export function classify(row) {
    if (row.agency === 'Treasury') {
        const coupon = /Note|Bond|TIPS|FRN/i.test(row.securityType ?? row.title);
        return { impact: coupon ? 'medium' : 'low', category: 'treasury-auction', url: row.url };
    }
    for (const [re, impact, category, blsCode] of RULES) {
        if (re.test(row.title)) {
            let url = row.url;
            if (!url && row.agency === 'BLS') {
                url = blsCode ? `https://www.bls.gov/news.release/${blsCode}.toc.htm` : 'https://www.bls.gov/schedule/news_release/';
            }
            return { impact, category, url: url ?? defaultUrl(row.agency) };
        }
    }
    return { impact: 'low', category: 'other', url: row.url ?? defaultUrl(row.agency) };
}

function defaultUrl(agency) {
    return {
        BLS: 'https://www.bls.gov/schedule/news_release/',
        BEA: 'https://www.bea.gov/news/schedule',
        Census: 'https://www.census.gov/economic-indicators/',
    }[agency] ?? null;
}

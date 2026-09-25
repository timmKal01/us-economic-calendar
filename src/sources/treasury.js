// Announced US Treasury auctions from the Treasury's Fiscal Data API.
import { fetchText } from '../util.js';

const API = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/upcoming_auctions';

export async function fetchTreasury({ startDate, endDate }) {
    const params = new URLSearchParams({
        filter: `auction_date:gte:${startDate},auction_date:lte:${endDate}`,
        sort: 'auction_date',
        'page[size]': '200',
    });
    const { data = [] } = JSON.parse(await fetchText(`${API}?${params}`));
    const seen = new Set();
    const rows = [];
    for (const a of data) {
        // The feed republishes each auction daily under a new record_date; keep one.
        const key = `${a.cusip}-${a.auction_date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const amount = Number(a.offering_amt);
        rows.push({
            agency: 'Treasury',
            title: `${a.security_term} ${a.security_type} Auction${a.reopening === 'Yes' ? ' (reopening)' : ''}`,
            date: a.auction_date,
            // The feed has no auction time. Bills usually close at 11:30 AM ET and
            // notes/bonds at 1:00 PM ET, but that's a convention, not a published time.
            timeEt: null,
            timestampUtc: null,
            period: null,
            url: 'https://www.treasurydirect.gov/auctions/upcoming/',
            notes: [
                `CUSIP ${a.cusip}`,
                `announced ${a.announcemt_date}`,
                `issues ${a.issue_date}`,
                Number.isFinite(amount) && amount > 0 ? `offering $${(amount / 1e9).toFixed(1)}B` : null,
            ].filter(Boolean).join('; '),
            securityType: a.security_type,
        });
    }
    return rows;
}

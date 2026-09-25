import { Actor, log } from 'apify';
import { fetchBea, fetchBls } from './sources/ics.js';
import { fetchCensus } from './sources/census.js';
import { fetchFed } from './sources/fed.js';
import { fetchTreasury } from './sources/treasury.js';
import { classify } from './classify.js';
import { addDays, todayEt } from './util.js';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const {
    range = 'next_7_days',
    startDate: customStart,
    endDate: customEnd,
    sources = ['bls', 'bea', 'census', 'fed', 'treasury'],
    impactLevels = ['high', 'medium', 'low'],
    keyword,
    maxResults = 500,
} = input;

/** Must match the event name configured in this Actor's pay-per-event pricing on Apify. */
const CALENDAR_QUERY_EVENT = 'calendar-query';

const AGENCY_NAMES = {
    BLS: 'Bureau of Labor Statistics',
    BEA: 'Bureau of Economic Analysis',
    Census: 'U.S. Census Bureau',
    Fed: 'Federal Reserve (FOMC)',
    Treasury: 'U.S. Department of the Treasury',
};

function resolveRange() {
    const today = todayEt();
    const [y, m, d] = today.split('-').map(Number);
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
    const monday = addDays(today, -((weekday + 6) % 7));
    const monthStart = (offset) => new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
    const monthEnd = (offset) => new Date(Date.UTC(y, m + offset, 0)).toISOString().slice(0, 10);
    switch (range) {
        case 'today': return [today, today];
        case 'tomorrow': return [addDays(today, 1), addDays(today, 1)];
        case 'this_week': return [monday, addDays(monday, 6)];
        case 'next_week': return [addDays(monday, 7), addDays(monday, 13)];
        case 'this_month': return [monthStart(0), monthEnd(0)];
        case 'next_month': return [monthStart(1), monthEnd(1)];
        case 'next_30_days': return [today, addDays(today, 29)];
        case 'custom': {
            const iso = /^\d{4}-\d{2}-\d{2}$/;
            if (!iso.test(customStart ?? '') || !iso.test(customEnd ?? '')) {
                throw new Error('For range "custom", set startDate and endDate as YYYY-MM-DD.');
            }
            if (customEnd < customStart) throw new Error('endDate must be on or after startDate.');
            return [customStart, customEnd];
        }
        case 'next_7_days':
        default:
            return [today, addDays(today, 6)];
    }
}

const [startDate, endDate] = resolveRange();
log.info(`Economic calendar ${startDate} to ${endDate} (US Eastern dates)`, { sources, impactLevels });

const FETCHERS = {
    bls: fetchBls,
    bea: fetchBea,
    census: fetchCensus,
    fed: fetchFed,
    treasury: () => fetchTreasury({ startDate, endDate }),
};
const wanted = (sources?.length ? sources : Object.keys(FETCHERS)).map((s) => String(s).toLowerCase()).filter((s) => FETCHERS[s]);

// One agency being down shouldn't sink the whole calendar.
const settled = await Promise.allSettled(wanted.map((s) => FETCHERS[s]()));
const failedSources = [];
const collected = [];
settled.forEach((result, i) => {
    if (result.status === 'fulfilled') collected.push(...result.value);
    else {
        failedSources.push(wanted[i]);
        log.warning(`Source "${wanted[i]}" failed; continuing with the others`, { error: result.reason?.message });
    }
});
if (failedSources.length === wanted.length) {
    throw new Error(`Every selected source failed (${failedSources.join(', ')}). Try again in a few minutes.`);
}

const impacts = new Set((impactLevels?.length ? impactLevels : ['high', 'medium', 'low']).map((s) => s.toLowerCase()));
const needle = keyword?.trim().toLowerCase();
const normTitle = (t) => t.split(',')[0].toLowerCase().replace(/[^a-z]/g, '').slice(0, 40);
const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

// BEA and Census both list joint releases (e.g. the trade report); keep one row.
const byKey = new Map();
for (const raw of collected) {
    if (raw.date < startDate || raw.date > endDate) continue;
    const { impact, category, url } = classify(raw);
    if (!impacts.has(impact)) continue;
    if (needle && !`${raw.title} ${raw.period ?? ''}`.toLowerCase().includes(needle)) continue;
    const key = `${raw.date}|${raw.timeEt}|${normTitle(raw.title)}`;
    const existing = byKey.get(key);
    if (existing) {
        if (!existing.alsoPublishedBy.includes(raw.agency)) existing.alsoPublishedBy.push(raw.agency);
        continue;
    }
    byKey.set(key, {
        eventId: `${raw.date}-${raw.agency.toLowerCase()}-${slug(raw.title)}`,
        date: raw.date,
        timeEt: raw.timeEt,
        timestampUtc: raw.timestampUtc,
        isAllDay: !raw.timeEt,
        agency: raw.agency,
        agencyName: AGENCY_NAMES[raw.agency],
        title: raw.title,
        period: raw.period ?? null,
        impact,
        category,
        url,
        notes: raw.notes ?? null,
        alsoPublishedBy: [],
    });
}

const rows = [...byKey.values()]
    .sort((a, b) => `${a.date} ${a.timeEt ?? '99:99'}`.localeCompare(`${b.date} ${b.timeEt ?? '99:99'}`))
    .slice(0, Math.max(1, Math.min(maxResults, 5000)));

const fetchedAt = new Date().toISOString();
await Actor.pushData(rows.map((r) => ({ ...r, fetchedAt })));
log.info(`Pushed ${rows.length} release(s)`, {
    high: rows.filter((r) => r.impact === 'high').length,
    failedSources,
});

// One charge per run, however many rows it returns.
if (rows.length > 0) await Actor.charge({ eventName: CALENDAR_QUERY_EVENT });

await Actor.exit();

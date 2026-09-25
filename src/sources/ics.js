// BLS and BEA both publish their release schedules as iCalendar feeds.
import { etToUtcIso, fetchText, parseIcs, utcToEt } from '../util.js';

const PERIOD_RE = /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}|(?:1st|2nd|3rd|4th|First|Second|Third|Fourth) Quarter(?: and Year)? \d{4}/i;

function toRow(event, agency) {
    const summary = (event.SUMMARY ?? '').trim();
    const raw = event.DTSTART ?? '';
    const params = event.DTSTART_PARAMS ?? '';
    let date;
    let timeEt = null;
    let timestampUtc = null;

    const m = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
    if (!m) return null;
    const [, y, mo, d, hh, mm, , z] = m;
    if (hh === undefined) {
        date = `${y}-${mo}-${d}`; // all-day entry
    } else if (z) {
        const utc = Date.UTC(+y, +mo - 1, +d, +hh, +mm);
        ({ date, time: timeEt } = utcToEt(utc));
        timestampUtc = new Date(utc).toISOString();
    } else {
        // Floating or TZID=US-Eastern local time; both agencies publish in Eastern.
        if (params && !/Eastern|New_York/i.test(params)) return null;
        date = `${y}-${mo}-${d}`;
        timeEt = `${hh}:${mm}`;
        timestampUtc = etToUtcIso(date, timeEt);
    }

    // BEA puts the reference period in the title ("..., 3rd Quarter 2025 (Advance Estimate)").
    const period = summary.match(PERIOD_RE)?.[0] ?? null;
    return { agency, title: summary, date, timeEt, timestampUtc, period, sourceUid: event.UID ?? null };
}

export async function fetchBls() {
    const text = await fetchText('https://www.bls.gov/schedule/news_release/bls.ics');
    return parseIcs(text).map((e) => toRow(e, 'BLS')).filter(Boolean);
}

export async function fetchBea() {
    const text = await fetchText('https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics');
    return parseIcs(text).map((e) => toRow(e, 'BEA')).filter(Boolean);
}

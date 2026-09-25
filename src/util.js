// Shared helpers: polite HTTP, iCalendar parsing, and US Eastern <-> UTC conversion.

// Agencies block anonymous clients; an honest, identifying User-Agent is what
// their access guidance asks for. This is identification, not disguise.
export const USER_AGENT = 'us-economic-calendar/0.1 (+https://apify.com/m_ctim/us-economic-calendar)';
const ET_ZONE = 'America/New_York';

export async function fetchText(url, { timeoutMs = 20000, attempts = 4 } = {}) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: '*/*' }, signal: controller.signal });
            if (res.ok) return await res.text();
            lastError = new Error(`${url} returned HTTP ${res.status}`);
            // 4xx other than rate limiting won't fix itself on retry.
            if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
        } catch (err) {
            lastError = err.name === 'AbortError' ? new Error(`${url} timed out after ${timeoutMs}ms`) : err;
        } finally {
            clearTimeout(timer);
        }
        if (attempt < attempts) await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
    }
    throw lastError;
}

/** Parses VEVENT blocks from an .ics file into { SUMMARY, DTSTART, DTSTART_PARAMS, ... } objects. */
export function parseIcs(text) {
    // RFC 5545 line folding: a line starting with a space or tab continues the previous one.
    const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
    const events = [];
    let current = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') current = {};
        else if (line === 'END:VEVENT') {
            if (current) events.push(current);
            current = null;
        } else if (current) {
            const colon = line.indexOf(':');
            if (colon < 0) continue;
            const [name, ...params] = line.slice(0, colon).split(';');
            const value = line.slice(colon + 1).replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
            current[name] = value;
            if (params.length) current[`${name}_PARAMS`] = params.join(';');
        }
    }
    return events;
}

/** Offset of US Eastern from UTC, in minutes, at a given instant (handles DST). */
function etOffsetMinutes(utcMillis) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: ET_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value])
    );
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return Math.round((asUtc - utcMillis) / 60000);
}

/** Converts an Eastern wall-clock time to a UTC ISO string. */
export function etToUtcIso(dateStr, timeStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [hh, mm] = timeStr.split(':').map(Number);
    const naive = Date.UTC(y, m - 1, d, hh, mm);
    // Two passes settle the offset correctly on DST transition days.
    let utc = naive - etOffsetMinutes(naive) * 60000;
    utc = naive - etOffsetMinutes(utc) * 60000;
    return new Date(utc).toISOString();
}

/** Converts a UTC instant to Eastern { date: 'YYYY-MM-DD', time: 'HH:MM' }. */
export function utcToEt(utcMillis) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone: ET_ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
        }).formatToParts(new Date(utcMillis)).map((p) => [p.type, p.value])
    );
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Today's date in US Eastern time, as 'YYYY-MM-DD'. */
export function todayEt() {
    return utcToEt(Date.now()).date;
}

export function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function monthIndex(name) {
    const i = MONTHS.findIndex((m) => m.toLowerCase().startsWith(name.toLowerCase().slice(0, 3)));
    return i < 0 ? null : i + 1;
}

export const pad2 = (n) => String(n).padStart(2, '0');

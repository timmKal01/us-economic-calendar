// Census Bureau economic indicators calendar (retail sales, housing starts, durable goods, ...).
import * as cheerio from 'cheerio';
import { etToUtcIso, fetchText } from '../util.js';

const PAGE = 'https://www.census.gov/economic-indicators/calendar-listview.html';

export async function fetchCensus() {
    const $ = cheerio.load(await fetchText(PAGE));
    const rows = [];
    $('#calendar tr').each((_, tr) => {
        const cells = $(tr).find('td');
        const link = $(cells[0]).find('a');
        // sorttable_customkey holds the release moment as YYYYMMDDHHMM in Eastern time.
        const key = $(cells[1]).attr('sorttable_customkey') ?? '';
        const m = key.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
        if (!link.length || !m) return;
        const [, y, mo, d, hh, mm] = m;
        const date = `${y}-${mo}-${d}`;
        const timeEt = `${hh}:${mm}`;
        const href = link.attr('href') ?? '';
        rows.push({
            agency: 'Census',
            title: link.text().replace(/\s+/g, ' ').trim(),
            date,
            timeEt,
            timestampUtc: etToUtcIso(date, timeEt),
            period: $(cells[3]).text().replace(/\s+/g, ' ').trim() || null,
            url: href ? new URL(href, 'https://www.census.gov').href : PAGE,
        });
    });
    return rows;
}

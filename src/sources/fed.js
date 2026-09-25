// Federal Reserve FOMC meeting calendar. The rate decision (statement) is released
// at 2:00 PM Eastern on the last day of each scheduled meeting.
import * as cheerio from 'cheerio';
import { etToUtcIso, fetchText, monthIndex, pad2 } from '../util.js';

const PAGE = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const STATEMENT_TIME_ET = '14:00';

export async function fetchFed() {
    const $ = cheerio.load(await fetchText(PAGE));
    const rows = [];
    $('.panel').each((_, panel) => {
        const year = Number($(panel).find('.panel-heading').text().match(/(\d{4}) FOMC Meetings/)?.[1]);
        if (!year) return;
        $(panel).find('.fomc-meeting').each((__, meeting) => {
            const monthText = $(meeting).find('.fomc-meeting__month').text().trim(); // "March" or "Apr/May"
            const dateText = $(meeting).find('.fomc-meeting__date').text().trim(); // "17-18*", "30-1", "22 (notation vote)"
            // Notation votes and unscheduled calls have no 2:00 PM decision to schedule around.
            if (!monthText || /notation|unscheduled|conference call/i.test(dateText)) return;
            const days = dateText.match(/\d+/g);
            if (!days) return;
            const lastDay = Number(days[days.length - 1]);
            const months = monthText.split('/');
            const month = monthIndex(months[months.length - 1]);
            if (!month) return;
            const hasProjections = dateText.includes('*');
            const date = `${year}-${pad2(month)}-${pad2(lastDay)}`;
            const statementHref = $(meeting).find('a[href*="pressreleases/monetary"][href$="a.htm"]').attr('href');
            rows.push({
                agency: 'Fed',
                title: hasProjections
                    ? 'FOMC Rate Decision + Summary of Economic Projections'
                    : 'FOMC Rate Decision',
                date,
                timeEt: STATEMENT_TIME_ET,
                timestampUtc: etToUtcIso(date, STATEMENT_TIME_ET),
                period: `${monthText} ${dateText.replace('*', '').trim()}, ${year} meeting`,
                url: statementHref ? new URL(statementHref, PAGE).href : PAGE,
                notes: hasProjections
                    ? 'Statement 2:00 PM ET; Summary of Economic Projections (dot plot) released with it; press conference 2:30 PM ET.'
                    : 'Statement 2:00 PM ET; press conference 2:30 PM ET.',
            });
        });
    });
    return rows;
}

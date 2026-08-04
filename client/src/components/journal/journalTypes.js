export const JOURNAL_ENTRY_TYPES = [
  { value: 'note', label: 'Note', variant: 'neutral' },
  { value: 'trade_review', label: 'Trade Review', variant: 'action' },
  { value: 'daily_review', label: 'Daily Review', variant: 'information' },
  { value: 'weekly_review', label: 'Weekly Review', variant: 'comparison' },
];

export function journalType(type) {
  return JOURNAL_ENTRY_TYPES.find((item) => item.value === type)
    ?? { value: type, label: 'Journal Entry', variant: 'neutral' };
}

export function normalizeJournalTags(value) {
  const tags = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  return tags.reduce((result, item) => {
    const tag = String(item).trim();
    const key = tag.toLocaleLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
    return result;
  }, []);
}

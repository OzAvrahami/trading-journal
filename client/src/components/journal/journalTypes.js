import i18n from '../../i18n/index.js';

export const JOURNAL_ENTRY_TYPES = [
  { value: 'note', get label() { return i18n.t('status.note'); }, variant: 'neutral' },
  { value: 'trade_review', get label() { return i18n.t('status.trade_review'); }, variant: 'action' },
  { value: 'daily_review', get label() { return i18n.t('status.daily_review'); }, variant: 'information' },
  { value: 'weekly_review', get label() { return i18n.t('status.weekly_review'); }, variant: 'comparison' },
];

export function journalType(type) {
  return JOURNAL_ENTRY_TYPES.find((item) => item.value === type)
    ?? { value: type, label: i18n.t('journal.journalEntry'), variant: 'neutral' };
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

import i18n from '../../i18n/index.js';

export const RULE_SCOPES = [
  { value: 'trade', get label() { return i18n.t('status.trade'); } },
  { value: 'daily', get label() { return i18n.t('status.daily'); } },
  { value: 'general', get label() { return i18n.t('status.general'); } },
];

export const RULE_OUTCOMES = [
  { value: 'followed', get label() { return i18n.t('status.followed'); }, variant: 'positive' },
  { value: 'broken', get label() { return i18n.t('status.broken'); }, variant: 'negative' },
  { value: 'not_applicable', get label() { return i18n.t('status.not_applicable'); }, variant: 'neutral' },
];

export const scopeLabel = (scope) => RULE_SCOPES.find((item) => item.value === scope)?.label ?? scope;
export const outcomeMeta = (outcome) => RULE_OUTCOMES.find((item) => item.value === outcome) ?? RULE_OUTCOMES[2];

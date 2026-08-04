export const RULE_SCOPES = [
  { value: 'trade', label: 'Trade' },
  { value: 'daily', label: 'Daily' },
  { value: 'general', label: 'General' },
];

export const RULE_OUTCOMES = [
  { value: 'followed', label: 'Followed', variant: 'positive' },
  { value: 'broken', label: 'Broken', variant: 'negative' },
  { value: 'not_applicable', label: 'Not applicable', variant: 'neutral' },
];

export const scopeLabel = (scope) => RULE_SCOPES.find((item) => item.value === scope)?.label ?? scope;
export const outcomeMeta = (outcome) => RULE_OUTCOMES.find((item) => item.value === outcome) ?? RULE_OUTCOMES[2];

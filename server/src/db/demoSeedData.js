import { createHash } from 'node:crypto';
import { computeFields } from '../services/tradeService.js';
import { METRIC_CONFIG, validateGoalDefinition } from '../services/goalsService.js';
import {
  addDaysToDateKey,
  assertTimezone,
  dateKeyInTimezone,
  isValidDateKey,
} from '../utils/dateTime.js';

export const DEMO_ACCOUNT_TYPES = Object.freeze(['funded', 'evaluation', 'demo', 'live']);
export const DEMO_ACCOUNT_STATUSES = Object.freeze(['active', 'inactive', 'archived']);
export const DEMO_LOCALES = Object.freeze(['en', 'he']);

export const DEMO_DAILY_NET_PNL = Object.freeze([
  -420, 610, 1240, -180, 0, 880, -1310, 2140, 460, -640, 1520,
  -260, 980, -1840, 720, 1360, -520, 240, 1980, -1120, 640, 1006,
]);

const TRADING_DATE_OFFSETS = Object.freeze([
  -35, -28, -25, -24, -23, -22, -21, -18, -17, -16, -15,
  -14, -11, -10, -9, -8, -7, -4, -3, -2, -1, 0,
]);

const ACCOUNT_DEFINITIONS = Object.freeze([
  { company: 'fidelity', accountNumber: 'DEMO-FID-4192', accountName: 'Fidelity Individual', accountType: 'live', status: 'active' },
  { company: 'fidelity', accountNumber: 'DEMO-ROTH-7730', accountName: 'Roth IRA', accountType: 'live', status: 'active' },
  { company: 'interactive brokers', accountNumber: 'DEMO-IBEU-2201', accountName: 'IBKR Europe', accountType: 'live', status: 'active' },
  { company: 'interactive brokers', accountNumber: 'DEMO-IBTR-2288', accountName: 'IBKR Trading', accountType: 'live', status: 'active' },
  { company: 'tradovate', accountNumber: 'DEMO-TRAD-8814', accountName: 'Tradovate Live', accountType: 'live', status: 'active' },
  { company: 'topstep', accountNumber: 'DEMO-TS-150F', accountName: 'Topstep 150K Funded', accountType: 'funded', status: 'active' },
  { company: 'topstep', accountNumber: 'DEMO-TS-50E', accountName: 'Topstep Combine 50K', accountType: 'evaluation', status: 'inactive' },
  { company: 'ninjatrader', accountNumber: 'DEMO-NT-0001', accountName: 'NinjaTrader Demo', accountType: 'demo', status: 'archived' },
]);

const SYMBOLS = Object.freeze(['MNQ', 'NQ', 'ES', 'MES', 'AAPL', 'NVDA', 'TSLA']);
const STRATEGIES = Object.freeze([
  'Opening Range Breakout', 'VWAP Reclaim', 'Trend Continuation',
  'Mean Reversion', 'Support Resistance', 'Momentum',
]);
const SETUPS = Object.freeze(['Breakout', 'Pullback', 'Reversal', 'Range Fade', 'Continuation']);
const TIMEFRAMES = Object.freeze(['1m', '5m', '15m', '30m', '1h']);
const MANAGED_STRATEGY_DEFINITIONS = Object.freeze([
  ['Opening Range Breakout', 'Trades the opening range only after confirmation.'],
  ['Mean Reversion', 'Looks for controlled returns toward a defined mean.'],
  ['Trend Continuation', 'Joins established directional structure after a pullback.'],
  ['Breakout Retest', 'Requires a breakout followed by a successful level retest.'],
  ['VWAP Trading', 'Uses VWAP location and reclaim behavior as context.'],
]);
const MANAGED_SETUP_DEFINITIONS = Object.freeze([
  ['Confirmed breakout', 'Breakout supported by structure and confirmation.'],
  ['Level retest', 'The broken level holds on a controlled retest.'],
  ['Failed breakout', 'A breakout failure returns through the prior range.'],
  ['VWAP reclaim', 'Price reclaims VWAP and confirms above it.'],
  ['Higher low', 'A higher low forms within an established uptrend.'],
  ['Lower high', 'A lower high forms within an established downtrend.'],
  ['Opening drive', 'Early directional drive with controlled risk.'],
  ['Range fade', 'Fades a tested range boundary after rejection.'],
  ['Pullback continuation', 'A pullback resolves with the prevailing trend.'],
  ['Momentum hold', 'Momentum consolidates without losing its invalidation.'],
]);

const HEBREW_TEXT = Object.freeze({
  importFilenames: ['עסקאות-יולי.csv', 'בדיקת-אוגוסט.csv', 'קובץ-לא-תקין.csv'],
  managedStrategies: ['פריצת טווח פתיחה', 'חזרה לממוצע', 'המשך מגמה', 'פריצה וחזרה לרמה', 'מסחר סביב VWAP'],
  managedSetups: ['פריצה עם אישור', 'בדיקה חוזרת של הרמה', 'כשל פריצה', 'חזרה ל־VWAP', 'שפל גבוה במגמה עולה', 'שיא נמוך במגמה יורדת', 'מהלך פתיחה', 'דעיכת טווח', 'המשך לאחר פולבק', 'שמירת מומנטום'],
  accountNames: ['חשבון מסחר אישי', 'חשבון רוט IRA', 'חשבון אירופה', 'חשבון מסחר IBKR', 'חשבון מסחר חי', 'חשבון ממומן 150K', 'חשבון הערכה 50K', 'חשבון תרגול'],
  strategies: ['פריצת טווח הפתיחה', 'חזרה ל־VWAP', 'המשך מגמה', 'חזרה לממוצע', 'תמיכה והתנגדות', 'מומנטום'],
  setups: ['פריצה', 'פולבק', 'היפוך', 'דעיכת טווח', 'המשך'],
  tradeNotes: [
    'המתנתי לחזרה לרמה לפני הכניסה ולא רדפתי אחרי המחיר.',
    'הכניסה הייתה מוקדמת מדי וללא אישור מלא של הסטאפ.',
    'ניהלתי את העסקה לפי התוכנית והשארתי את הסטופ במקום.',
    'סגרתי מוקדם מתוך לחץ למרות שהתרחיש עדיין היה תקף.',
    'העסקה נפתחה לאחר פריצה ואישור מחזור.',
    'המתנתי לאישור ושמרתי על סכום הסיכון המתוכנן.',
  ],
  openTradeNote: 'עסקת דמו פתוחה ללא תוצאה לא ממומשת מומצאת.',
  emotions: [
    { pre: 'ממוקד', during: 'סבלני', post: 'רגוע' },
    { pre: 'רגוע', during: 'בטוח', post: 'ממוקד' },
    { pre: 'לחוץ', during: 'סבלני', post: 'מתוסכל' },
    { pre: 'ממוקד', during: 'רגוע', post: 'בטוח' },
  ],
  journal: [
    ['היום: ביצוע סבלני', 'פעלתי לפי תוכנית הבוקר, תיעדתי כל עסקה ועצרתי אחרי הסטאפ האחרון שתוכנן.', ['משמעת', 'סיכום-יומי']],
    ['סקירת עסקה: אישור לפני הכניסה', 'הכניסה בוצעה לאחר אישור והיציאה כיבדה את רמת הביטול שתוכננה.', ['ביצוע', 'אישור']],
    ['סיכום יומי: כניסה חוזרת מיותרת', 'שני הסטאפים הראשונים היו תקינים. הכניסה האחרונה הייתה מהירה מדי ותועדה לקראת הסשן הבא.', ['כללים', 'סבלנות']],
    ['רשימת מיקוד לפני המסחר', 'לבצע רק סטאפים מתועדים ולהקטין גודל כאשר טווח הפתיחה אינו ברור.', ['תכנון', 'סיכון']],
    ['סקירה: חזרה ל־VWAP', 'ההמתנה לבדיקה החוזרת שיפרה את הכניסה ושמרה על סיכון מוגדר מראש.', ['VWAP', 'סקירה']],
    ['סיכום שבועי: יתרון בשעה הראשונה', 'התוצאות הטובות ביותר הגיעו מסטאפים מתועדים בשעה הראשונה. כניסות מאוחרות עדיין מהוות סיכון תהליכי.', ['סיכום-שבועי', 'תזמון']],
    ['סיכום יומי: שמירה על מגבלת ההפסד', 'פתיחה קשה נשארה בשליטה בזכות כיבוד מגבלת ההפסד היומית.', ['סיכון', 'סיכום-יומי']],
    ['סקירה: הפסד בדעיכת טווח', 'לעסקה חסר אישור. ההפסד נשמר מוגבל והסטאפ סומן לבחירה מחמירה יותר.', ['טווח', 'טעות']],
    ['סיכום שבועי: עקביות בגודל', 'הסיכון נשאר עקבי בין החשבונות ואף סטופ לא הורחק.', ['סיכום-שבועי', 'גודל']],
    ['סיכום יומי: יום תהליך חזק', 'נלקחו רק סטאפים מתועדים והסשן הסתיים לאחר מספר העסקאות שתוכנן.', ['תהליך', 'משמעת']],
    ['תזכורת לכלל ניהול רווח', 'לעסקה מתמשכת צריך יעד מבני לפני הכניסה; אחרת היציאה המתוכננת נשארת סופית.', ['כללים', 'יציאות']],
    ['סקירה: המשך מומנטום', 'כניסת ההמשך הייתה בכיוון המגמה והסטופ נשאר ברמת הביטול המקורית.', ['מומנטום', 'סקירה']],
    ['סיכום שבועי: צמצום סטאפים גבוליים', 'ניסיונות חזרה לממוצע הניבו פחות. בשבוע הבא אתמקד בטווח הפתיחה ובהמשך מגמה.', ['סיכום-שבועי', 'סטאפים']],
    ['הערות פתיחה לנתוני הדמו', 'הרשומה מעגנת היסטוריית סקירות דטרמיניסטית ללא מושגי פורטפוליו שאינם נתמכים.', ['דמו', 'יומן']],
  ],
  dailyDetails: [
    ['המתנתי לאישור ושמרתי על הסיכון המתוכנן.', 'להימנע מבדיקת התוצאות בין סטאפים.', 'לבצע רק סטאפים מתועדים ולעצור לאחר הכמות שתוכננה.', ['ממוקד', 'סבלני'], []],
    ['שני הסטאפים הראשונים תאמו לתוכנית.', 'לעצור לאחר עסקה מפסידה לפני ששוקלים כניסה חוזרת.', 'לבצע איפוס של חמש דקות לפני כל כניסה חוזרת.', ['ממוקד', 'מתוסכל'], ['רדיפה אחרי כניסה']],
    ['מגבלת ההפסד היומית שמרה על איכות ההחלטות.', 'להקטין גודל מוקדם יותר כשהתנאים אינם ברורים.', 'להתחיל בחצי גודל עד שהמבנה מתבהר.', ['רגוע', 'לחוץ'], ['סיכון גדול מדי']],
    ['הכניסות, הסטופים והיציאות נשארו שיטתיים.', null, 'לחזור על אותה הכנה ורשימת בדיקה לביצוע.', ['רגוע', 'בטוח'], []],
  ],
  rules: [
    ['לא להיכנס ללא סטופ מוגדר', 'סכום הסיכון, הסטופ ורמת הביטול חייבים להיות ברורים לפני הכניסה.'],
    ['לעולם לא להרחיק את הסטופ', 'אפשר להדק סטופ אך לא להגדיל את הסיכון המקורי.'],
    ['להפסיק לאחר הגעה למגבלת ההפסד היומית', 'לסיים את הסשן כאשר מגיעים למגבלת ההפסד המתועדת.'],
    ['לבצע רק סטאפים מתועדים', 'לכל עסקה חייבים להיות אסטרטגיה וסטאפ בשמות ברורים.'],
    ['להמתין לאישור הסטאפ', 'לא לצפות את האות לפני שהאישור קיים.'],
    ['לתעד כל סשן שהושלם', 'ליצור סיכום יומי לאחר כל סשן מסחר שהושלם.'],
    ['לכבד את מספר העסקאות המרבי ליום', 'לא לעבור את מספר העסקאות היומי שתוכנן.'],
    ['לסקור הפרות כללים לפני הסשן הבא', 'יש לסקור בדיקות שהופרו לפני הסשן הבא.'],
  ],
  checkNotes: { broken: 'חריגת דמו מתועדת לסקירה.', followed: 'התוכנית בוצעה.', not_applicable: 'הכלל לא היה רלוונטי להקשר הזה.', noPrior: 'לא הייתה הפרה קודמת שדרשה סקירה.' },
  goals: [
    ['להגיע לרווח והפסד נטו של 7,000 דולר', 'רווח והפסד נטו מעסקאות סגורות לאורך תקופת הדמו.'],
    ['להשלים 60 עסקאות סגורות', 'לבנות מדגם עקבי ללא הזנת התקדמות ידנית.'],
    ['לשמור על 60% הצלחה', 'מושהה בזמן בחינת בחירת הסטאפים.'],
    ['להגיע לממוצע של לפחות 0.30R', 'יעד תהליכי היסטורי שהועבר לארכיון.'],
    ['להגיע ל־85% עמידה בכללים במחזור הבא', 'יעד עתידי שאינו זמין עד שיהיו בדיקות רלוונטיות.'],
    ['להשלים שלושה סיכומים במחזור הקודם', 'יעד יומן היסטורי שלא הושג באופן מכוון.'],
    ['לשמור על חמש הפרות כללים לכל היותר', 'המספר המרבי של בדיקות שהופרו בתקופת הדמו.'],
  ],
});

export function normalizeDemoLocale(locale) {
  const normalized = locale == null ? 'en' : String(locale).trim();
  if (!DEMO_LOCALES.includes(normalized)) throw new RangeError('DEMO_LOCALE must be exactly en or he.');
  return normalized;
}

function localizeDatasetText(dataset, locale) {
  if (locale === 'en') return { ...dataset, locale };
  const managedStrategies = dataset.managedStrategies.map((row, index) => ({ ...row, name: HEBREW_TEXT.managedStrategies[index], description: `אסטרטגיה מנוהלת להדגמת ${HEBREW_TEXT.managedStrategies[index]}.` }));
  const managedSetups = dataset.managedSetups.map((row, index) => ({ ...row, name: HEBREW_TEXT.managedSetups[index], description: `סטאפ מנוהל: ${HEBREW_TEXT.managedSetups[index]}.` }));
  const strategyNames = new Map(managedStrategies.map((row) => [row.id, row.name]));
  const setupNames = new Map(managedSetups.map((row) => [row.id, row.name]));
  return {
    ...dataset,
    locale,
    accounts: dataset.accounts.map((row, index) => ({ ...row, accountName: HEBREW_TEXT.accountNames[index] })),
    managedStrategies,
    managedSetups,
    trades: dataset.trades.map((row, index) => ({
      ...row,
      strategy: row.strategyId ? strategyNames.get(row.strategyId) : HEBREW_TEXT.strategies[index % HEBREW_TEXT.strategies.length],
      setup: row.setupId ? setupNames.get(row.setupId) : HEBREW_TEXT.setups[index % HEBREW_TEXT.setups.length],
      notes: row.status === 'open' ? HEBREW_TEXT.openTradeNote : HEBREW_TEXT.tradeNotes[index % HEBREW_TEXT.tradeNotes.length],
      emotions: HEBREW_TEXT.emotions[index % HEBREW_TEXT.emotions.length],
    })),
    journalEntries: dataset.journalEntries.map((row, index) => ({ ...row, title: HEBREW_TEXT.journal[index][0], content: HEBREW_TEXT.journal[index][1], tags: HEBREW_TEXT.journal[index][2] })),
    dailyReviewDetails: dataset.dailyReviewDetails.map((row, index) => {
      const [wentWell, improve, nextSessionPlan, emotions, mistakes] = HEBREW_TEXT.dailyDetails[index];
      return { ...row, wentWell, improve, nextSessionPlan, emotions, mistakes };
    }),
    rules: dataset.rules.map((row, index) => ({ ...row, name: HEBREW_TEXT.rules[index][0], description: HEBREW_TEXT.rules[index][1] })),
    ruleChecks: dataset.ruleChecks.map((row) => ({ ...row, notes: row.notes === 'No prior break required review.' ? HEBREW_TEXT.checkNotes.noPrior : HEBREW_TEXT.checkNotes[row.outcome] })),
    goals: dataset.goals.map((row, index) => ({ ...row, name: HEBREW_TEXT.goals[index][0], description: HEBREW_TEXT.goals[index][1] })),
    importRuns: dataset.importRuns.map((row, index) => ({ ...row, originalFilename: HEBREW_TEXT.importFilenames[index] })),
  };
}

function stableUuid(namespace, userId, anchorDate, index) {
  const hex = createHash('sha256')
    .update(`${namespace}:${userId}:${anchorDate}:${index}`)
    .digest('hex')
    .slice(0, 32);
  const variant = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function buildImportHistory(userId, anchorDate, timezone, accounts, trades) {
  const definitions = [
    ['july-trades.csv', 'completed', 3, 3, 0, 0, -10],
    ['august-review.csv', 'completed_with_errors', 3, 1, 1, 1, -2],
    ['invalid-file.csv', 'failed', 2, 0, 0, 2, -1],
  ];
  const importRuns = definitions.map(([originalFilename, status, totalRows, importedRows, skippedRows, failedRows, offset], index) => {
    const startedAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, offset), '18:00:00', timezone).toISOString();
    const completedAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, offset), '18:00:08', timezone).toISOString();
    return {
      id: stableUuid('import-run', userId, anchorDate, index), userId, accountId: accounts[index].id,
      originalFilename, fileSizeBytes: 2048 + (index * 317),
      fileSha256: createHash('sha256').update(`demo-import:${userId}:${anchorDate}:${index}`).digest('hex'),
      sourceType: index === 1 ? 'tradovate' : 'topstepx', status, totalRows, importedRows, skippedRows, failedRows,
      mapping: { importer: index === 1 ? 'tradovate' : 'topstepx' },
      failureCode: status === 'failed' ? 'IMPORT_INVALID_FILE' : null,
      failureDetail: status === 'failed' ? 'The demo source file did not contain valid Trade rows.' : null,
      startedAt, completedAt, createdAt: startedAt, updatedAt: completedAt,
    };
  });
  const rowDefinitions = [
    [0, 2, 'imported', 0, null], [0, 3, 'imported', 1, null], [0, 4, 'imported', 2, null],
    [1, 2, 'imported', 3, null], [1, 3, 'skipped_duplicate', null, 'IMPORT_ROW_DUPLICATE'],
    [1, 4, 'failed_validation', null, 'IMPORT_ROW_VALIDATION_FAILED'],
    [2, 2, 'failed_validation', null, 'IMPORT_ROW_VALIDATION_FAILED'],
    [2, 3, 'failed_validation', null, 'IMPORT_ROW_VALIDATION_FAILED'],
  ];
  const importRunRows = rowDefinitions.map(([runIndex, rowNumber, status, tradeIndex, errorCode], index) => ({
    id: stableUuid('import-run-row', userId, anchorDate, index), importRunId: importRuns[runIndex].id, userId,
    rowNumber, status, tradeId: tradeIndex == null ? null : trades[tradeIndex].id,
    symbol: tradeIndex == null ? (index % 2 ? 'NQ' : 'MNQ') : trades[tradeIndex].symbol,
    sourceIdentifier: `DEMO-ROW-${runIndex + 1}-${rowNumber}`, errorCode,
    errorDetail: errorCode ? 'Bounded deterministic demo diagnostic.' : null,
    createdAt: importRuns[runIndex].completedAt,
  }));
  return { importRuns, importRunRows };
}

function zonedParts(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

export function localDateTimeToInstant(dateKey, time, timezone) {
  if (!isValidDateKey(dateKey) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    throw new RangeError('Expected a valid local YYYY-MM-DD and HH:mm:ss value.');
  }
  const zone = assertTimezone(timezone);
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hour, minute, second] = time.split(':').map(Number);
  if (hour > 23 || minute > 59 || second > 59) throw new RangeError('Expected a valid local time.');
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = zonedParts(new Date(candidate), zone);
    const represented = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    const adjustment = desired - represented;
    candidate += adjustment;
    if (adjustment === 0) return new Date(candidate);
  }
  const final = zonedParts(new Date(candidate), zone);
  if (`${final.year}-${final.month}-${final.day} ${final.hour}:${final.minute}:${final.second}` !== `${dateKey} ${time}`) {
    throw new RangeError(`Local date-time is not representable in ${zone}.`);
  }
  return new Date(candidate);
}

function timeForSlot(slot, baseMinutes = 9 * 60 + 35) {
  const total = baseMinutes + slot * 47;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00`;
}

function splitAmount(total, count) {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= remainder > 0 ? 1 : 0;
    return value / 100;
  });
}

function buildManagedClassifications(userId, anchorDate, timezone) {
  const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -45), '12:00:00', timezone).toISOString();
  const strategies = MANAGED_STRATEGY_DEFINITIONS.map(([name, description], index) => ({
    id: stableUuid('managed-strategy', userId, anchorDate, index), userId, name, description,
    isActive: index !== MANAGED_STRATEGY_DEFINITIONS.length - 1, createdAt, updatedAt: createdAt,
  }));
  const setups = MANAGED_SETUP_DEFINITIONS.map(([name, description], index) => ({
    id: stableUuid('managed-setup', userId, anchorDate, index), userId,
    strategyId: strategies[Math.floor(index / 2)].id, name, description,
    isActive: index !== MANAGED_SETUP_DEFINITIONS.length - 1, createdAt, updatedAt: createdAt,
  }));
  return { strategies, setups };
}

function buildTrade({ userId, anchorDate, timezone, accounts, date, pnlNet, index, slot, open = false }) {
  const symbol = SYMBOLS[index % SYMBOLS.length];
  const market = ['AAPL', 'NVDA', 'TSLA'].includes(symbol) ? 'stocks' : 'futures';
  const direction = index % 2 === 0 ? 'long' : 'short';
  const quantity = market === 'stocks' ? 50 : 2;
  const basePrices = { MNQ: 23200, NQ: 23100, ES: 5600, MES: 5580, AAPL: 220, NVDA: 185, TSLA: 300 };
  const entryPrice = Number((basePrices[symbol] + (index % 13) * (market === 'stocks' ? 0.35 : 3.25)).toFixed(8));
  const entry = localDateTimeToInstant(date, timeForSlot(slot, open ? 13 * 60 + 5 : 9 * 60 + 35), timezone);
  const riskAmount = 350 + (index % 5) * 75;
  const fee = open ? 0 : (index < 28 ? 7 : 6);
  const gross = open ? null : Number((pnlNet + fee).toFixed(4));
  const delta = open ? null : gross / quantity;
  const exitPrice = open ? null : Number((direction === 'long' ? entryPrice + delta : entryPrice - delta).toFixed(8));
  if (exitPrice != null && exitPrice <= 0) throw new Error(`Generated an invalid exit price for trade ${index}.`);
  const exit = open ? null : new Date(entry.getTime() + (18 + (index % 7) * 11) * 60000);
  const fields = {
    direction,
    entryPrice,
    exitPrice,
    quantity,
    fees: fee,
    riskAmount,
    entryDatetime: entry.toISOString(),
    exitDatetime: exit?.toISOString() ?? null,
  };
  const computed = computeFields(fields);
  if (!open && Math.abs(computed.pnlNet - pnlNet) > 0.0001) {
    throw new Error(`Production trade calculation drifted for generated trade ${index}.`);
  }
  const stopDistance = riskAmount / quantity;
  return {
    id: stableUuid('trade', userId, anchorDate, index),
    userId,
    accountId: accounts[index % accounts.length].id,
    symbol,
    market,
    direction,
    entryDatetime: fields.entryDatetime,
    exitDatetime: fields.exitDatetime,
    entryPrice,
    exitPrice,
    quantity,
    fees: fee,
    strategy: STRATEGIES[index % STRATEGIES.length],
    setup: SETUPS[index % SETUPS.length],
    timeframe: TIMEFRAMES[index % TIMEFRAMES.length],
    riskAmount,
    stopLoss: Number((direction === 'long' ? entryPrice - stopDistance : entryPrice + stopDistance).toFixed(8)),
    takeProfit: Number((direction === 'long' ? entryPrice + stopDistance * 2 : entryPrice - stopDistance * 2).toFixed(8)),
    notes: open ? 'Demo open trade with no fabricated unrealized result.' : 'Deterministic design-inspired demo trade.',
    emotions: { pre: 'focused', during: index % 4 === 0 ? 'patient' : 'calm', post: open ? '' : 'reflective' },
    screenshotLinks: [],
    dedupKey: null,
    ...computed,
    createdAt: fields.entryDatetime,
    updatedAt: fields.exitDatetime ?? fields.entryDatetime,
  };
}

function buildTrades(userId, anchorDate, timezone, accounts, tradingDates) {
  const closed = [];
  let tradeIndex = 0;
  let mixedIndex = 0;
  DEMO_DAILY_NET_PNL.forEach((dayNet, dayIndex) => {
    const positiveOnly = dayIndex === 1 || dayIndex === 2;
    const mixed = !positiveOnly;
    const internalOffset = mixed ? (mixedIndex++ === 0 ? 224 : 220) : 0;
    const positiveTotal = dayNet >= 0 ? dayNet + internalOffset : internalOffset;
    const negativeTotal = mixed ? (dayNet >= 0 ? internalOffset : Math.abs(dayNet) + internalOffset) : 0;
    const winnerCount = dayIndex < 9 ? 2 : 1;
    const outcomes = [
      ...splitAmount(positiveTotal, winnerCount),
      ...(mixed ? [-negativeTotal] : []),
      ...(dayNet === 0 ? [0, 0] : []),
    ];
    outcomes.forEach((pnlNet, slot) => {
      closed.push(buildTrade({
        userId, anchorDate, timezone, accounts,
        date: tradingDates[dayIndex], pnlNet, index: tradeIndex, slot,
      }));
      tradeIndex += 1;
    });
  });

  const openOffsets = [0, -1, -7, -35];
  const open = openOffsets.map((offset, index) => buildTrade({
    userId, anchorDate, timezone, accounts,
    date: addDaysToDateKey(anchorDate, offset), pnlNet: null,
    index: tradeIndex + index, slot: index, open: true,
  }));
  return [...closed, ...open];
}

function buildJournal(userId, anchorDate, timezone, trades) {
  const definitions = [
    [-0, 'daily_review', 'Today: patient execution', 'I followed the morning plan, recorded every trade, and stopped after the final planned setup.', ['discipline', 'daily-review'], true],
    [-1, 'trade_review', 'Review: confirmation before entry', 'The entry followed confirmation and the exit respected the planned invalidation level.', ['execution', 'confirmation'], true],
    [-2, 'daily_review', 'Daily review: one avoidable re-entry', 'The first two setups were valid. The final re-entry was rushed and is documented for the next session.', ['rules', 'patience'], true],
    [-3, 'note', 'Pre-market focus list', 'Trade documented setups only and reduce size when the opening range is unclear.', ['plan', 'risk'], false],
    [-4, 'trade_review', 'Review: VWAP reclaim', 'Waiting for the retest improved the entry and kept risk defined before execution.', ['VWAP', 'review'], true],
    [-7, 'weekly_review', 'Weekly review: first-hour edge', 'The strongest results came from documented setups during the first hour. Late entries remain the main process risk.', ['weekly-review', 'timing'], true],
    [-8, 'daily_review', 'Daily review: protected the loss limit', 'A difficult start remained controlled because the daily loss limit was respected.', ['risk', 'daily-review'], true],
    [-10, 'trade_review', 'Review: range fade loss', 'The trade lacked confirmation. The loss was contained, and the setup is flagged for stricter selection.', ['range-fade', 'mistake'], false],
    [-14, 'weekly_review', 'Weekly review: sizing consistency', 'Risk stayed consistent across accounts and no stop was moved farther away.', ['weekly-review', 'sizing'], true],
    [-18, 'daily_review', 'Daily review: strong process day', 'Only documented setups were taken and the session ended after the planned trade count.', ['process', 'discipline'], true],
    [-21, 'note', 'Rule reminder for runners', 'A runner needs a structural target before entry; otherwise the planned exit remains final.', ['rules', 'exits'], false],
    [-24, 'trade_review', 'Review: momentum continuation', 'The continuation entry was aligned with trend and the stop stayed at the original invalidation.', ['momentum', 'review'], true],
    [-28, 'weekly_review', 'Weekly review: reduce marginal setups', 'Mean-reversion attempts underperformed. Next week prioritizes opening range and trend continuation.', ['weekly-review', 'setups'], true],
    [-35, 'note', 'Demo dataset starting notes', 'This entry anchors the deterministic review history without adding unsupported portfolio concepts.', ['demo', 'journal'], false],
  ];
  const entries = definitions.map(([offset, entryType, title, content, tags, isComplete], index) => {
    const entryDate = addDaysToDateKey(anchorDate, offset);
    const createdAt = localDateTimeToInstant(entryDate, '18:15:00', timezone).toISOString();
    return {
      id: stableUuid('journal', userId, anchorDate, index), userId, entryType, entryDate,
      title, content, tags, isComplete, createdAt, updatedAt: createdAt,
    };
  });
  const closedTrades = trades.filter((trade) => trade.status === 'closed');
  const links = entries.flatMap((entry, entryIndex) => {
    const linkCount = entry.entryType === 'weekly_review' ? 3 : entry.entryType === 'note' ? 0 : 2;
    return Array.from({ length: linkCount }, (_, linkIndex) => ({
      userId,
      journalEntryId: entry.id,
      tradeId: closedTrades[(entryIndex * 3 + linkIndex) % closedTrades.length].id,
      createdAt: entry.createdAt,
    }));
  });
  const detailTemplates = [
    ['Waited for confirmation and respected planned risk.', 'Avoid checking results between setups.', 'Trade documented setups and stop after the planned count.', ['Focused', 'Patient'], []],
    ['The first two setups matched the plan.', 'Pause after a stopped trade before considering re-entry.', 'Use a five-minute reset before any re-entry.', ['Focused', 'Frustrated'], ['Chased entry']],
    ['The daily loss limit protected decision quality.', 'Reduce size sooner when conditions are unclear.', 'Begin with half size until structure improves.', ['Calm', 'Anxious'], ['Oversized risk']],
    ['Entries, stops, and exits stayed mechanical.', null, 'Repeat the same preparation and execution checklist.', ['Calm', 'Confident'], []],
  ];
  const details = entries.filter((entry) => entry.entryType === 'daily_review').map((entry, index) => {
    const [wentWell, improve, nextSessionPlan, emotions, mistakes] = detailTemplates[index];
    return {
      journalEntryId: entry.id, userId, reviewDate: entry.entryDate,
      wentWell, improve, nextSessionPlan, emotions, mistakes,
      createdAt: entry.createdAt, updatedAt: entry.updatedAt,
    };
  });
  return { entries, links, details };
}

function buildRules(userId, anchorDate, timezone, trades, journalEntries, tradingDates) {
  const definitions = [
    ['Define risk before entry', 'Risk amount, stop and invalidation must be clear before entry.', 'trade', true],
    ['Never move the stop farther away', 'A stop may tighten but never increase the original risk.', 'trade', true],
    ['Stop trading after daily loss limit', 'End the session when the documented daily loss limit is reached.', 'daily', true],
    ['Trade only documented setups', 'Every trade must use a named strategy and setup.', 'trade', true],
    ['Wait for confirmation before entry', 'Do not anticipate a signal before confirmation is present.', 'trade', true],
    ['Record every completed session', 'Create a daily review after each completed trading session.', 'daily', true],
    ['Respect maximum trades per day', 'Do not exceed the planned maximum number of daily trades.', 'daily', false],
    ['Review rule breaks before next session', 'Broken checks must be reviewed before the next session.', 'general', true],
  ];
  const rules = definitions.map(([name, description, scope, isActive], index) => {
    const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -40), '12:00:00', timezone).toISOString();
    return {
      id: stableUuid('rule', userId, anchorDate, index), userId, name, description,
      scope, isActive, sortOrder: index, createdAt, updatedAt: createdAt,
    };
  });
  const closedTrades = trades.filter((trade) => trade.status === 'closed');
  const checks = [];
  rules.slice(0, 7).forEach((rule, ruleIndex) => {
    for (let checkIndex = 0; checkIndex < 6; checkIndex += 1) {
      const date = tradingDates[(ruleIndex * 3 + checkIndex) % tradingDates.length];
      const outcome = (ruleIndex + checkIndex) % 7 === 0
        ? 'not_applicable'
        : (ruleIndex * 2 + checkIndex) % 5 === 0 ? 'broken' : 'followed';
      checks.push({
        id: stableUuid('rule-check', userId, anchorDate, checks.length),
        userId,
        ruleId: rule.id,
        checkDate: date,
        outcome,
        notes: outcome === 'broken' ? 'Documented demo exception for review.' : outcome === 'followed' ? 'Plan followed.' : 'Rule did not apply to this context.',
        tradeId: checkIndex % 2 === 0 ? closedTrades[(ruleIndex * 5 + checkIndex) % closedTrades.length].id : null,
        journalEntryId: checkIndex % 3 === 0 ? journalEntries[(ruleIndex + checkIndex) % journalEntries.length].id : null,
        createdAt: localDateTimeToInstant(date, '17:30:00', timezone).toISOString(),
      });
    }
  });
  for (let index = 0; index < 2; index += 1) {
    const date = tradingDates[tradingDates.length - 1 - index];
    checks.push({
      id: stableUuid('rule-check', userId, anchorDate, checks.length), userId,
      ruleId: rules[7].id, checkDate: date, outcome: 'not_applicable',
      notes: 'No prior break required review.', tradeId: null,
      journalEntryId: journalEntries[index].id,
      createdAt: localDateTimeToInstant(date, '18:30:00', timezone).toISOString(),
    });
  }
  return { rules, checks };
}

function buildGoals(userId, anchorDate, timezone, tradingDates) {
  const fullStart = tradingDates[0];
  const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -36), '12:00:00', timezone).toISOString();
  const definitions = [
    ['Reach $7,000 net PnL', 'Closed-trade net PnL across the demo period.', 'net_pnl', 7000, fullStart, anchorDate, 'active'],
    ['Complete 60 closed trades', 'Build a consistent sample without manual progress.', 'closed_trades', 60, fullStart, addDaysToDateKey(anchorDate, 14), 'active'],
    ['Maintain a 60% win rate', 'Paused while setup selection is reviewed.', 'win_rate', 60, fullStart, anchorDate, 'paused'],
    ['Average at least 0.30R', 'Archived historical process target.', 'average_r', 0.3, fullStart, anchorDate, 'archived'],
    ['Reach 85% rule adherence next cycle', 'Upcoming and unavailable until eligible checks exist.', 'rule_adherence', 85, addDaysToDateKey(anchorDate, 7), addDaysToDateKey(anchorDate, 30), 'active'],
    ['Complete three reviews in prior cycle', 'A deliberately missed historical Journal target.', 'journal_entries', 3, addDaysToDateKey(anchorDate, -70), addDaysToDateKey(anchorDate, -60), 'active'],
    ['Keep broken checks at five or fewer', 'Maximum permitted broken checks in the demo period.', 'broken_rule_checks', 5, fullStart, anchorDate, 'active'],
  ];
  return definitions.map(([name, description, metricKey, targetValue, startDate, endDate, status], index) => ({
    id: stableUuid('goal', userId, anchorDate, index), userId, name, description, metricKey,
    comparison: METRIC_CONFIG[metricKey].comparison, targetValue, startDate, endDate,
    status, createdAt, updatedAt: createdAt,
  }));
}

export function summarizeDemoDataset(dataset) {
  const closed = dataset.trades.filter((trade) => trade.status === 'closed');
  const winners = closed.filter((trade) => trade.pnlNet > 0);
  const losers = closed.filter((trade) => trade.pnlNet < 0);
  const breakeven = closed.filter((trade) => trade.pnlNet === 0);
  const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
  const grossProfit = sum(winners, 'pnlNet');
  const grossLoss = Math.abs(sum(losers, 'pnlNet'));
  return {
    accounts: dataset.accounts.length,
    trades: dataset.trades.length,
    closed: closed.length,
    open: dataset.trades.length - closed.length,
    winners: winners.length,
    losers: losers.length,
    breakeven: breakeven.length,
    tradingDates: new Set(dataset.trades.map((trade) => dateKeyInTimezone(dataset.timezone, new Date(trade.entryDatetime)))).size,
    pnlNet: Number(sum(closed, 'pnlNet').toFixed(2)),
    totalFees: Number(sum(dataset.trades, 'fees').toFixed(2)),
    expectancy: Number((sum(closed, 'pnlNet') / closed.length).toFixed(2)),
    profitFactor: Number((grossProfit / grossLoss).toFixed(4)),
    journalEntries: dataset.journalEntries.length,
    journalLinks: dataset.journalEntryTrades.length,
    dailyReviewDetails: dataset.dailyReviewDetails.length,
    rules: dataset.rules.length,
    ruleChecks: dataset.ruleChecks.length,
    goals: dataset.goals.length,
    managedStrategies: dataset.managedStrategies.length,
    managedSetups: dataset.managedSetups.length,
    managedTrades: dataset.trades.filter((trade) => trade.strategyId != null).length,
    unlinkedTrades: dataset.trades.filter((trade) => trade.strategyId == null).length,
    importRuns: dataset.importRuns.length,
    importRunRows: dataset.importRunRows.length,
  };
}

export function validateDemoDataset(dataset) {
  const summary = summarizeDemoDataset(dataset);
  const expected = {
    accounts: 8, trades: 57, closed: 53, open: 4, winners: 31, losers: 20,
    breakeven: 2, tradingDates: 22, pnlNet: 7486, totalFees: 346,
    journalEntries: 14, dailyReviewDetails: 4, rules: 8, goals: 7,
    managedStrategies: 5, managedSetups: 10,
  };
  Object.entries(expected).forEach(([key, value]) => {
    if (summary[key] !== value) throw new Error(`Demo dataset ${key} expected ${value}, received ${summary[key]}.`);
  });
  if (Math.abs(summary.expectancy - 141.25) > 0.01 || Math.abs(summary.profitFactor - 1.699) > 0.001) {
    throw new Error('Demo headline calculations are inconsistent.');
  }
  const ownedCollections = [dataset.accounts, dataset.managedStrategies, dataset.managedSetups, dataset.trades, dataset.journalEntries, dataset.journalEntryTrades, dataset.dailyReviewDetails, dataset.rules, dataset.ruleChecks, dataset.goals, dataset.importRuns, dataset.importRunRows];
  if (ownedCollections.some((rows) => rows.some((row) => row.userId !== dataset.userId))) {
    throw new Error('Demo dataset contains a foreign user row.');
  }
  if (dataset.accounts.some((account) => !DEMO_ACCOUNT_TYPES.includes(account.accountType) || !DEMO_ACCOUNT_STATUSES.includes(account.status))) {
    throw new Error('Demo account enum is invalid.');
  }
  const defaultAccounts = dataset.accounts.filter((account) => account.isDefault);
  if (defaultAccounts.length !== 1 || defaultAccounts[0].status !== 'active') {
    throw new Error('Demo Accounts require exactly one active default.');
  }
  if (dataset.accounts.some((account) => !/^[A-Z]{3}$/.test(account.baseCurrency) || !Number.isFinite(account.openingBalance))) {
    throw new Error('Demo Account currency or opening balance is invalid.');
  }
  const accountIds = new Set(dataset.accounts.map((account) => account.id));
  const strategiesById = new Map(dataset.managedStrategies.map((strategy) => [strategy.id, strategy]));
  const setupsById = new Map(dataset.managedSetups.map((setup) => [setup.id, setup]));
  dataset.trades.forEach((trade) => {
    if (!accountIds.has(trade.accountId)) throw new Error('Demo trade references a foreign account.');
    const computed = computeFields(trade);
    for (const key of ['status', 'pnlGross', 'pnlNet', 'rMultiple', 'durationMinutes']) {
      if (computed[key] !== trade[key]) throw new Error(`Demo trade ${trade.id} has inconsistent ${key}.`);
    }
    if (trade.durationMinutes != null && trade.durationMinutes < 0) throw new Error('Demo trade has negative duration.');
    if (trade.strategyId && !strategiesById.has(trade.strategyId)) throw new Error('Demo trade references a foreign Strategy.');
    if (trade.setupId) {
      const setup = setupsById.get(trade.setupId);
      if (!setup || setup.strategyId !== trade.strategyId) throw new Error('Demo trade has an inconsistent managed Setup.');
    }
  });
  if (!dataset.trades.some((trade) => trade.strategyId == null) || !dataset.trades.some((trade) => trade.strategyId != null)) {
    throw new Error('Demo Trades must include managed and intentionally unlinked classifications.');
  }
  const tradeIds = new Set(dataset.trades.map((trade) => trade.id));
  const runIds = new Set(dataset.importRuns.map((run) => run.id));
  if (dataset.importRuns.length !== 3 || dataset.importRunRows.length !== 8
    || dataset.importRunRows.some((row) => !runIds.has(row.importRunId) || (row.tradeId && !tradeIds.has(row.tradeId)))) {
    throw new Error('Demo Import History is invalid.');
  }
  for (const run of dataset.importRuns) {
    const rows = dataset.importRunRows.filter((row) => row.importRunId === run.id);
    const imported = rows.filter((row) => row.status === 'imported').length;
    const skipped = rows.filter((row) => row.status === 'skipped_duplicate').length;
    const failed = rows.length - imported - skipped;
    if (!/^[0-9a-f]{64}$/.test(run.fileSha256) || rows.length !== run.totalRows
      || imported !== run.importedRows || skipped !== run.skippedRows || failed !== run.failedRows) {
      throw new Error('Demo Import History counts or hash are invalid.');
    }
  }
  const journalIds = new Set(dataset.journalEntries.map((entry) => entry.id));
  if (dataset.journalEntryTrades.some((link) => !journalIds.has(link.journalEntryId) || !tradeIds.has(link.tradeId))) {
    throw new Error('Demo Journal link is invalid.');
  }
  if (dataset.dailyReviewDetails.some((detail) => !journalIds.has(detail.journalEntryId)
    || dataset.journalEntries.find((entry) => entry.id === detail.journalEntryId)?.entryType !== 'daily_review'
    || dataset.journalEntries.find((entry) => entry.id === detail.journalEntryId)?.entryDate !== detail.reviewDate)) {
    throw new Error('Demo Daily Review detail is invalid.');
  }
  const ruleIds = new Set(dataset.rules.map((rule) => rule.id));
  if (dataset.ruleChecks.some((check) => !ruleIds.has(check.ruleId)
    || (check.tradeId && !tradeIds.has(check.tradeId))
    || (check.journalEntryId && !journalIds.has(check.journalEntryId)))) {
    throw new Error('Demo Rule check link is invalid.');
  }
  dataset.goals.forEach((goal) => {
    const issue = validateGoalDefinition(goal);
    if (issue) throw new Error(`Demo goal is invalid: ${issue.message}`);
  });
  return summary;
}

export function generateDemoDataset({ userId, timezone, anchorDate, locale = 'en' }) {
  if (!userId) throw new Error('A target user ID is required.');
  assertTimezone(timezone);
  if (!isValidDateKey(anchorDate)) throw new RangeError('Expected a valid demo anchor date.');
  const tradingDates = TRADING_DATE_OFFSETS.map((offset) => addDaysToDateKey(anchorDate, offset));
  const accounts = ACCOUNT_DEFINITIONS.map((definition, index) => {
    const createdAt = localDateTimeToInstant(addDaysToDateKey(anchorDate, -45), '12:00:00', timezone).toISOString();
    return {
      id: stableUuid('account', userId, anchorDate, index), userId,
      ...definition,
      baseCurrency: 'USD',
      openingBalance: [25000, 18000, 35000, 50000, 40000, 150000, 50000, 100000][index],
      isDefault: index === 3,
      createdAt, updatedAt: createdAt,
    };
  });
  const managed = buildManagedClassifications(userId, anchorDate, timezone);
  const trades = buildTrades(userId, anchorDate, timezone, accounts, tradingDates).map((trade, index) => {
    if (index % 5 === 0) return { ...trade, strategyId: null, setupId: null };
    const strategy = managed.strategies[index % managed.strategies.length];
    const candidates = managed.setups.filter((setup) => setup.strategyId === strategy.id);
    const setup = candidates[index % candidates.length];
    return { ...trade, strategyId: strategy.id, setupId: setup.id, strategy: strategy.name, setup: setup.name };
  });
  const journal = buildJournal(userId, anchorDate, timezone, trades);
  const ruleData = buildRules(userId, anchorDate, timezone, trades, journal.entries, tradingDates);
  const goals = buildGoals(userId, anchorDate, timezone, tradingDates);
  const imports = buildImportHistory(userId, anchorDate, timezone, accounts, trades);
  const dataset = {
    userId, timezone, anchorDate, tradingDates, accounts, managedStrategies: managed.strategies, managedSetups: managed.setups, trades,
    journalEntries: journal.entries, journalEntryTrades: journal.links, dailyReviewDetails: journal.details,
    rules: ruleData.rules, ruleChecks: ruleData.checks, goals, importRuns: imports.importRuns, importRunRows: imports.importRunRows,
  };
  const localizedDataset = localizeDatasetText(dataset, normalizeDemoLocale(locale));
  validateDemoDataset(localizedDataset);
  return localizedDataset;
}

import en from './en.js';

const he = {
  ...en,
  common: {
    ...en.common,
    save: 'שמירה', saveChanges: 'שמירת שינויים', saving: 'שומר…', cancel: 'ביטול', delete: 'מחיקה', deleting: 'מוחק…', edit: 'עריכה', close: 'סגירה', back: 'חזרה', retry: 'ניסיון נוסף', clearFilters: 'ניקוי מסננים', clearAll: 'ניקוי הכול', search: 'חיפוש', actions: 'פעולות', status: 'סטטוס', type: 'סוג', date: 'תאריך', from: 'מתאריך', to: 'עד תאריך', account: 'חשבון', allAccounts: 'כל החשבונות', symbol: 'סימול', market: 'שוק', direction: 'כיוון', outcome: 'תוצאה', strategy: 'אסטרטגיה', setup: 'סטאפ', timeframe: 'טווח זמן', notes: 'הערות', description: 'תיאור', name: 'שם', title: 'כותרת', content: 'תוכן', optional: 'אופציונלי', required: 'חובה', yes: 'כן', no: 'לא', active: 'פעיל', inactive: 'לא פעיל', archived: 'בארכיון', paused: 'מושהה', open: 'פתוחה', closed: 'סגורה', complete: 'הושלם', incomplete: 'לא הושלם', unavailable: 'לא זמין', noData: 'אין נתונים', loading: 'טוען…', today: 'היום', yesterday: 'אתמול', previous: 'הקודם', next: 'הבא', more: 'עוד', all: 'הכול', none: 'ללא', count: 'כמות', details: 'פרטים', filters: 'מסננים', refresh: 'רענון', export: 'ייצוא', import: 'ייבוא', create: 'יצירה', update: 'עדכון', view: 'צפייה', result: 'תוצאה', email: 'דוא״ל', password: 'סיסמה', displayName: 'שם תצוגה', company: 'חברה', accountNumber: 'מספר חשבון', accountName: 'שם החשבון', accountType: 'סוג חשבון', trades: 'עסקאות', entry: 'כניסה', exit: 'יציאה', entryPrice: 'מחיר כניסה', exitPrice: 'מחיר יציאה', quantity: 'כמות', fees: 'עמלות', netPnl: 'רווח והפסד נטו', grossPnl: 'רווח והפסד ברוטו', winRate: 'אחוז הצלחה', profitFactor: 'פקטור רווח', expectancy: 'תוחלת', averageR: 'ממוצע R', risk: 'סיכון', riskAmount: 'סכום בסיכון', stopLoss: 'סטופ לוס', takeProfit: 'יעד רווח', duration: 'משך', rMultiple: 'מכפיל R', long: 'לונג', short: 'שורט', breakeven: 'איזון', win: 'רווח', loss: 'הפסד', followed: 'בוצע לפי הכלל', broken: 'הכלל הופר', notApplicable: 'לא רלוונטי', achieved: 'הושג', missed: 'לא הושג', upcoming: 'עתידי', inProgress: 'בתהליך', atLeast: 'לפחות', atMost: 'לכל היותר', timezone: 'אזור זמן קלנדרי: {{timezone}}', pageControls: 'בקרי העמוד', unknown: 'לא ידוע', selected: 'נבחר', language: 'שפה', english: 'English', hebrew: 'עברית', new: 'חדש', record: 'תיעוד', calendar: 'לוח שנה', timeline: 'ציר זמן', summary: 'סיכום', total: 'סה״כ', value: 'ערך', target: 'יעד', current: 'נוכחי', progress: 'התקדמות', linkedTrades: 'עסקאות מקושרות', tags: 'תגיות', scope: 'היקף', rule: 'כלל', goal: 'יעד', journal: 'יומן', review: 'סיכום', period: 'תקופה', created: 'נוצר', updated: 'עודכן', pageOf: 'עמוד {{page}} מתוך {{pages}}', records: '{{count}} רשומות', activeCount: '{{count}} פעילים', allTime: 'כל התקופה', thisWeek: 'השבוע', lastWeek: 'השבוע שעבר', thisMonth: 'החודש', moreFilters: 'מסננים נוספים', fewerFilters: 'פחות מסננים', noChange: 'ללא שינוי', gain: 'רווח', lossValue: 'הפסד'
  },
  navigation: { trading: 'מסחר', manage: 'ניהול', insights: 'תובנות', dashboard: 'לוח בקרה', trades: 'עסקאות', dailyReview: 'סיכום יומי', accounts: 'חשבונות', import: 'ייבוא', analytics: 'ניתוחים', journal: 'יומן וסקירות', rules: 'כללי מסחר ועמידה', goals: 'יעדים', main: 'ניווט ראשי', primary: 'ניווט ראשי', moreNavigation: 'ניווט נוסף', moreDestinations: 'יעדים נוספים', sidebar: 'סרגל היישום', collapse: 'כיווץ הניווט', expand: 'הרחבת הניווט' },
  routes: {
    dashboard: { title: 'לוח בקרה', description: 'סקירת ביצועי המסחר בטווח הנוכחי.' }, trades: { title: 'עסקאות', description: 'איתור, סינון, ייצוא וניהול עסקאות מתועדות.' }, dailyReview: { title: 'סיכום יומי', description: 'סקירת יום המסחר הנבחר, תיעוד האירועים והכנה לסשן הבא.' }, tradeDetail: { title: 'פרטי עסקה', description: 'סקירת ההקשר והתוצאה של העסקה המתועדת.' }, accounts: { title: 'חשבונות', description: 'ניהול החשבונות המשמשים לארגון פעילות המסחר.' }, import: { title: 'ייבוא', description: 'ייבוא קובצי עסקאות מהברוקר לחשבון קיים.' }, analytics: { title: 'ניתוחים', description: 'ניתוח ביצועי מסחר לפי שוק, כיוון, אסטרטגיה, תזמון וחשבון.' }, journal: { title: 'יומן וסקירות', description: 'תיעוד הערות וסקירות מובנות וקישורן לעסקאות הרלוונטיות.' }, rules: { title: 'כללי מסחר ועמידה', description: 'הגדרת כללי מסחר, תיעוד התוצאות ומדידת עקביות התהליך לאורך זמן.' }, goals: { title: 'יעדים', description: 'הגדרת יעדי מסחר ותהליך מדידים ומעקב אחר התקדמות המבוססת על הפעילות האמיתית.' }
  },
  auth: { signInJournal: 'כניסה ליומן המסחר', createJournal: 'יצירת יומן המסחר שלך', signIn: 'כניסה', signingIn: 'מתחבר…', createAccount: 'יצירת חשבון', creatingAccount: 'יוצר חשבון…', noAccount: 'אין לך חשבון?', createOne: 'יצירת חשבון', alreadyAccount: 'כבר יש לך חשבון?', passwordMin: 'הסיסמה חייבת להכיל לפחות 8 תווים.', passwordLabel: 'סיסמה * (לפחות 8 תווים)', emailLabel: 'דוא״ל *', loginFailed: 'הכניסה נכשלה.', signupFailed: 'יצירת החשבון נכשלה.', loggedOut: 'התנתקת מהמערכת.' },
  shell: { breadcrumb: 'פירורי לחם', searchCommand: 'חיפוש או הפעלת פקודה', searchCommands: 'חיפוש פקודות', commandPlaceholder: 'ניווט או הפעלת פעולה זמינה', availableCommands: 'פקודות זמינות', noCommands: 'לא נמצאו פקודות תואמות', commandHelp: 'השתמשו בחצים למעלה ולמטה כדי לנוע, Enter לפתיחה ו־Escape לסגירה.', goTo: 'מעבר אל {{label}}', newJournal: 'רשומת יומן חדשה', newJournalDescription: 'פתיחת טופס רשומה ביומן וסקירות', newRule: 'כלל חדש', newRuleDescription: 'יצירת כלל מסחר', recordCheck: 'תיעוד בדיקת כלל', recordCheckDescription: 'תיעוד האם כלל המסחר קוים', newGoal: 'יעד חדש', newGoalDescription: 'יצירת יעד מדיד', lightTheme: 'מעבר לערכת נושא בהירה', darkTheme: 'מעבר לערכת נושא כהה', logout: 'התנתקות', notifications: 'התראות', dismissNotification: 'סגירת ההתראה', closeDialog: 'סגירת החלון', languageLabel: 'בחירת שפת היישום' },
  status: { active: 'פעיל', inactive: 'לא פעיל', archived: 'בארכיון', paused: 'מושהה', open: 'פתוחה', closed: 'סגורה', complete: 'הושלם', incomplete: 'לא הושלם', upcoming: 'עתידי', in_progress: 'בתהליך', achieved: 'הושג', missed: 'לא הושג', followed: 'בוצע לפי הכלל', broken: 'הכלל הופר', not_applicable: 'לא רלוונטי', long: 'לונג', short: 'שורט', win: 'רווח', loss: 'הפסד', breakeven: 'איזון', funded: 'ממומן', evaluation: 'הערכה', demo: 'דמו', live: 'חי', trade: 'עסקה', daily: 'יומי', general: 'כללי', note: 'הערה', trade_review: 'סקירת עסקה', daily_review: 'סיכום יומי', weekly_review: 'סיכום שבועי' },
  states: { noMatching: 'לא נמצאו תוצאות תואמות', nothingYet: 'עדיין אין כאן תוכן', somethingWrong: 'אירעה שגיאה', stillAvailable: 'עדיין זמין: {{available}}' },
  validation: { required: 'השדה {{field}} הוא חובה.', invalidDate: 'יש להזין תאריך תקין.', invalidNumber: 'יש להזין מספר תקין.', dateRange: 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה.', maxLength: '{{field}} מוגבל ל־{{max}} תווים.', passwordMin: 'הסיסמה חייבת להכיל לפחות 8 תווים.' },
  errors: { unknown: 'אירעה שגיאה. אפשר לנסות שוב.', network: 'לא ניתן להגיע לשרת. אפשר לנסות שוב.', unauthorized: 'פג תוקף החיבור. יש להתחבר מחדש.', DAILY_REVIEW_DUPLICATE_ENTRIES: 'קיים יותר מסיכום יומי אחד לתאריך הזה. יש לפתור את הכפילויות ביומן לפני שממשיכים.', saveFailed: 'לא ניתן לשמור את השינויים.', deleteFailed: 'לא ניתן למחוק את הפריט.', loadFailed: 'לא ניתן לטעון את הנתונים.' },
  dashboard: { performance: 'ביצועים', recentTrades: 'עסקאות אחרונות', noTrades: 'אין עסקאות בתקופה הזו', noTradesDetail: 'תעדו עסקה או שנו את התקופה כדי לראות ביצועים.', dailyPnl: 'רווח והפסד יומי', periodPnl: 'רווח והפסד לתקופה', closedTrades: 'עסקאות סגורות', openTrades: 'עסקאות פתוחות', winners: 'עסקאות מרוויחות', losers: 'עסקאות מפסידות', bestTrade: 'העסקה הטובה ביותר', worstTrade: 'העסקה הגרועה ביותר', equityCurve: 'רווח והפסד נטו מצטבר', calendar: 'לוח מסחר', addTrade: 'הוספת עסקה', today: 'היום', wtd: 'מתחילת השבוע', mtd: 'מתחילת החודש', custom: 'מותאם אישית' },
  trades: { addTrade: 'הוספת עסקה', editTrade: 'עריכת עסקה', cancelEdit: 'ביטול עריכה', deleteTrade: 'מחיקת עסקה', tradeDeleted: 'העסקה נמחקה.', tradeUpdated: 'העסקה עודכנה.', createFailed: 'יצירת העסקה נכשלה.', updateFailed: 'עדכון העסקה נכשל.', deleteFailed: 'מחיקת העסקה נכשלה.', deleteConfirm: 'למחוק את העסקה לצמיתות?', deleteConfirmShort: 'למחוק את העסקה?', exportCsv: 'ייצוא CSV', exportFailed: 'הייצוא נכשל.', recordedCaption: 'עסקאות מתועדות עם חשבון, כניסה, תוצאה, סטטוס ופעולות', noTrades: 'לא נמצאו עסקאות', noTradesDetail: 'אין עסקאות התואמות למסננים שנבחרו.', loading: 'טוען עסקאות', details: 'פרטי עסקה', financialResult: 'תוצאה כספית', entryExit: 'כניסה ויציאה', planOutcome: 'תכנון מול תוצאה', context: 'הקשר המסחר', emotions: 'רגשות', attachments: 'קישורים לצילומי מסך', attachment: 'קובץ {{number}} · {{host}}', openAttachment: 'פתיחת קובץ {{number}} מאת {{host}} בכרטיסייה חדשה', back: 'חזרה לעסקאות', loadError: 'לא ניתן לטעון את פרטי העסקה', unavailableRecord: 'רשומת העסקה אינה זמינה כרגע.', notFound: 'העסקה לא נמצאה', notFoundDetail: 'רשומת העסקה אינה זמינה או שנמחקה.', openDetails: 'פתיחת פרטי העסקה {{symbol}}', sortBy: 'מיון לפי {{label}}{{status}}', currently: ', כרגע {{order}}', ascending: 'עולה', descending: 'יורד', marketHelp: 'סוג השוק של העסקה.', exitHelp: 'יש להשאיר את שני שדות היציאה ריקים לעסקה פתוחה.', screenshotHelp: 'כתובת אחת בכל שורה.', screenshots: 'קישורים לצילומי מסך (אופציונלי)' },
  accounts: { newAccount: 'חשבון חדש', editAccount: 'עריכת חשבון', deleteAccount: 'מחיקת חשבון', accountCreated: 'החשבון נוצר.', accountUpdated: 'החשבון עודכן.', accountDeleted: 'החשבון נמחק.', loadFailed: 'טעינת החשבונות נכשלה.', saveFailed: 'שמירת החשבון נכשלה.', deleteFailed: 'מחיקת החשבון נכשלה.', noAccounts: 'עדיין אין חשבונות', noAccountsDetail: 'יש ליצור חשבון לפני תיעוד או ייבוא עסקאות.', hasTrades: 'בחשבון הזה יש {{count}} עסקאות. יש לשייך אותן מחדש או למחוק אותן לפני מחיקת החשבון.', permanentDelete: 'למחוק לצמיתות את {{account}}? לא ניתן לבטל פעולה זו.', tradingAccounts: 'חשבונות מסחר', tradesCount: 'מספר עסקאות' },
  analytics: { summary: 'סיכום ביצועים', netPnl: 'רווח והפסד נטו', winRate: 'אחוז הצלחה', profitFactor: 'פקטור רווח', expectancy: 'תוחלת', averageWin: 'רווח ממוצע', averageLoss: 'הפסד ממוצע', closedTrades: 'עסקאות סגורות', cumulative: 'רווח והפסד נטו מצטבר', dollarDistribution: 'התפלגות רווח והפסד בדולר', rDistribution: 'התפלגות R', breakdown: 'פילוח ביצועים', calendar: 'לוח מסחר', noData: 'אין נתוני ניתוח לטווח הזה', noDataDetail: 'תעדו עסקאות סגורות או שנו את הטווח שנבחר.', timezoneHelp: 'תאריכים קלנדריים משתמשים ב־{{timezone}}.', bySymbol: 'לפי סימול', byMarket: 'לפי שוק', byDirection: 'לפי כיוון', byStrategy: 'לפי אסטרטגיה', bySetup: 'לפי סטאפ', byTimeframe: 'לפי טווח זמן', byAccount: 'לפי חשבון', byCompany: 'לפי חברה', byWeekday: 'לפי יום בשבוע' },
  journal: { newEntry: 'רשומת יומן חדשה', editEntry: 'עריכת רשומת יומן', deleteEntry: 'מחיקת רשומה', entrySaved: 'רשומת היומן נשמרה.', entryDeleted: 'רשומת היומן נמחקה.', saveFailed: 'לא ניתן לשמור את רשומת היומן.', deleteFailed: 'לא ניתן למחוק את רשומת היומן.', deleteConfirm: 'למחוק את רשומת היומן?', noEntries: 'עדיין אין רשומות ביומן', noEntriesDetail: 'צרו הערה או סקירה כדי להתחיל את ציר הזמן ביומן.', filteredEmpty: 'אין רשומות יומן התואמות למסננים הנוכחיים', entryType: 'סוג רשומה', entryDate: 'תאריך הרשומה', completeOnly: 'הושלמו בלבד', incompleteOnly: 'לא הושלמו בלבד', allCompletion: 'כל מצבי ההשלמה', searchPlaceholder: 'חיפוש בכותרת, בתוכן או בתגיות', tagsHelp: 'יש להפריד תגיות בפסיקים.', linkedTradesHelp: 'בחרו את העסקאות המתוארות ברשומה.', journalEntry: 'רשומת יומן' },
  rules: { newRule: 'כלל חדש', editRule: 'עריכת כלל', recordCheck: 'תיעוד בדיקת כלל', editCheck: 'עריכת בדיקת כלל', adherence: 'עמידה בכללים', activeRules: 'כללים פעילים', inactiveRules: 'כללים לא פעילים', history: 'היסטוריית בדיקות', noRules: 'עדיין אין כללי מסחר', noRulesDetail: 'צרו כלל כדי להתחיל למדוד עמידה בכללים.', noChecks: 'אין בדיקות כללים בתקופה הזו', followed: 'בוצע לפי הכלל', broken: 'הכלל הופר', notApplicable: 'לא רלוונטי', eligibleChecks: 'בדיקות רלוונטיות', ruleCreated: 'הכלל נוצר.', ruleUpdated: 'הכלל עודכן.', ruleDeleted: 'הכלל נמחק.', checkSaved: 'בדיקת הכלל נשמרה.', deleteConfirm: 'למחוק את הכלל?', hasChecks: 'לא ניתן למחוק כלל שיש לו בדיקות.', ruleName: 'שם הכלל', checkDate: 'תאריך הבדיקה', linkedTrade: 'עסקה מקושרת', linkedJournal: 'רשומת יומן מקושרת', noEligible: 'אין בדיקות רלוונטיות' },
  goals: { newGoal: 'יעד חדש', editGoal: 'עריכת יעד', deleteGoal: 'מחיקת יעד', goalCreated: 'היעד נוצר.', goalUpdated: 'היעד עודכן.', goalDeleted: 'היעד נמחק.', saveFailed: 'לא ניתן לשמור את היעד.', deleteFailed: 'לא ניתן למחוק את היעד.', deleteConfirm: 'למחוק את היעד? רשומות המקור יישארו ללא שינוי.', noGoals: 'עדיין אין יעדים', noGoalsDetail: 'צרו יעד מדיד כדי להתחיל לעקוב אחר התקדמות מהפעילות שלכם.', filteredEmpty: 'אין יעדים התואמים למסננים הנוכחיים', metric: 'מדד', targetValue: 'ערך יעד', startDate: 'תאריך התחלה', endDate: 'תאריך סיום', comparison: 'השוואה', storedStatus: 'סטטוס שמור', derivedState: 'מצב נוכחי', currentValue: 'ערך נוכחי', difference: 'פער מהיעד', pause: 'השהיה', resume: 'המשך', archive: 'העברה לארכיון', restore: 'שחזור', withinLimit: 'בתוך הגבול', overLimit: 'מעל הגבול', maxAllowed: 'מקסימום מותר', unavailable: 'הערך הנוכחי אינו זמין.', progressLabel: '{{name}}: נוכחי {{current}}, יעד {{target}}, {{percent}}%, {{state}}', no_closed_trades: 'אין עסקאות סגורות בתקופת היעד.', no_r_data: 'אין עסקאות עם נתוני R בתקופת היעד.', no_eligible_rule_checks: 'אין בדיקות כללים רלוונטיות בתקופת היעד.', source_unavailable: 'לא ניתן לחשב את מקור הנתונים כרגע.' },
  importPage: { title: 'ייבוא עסקאות', selectFile: 'בחירת קובץ', mapping: 'מיפוי עמודות', preview: 'תצוגה מקדימה', results: 'תוצאות הייבוא', chooseAccount: 'בחירת חשבון', chooseFile: 'בחירת קובץ CSV', upload: 'העלאה ותצוגה מקדימה', importing: 'מייבא…', importTrades: 'ייבוא עסקאות', cancelImport: 'ביטול הייבוא', file: 'קובץ', rows: 'שורות', validRows: 'שורות תקינות', invalidRows: 'שורות שגויות', duplicates: 'כפילויות', errors: 'שגיאות', complete: 'הייבוא הושלם', failed: 'הייבוא נכשל', requiredColumns: 'עמודות חובה', optionalColumns: 'עמודות אופציונליות' },
  dailyReview: { sessionNotes: 'הערות הסשן', wentWell: 'מה עבד טוב', improve: 'מה כדאי לשפר', nextPlan: 'תוכנית לסשן הבא', emotions: 'רגשות', mistakes: 'טעויות', saveReview: 'שמירת הסיכום היומי', saved: 'הסיכום היומי נשמר.', saveFailed: 'לא ניתן לשמור את הסיכום היומי.', noReview: 'עדיין לא נשמר סיכום יומי', noReviewDetail: 'תעדו מה קרה והתכוננו לסשן הבא.', daySummary: 'סיכום היום', tradesTaken: 'עסקאות שבוצעו', rulesChecks: 'כללים ובדיקות', reviewSection: 'הערות הסיכום', recordCheck: 'תיעוד בדיקה', noRules: 'אין כללים פעילים', noChecks: 'אין בדיקות מתועדות לתאריך הזה', noTrades: 'אין עסקאות בתאריך הזה', completion: 'סימון הסיכום כהושלם', previousDay: 'היום הקודם', nextDay: 'היום הבא', openToday: 'פתיחת היום', invalidDate: 'תאריך הסיכום היומי אינו תקין.', invalidDateDetail: 'יש להשתמש בתאריך קלנדרי תקין בפורמט YYYY-MM-DD.', calendarTimezone: 'אזור זמן קלנדרי: {{timezone}}', closedTrades: 'עסקאות סגורות', openTrades: 'עסקאות פתוחות', winners: 'עסקאות מרוויחות', losers: 'עסקאות מפסידות', bestTrade: 'העסקה הטובה ביותר', worstTrade: 'העסקה הגרועה ביותר', feeTotal: 'עמלות', adherence: 'עמידה בכללים', checkCount: '{{count}} בדיקות', latest: 'אחרון: {{outcome}}', customEmotion: 'הוספת רגש מותאם', customMistake: 'הוספת טעות מותאמת', add: 'הוספה', maxItems: 'אפשר לבחור עד {{max}} פריטים.', contentRequired: 'הערות הסשן הן שדה חובה.' }
};

Object.assign(he.common, {
  maximum: 'מקסימום',
  allStatuses: 'כל הסטטוסים',
  restOfApp: 'שאר חלקי TradingLog',
});

Object.assign(he.goals, {
  deleteNamedConfirm: 'למחוק את „{{name}}”? המחיקה מסירה רק את הגדרת היעד.',
  clearFilterDetail: 'נקו את המסננים הנוכחיים כדי לחזור לכל היעדים.',
  overLimitBy: 'חריגה של',
  remainingAllowance: 'יתרה מותרת',
  targetAchieved: 'היעד הושג',
  progressUnavailable: 'אחוז התקדמות אינו משמעותי לערך היעד הזה.',
  summary: 'סיכום יעדים',
  loadingSummary: 'טוען סיכום יעדים',
  loadingMetric: 'טוען מדד יעד',
  filters: 'מסנני יעדים',
  search: 'חיפוש יעדים',
  statusFilter: 'סטטוס יעד',
  metricFilter: 'מדד יעד',
  allMetrics: 'כל המדדים',
  refreshing: 'מרענן יעדים…',
  refreshFailed: 'לא ניתן לרענן את היעדים',
  staleVisible: 'היעדים האחרונים הזמינים נשארים מוצגים.',
  availableActions: 'מסננים ופעולות היעדים הקיימים',
  loadFailed: 'לא ניתן לטעון את היעדים',
  loadFailedDetail: 'הגדרות היעדים וחישובי ההתקדמות אינם זמינים כרגע.',
  activeUpcoming: 'פעילים ועתידיים',
  outcomes: 'תוצאות',
  pausedArchived: 'מושהים ובארכיון',
});

Object.assign(he.common, { any: 'כל תאריך' });
Object.assign(he.analytics, {
  loadingScope: 'טוען את סיכום טווח הניתוחים', scopeFailed: 'לא ניתן לטעון את סיכום הטווח', closedUnavailable: 'מספר העסקאות הסגורות אינו זמין.', scopeAvailable: 'בקרי הטווח ורכיבי ניתוח שנטענו בהצלחה', scopeSummary: 'סיכום טווח הניתוחים', dateRange: 'טווח תאריכים', accountScope: 'טווח חשבונות', calendarTimezone: 'אזור זמן קלנדרי', allCompanies: 'כל החברות', period: 'תקופת הניתוח', customDates: 'תאריכים מותאמים לניתוח', accountsLoadFailed: 'לא ניתן לטעון אפשרויות חשבון. ניתוח כלל החשבונות עדיין זמין.', retryAccounts: 'ניסיון נוסף לטעינת חשבונות', loadFailed: 'לא ניתן לטעון את הניתוחים', loadFailedDetail: 'סיכום הטווח, פילוח הביצועים והתפלגות R נכשלו.', controlsAvailable: 'בקרי חשבון ותקופה', noClosedScope: 'אין עסקאות סגורות בטווח הזה', noClosedScopeDetail: 'בחרו חשבון או טווח תאריכים אחר כדי לנתח תוצאות מתועדות.', weekday: 'יום בשבוע', breakdownDetails: 'פרטי הפילוח לפי הממד שנבחר', group: 'קבוצה', viewDetails: 'הצגת פרטי הפילוח', dimensionAnalysis: 'ניתוח לפי ממד', dimensionDescription: 'רווח והפסד נטו ותוצאות של עסקאות סגורות לפי {{dimension}}.', dimensionControl: 'ניתוח ביצועים לפי ממד', dimensionFailed: 'לא ניתן לטעון את ניתוח הממד', dimensionUnavailable: 'הפילוח לפי {{dimension}} אינו זמין.', dimensionAvailable: 'בקרי הטווח והתפלגות R', noDimension: 'אין פילוח לפי {{dimension}}', noDimensionDetail: 'אין בטווח הזה עסקאות סגורות שאפשר לקבץ לפי הממד.', closedTradeSummary: '{{count}} עסקה סגורה · {{rate}} הצלחה', closedTradeSummary_other: '{{count}} עסקאות סגורות · {{rate}} הצלחה', tradeCount: 'עסקה אחת', tradeCount_other: '{{count}} עסקאות', loadingR: 'טוען התפלגות R', rFailed: 'לא ניתן לטעון את התפלגות R', rFailedDetail: 'טווחי R השמורים אינם זמינים לטווח הזה.', rAvailable: 'בקרי הטווח וניתוח לפי ממד', rUnavailable: 'נתוני R אינם זמינים', rUnavailableDetail: 'קיימות עסקאות סגורות בטווח, אך לאף אחת אין מכפיל R שמור. נתון סיכון חסר אינו נחשב ל־0R.', rDescription: 'תוצאות שמורות עבור {{count}} עסקאות סגורות, ביחס לסיכון המתוכנן.'
});
Object.assign(he.importPage, {
  selectUpload: 'בחירה והעלאה', done: 'הושלם', progress: 'התקדמות הייבוא', noRows: 'אין שורות לתצוגה מקדימה.', previewTable: 'תצוגה מקדימה של עסקאות לייבוא', broker: 'ברוקר', csvFile: 'קובץ CSV', parsing: 'מנתח…', selectBrokerError: 'יש לבחור ברוקר.', selectFileError: 'יש לבחור קובץ CSV.', selectAccountError: 'יש לבחור חשבון לעסקאות האלה.', parseFailed: 'ניתוח קובץ ה־CSV נכשל.', totalRows: 'סך השורות בקובץ', uniqueRows: 'שורות ייחודיות בקובץ', inFileDuplicates: 'כפילויות בתוך הקובץ', previewCount: 'תצוגה מקדימה ({{shown}} מתוך {{total}} שורות ייחודיות)', assignAccount: 'שיוך לחשבון *', assignAccountHelp: 'כל העסקאות המיובאות ישויכו לחשבון הזה.', importCount: 'ייבוא עסקה אחת', importCount_other: 'ייבוא {{count}} עסקאות', startOver: 'התחלה מחדש', importedCount: 'עסקאות שיובאו', existingCount: 'כבר היו קיימות', viewTrades: 'הצגת עסקאות', importMore: 'ייבוא נוסף'
});
Object.assign(he.rules, {
  overallAdherence: 'עמידה כוללת', summary: 'סיכום עמידה בכללים', notApplicableDetail: 'כל הבדיקות בתקופה אינן רלוונטיות, ולכן הן אינן נכללות במכנה של חישוב העמידה.', recordToMeasure: 'תעדו מה קרה כדי להתחיל למדוד עמידה בכללים.', reactivateHelp: 'יש להפעיל מחדש את הכלל לפני תיעוד בדיקה חדשה.', noLinkedContext: 'אין הקשר מקושר', overview: 'סקירה', detailsUnavailable: 'פרטי הכלל אינם זמינים. נסו לטעון מחדש את רשימת הכללים לפני העריכה.', period: 'תקופת הכללים', customDates: 'תאריכים מותאמים לכללים', view: 'תצוגת כללים', invalidRange: 'טווח התאריכים אינו תקין', managementForms: 'ניהול כללים וטפסים', perRule: 'עמידה לפי כלל', recentChecks: 'בדיקות אחרונות', management: 'ניהול כללים', search: 'חיפוש כללים', statusFilter: 'סטטוס כלל', scopeFilter: 'היקף כלל', allScopes: 'כל ההיקפים'
});
Object.assign(he.goals, { goalName: 'שם היעד' });
Object.assign(he.accounts, { newAccountDialog: 'חשבון חדש' });
Object.assign(he.analytics, { expectancyDescription: 'ממוצע רווח והפסד נטו לעסקה סגורה' });
Object.assign(he.dashboard, { loadFailed: 'לא ניתן לטעון את נתוני לוח הבקרה', loadFailedDetail: 'בקשות הניתוח נכשלו. ייתכן שלוח השנה, שנטען בנפרד, עדיין זמין.' });
Object.assign(he.goals, { newGoalDialog: 'יעד חדש', editGoalDialog: 'עריכת יעד', createGoal: 'יצירת יעד', saveGoal: 'שמירת יעד', targetRequired: 'יש להזין ערך יעד.', wholeCount: 'יעד ספירה חייב להיות מספר שלם.' });
Object.assign(he.journal, { newEntryDialog: 'רשומה חדשה ביומן', editEntryDialog: 'עריכת רשומת יומן', createEntry: 'יצירת רשומה' });
Object.assign(he.trades, { loadFailed: 'לא ניתן לטעון את העסקאות', filteredEmpty: 'אין עסקאות התואמות למסננים הנוכחיים', filters: 'מסנני עסקאות', loadingDetails: 'טוען את פרטי העסקה' });
Object.assign(he.dashboard, { addTrade: 'הוספת עסקה' });
Object.assign(he.trades, { entryTime: 'שעת כניסה', exitTime: 'שעת יציאה', outcomeR: 'תוצאה ב־R' });
Object.assign(he.dashboard, { loadingMetrics: 'טוען מדדי לוח בקרה', period: 'תקופת לוח הבקרה', customDates: 'תאריכים מותאמים ללוח הבקרה' });
Object.assign(he.journal, { timeline: 'ציר הזמן של היומן', calendarHelp: 'השבועות מתחילים ביום ראשון. בחרו יום כדי לסקור את הרשומות שלו.', previousMonth: 'החודש הקודם', nextMonth: 'החודש הבא', noEntriesMonth: 'אין רשומות יומן בחודש הזה' });
Object.assign(he.analytics, {
  breakdownDescription: 'רווח והפסד נטו של עסקאות סגורות לפי ממד נתמך.', loadingEquity: 'טוען גרף רווח והפסד ממומש מצטבר', equityFailed: 'לא ניתן לטעון את הרווח וההפסד המצטבר', equityFailedDetail: 'הסכום המצטבר של העסקאות הסגורות אינו זמין.', dashboardAvailable: 'בקרי לוח הבקרה ורכיבים אחרים שנטענו בהצלחה', noEquity: 'אין רווח והפסד ממומש להצגה', noEquityDetail: 'אין בטווח שנבחר עסקאות סגורות עבור הגרף.', cumulativeDescription: 'סכום מצטבר של רווח והפסד נטו מעסקאות סגורות בטווח שנבחר.', loadingDistribution: 'טוען התפלגות רווח והפסד', distributionFailed: 'לא ניתן לטעון את התפלגות הרווח וההפסד', distributionFailedDetail: 'טווחי הרווח וההפסד בדולר אינם זמינים.', noDistribution: 'עדיין אין התפלגות רווח והפסד', noDistributionDetail: 'נדרשות עסקאות סגורות כדי למלא את טווחי הרווח וההפסד.', distributionDescription: 'עסקאות סגורות מקובצות לפי הרווח או ההפסד נטו בדולר.', loadingCalendar: 'טוען לוח מסחר', calendarFailed: 'לא ניתן לטעון את לוח המסחר', calendarFailedDetail: 'הרווח וההפסד היומי הממומש אינו זמין לחודש הזה.', dailyRealized: 'רווח והפסד יומי ממומש', calendarDescription: 'רווח והפסד נטו מעסקאות סגורות לפי תאריך כניסה; השבועות מתחילים ביום ראשון.', noCalendarTrades: 'לא תועדו עסקאות סגורות בחודש הקלנדרי הזה.', tradingDays: 'יום מסחר אחד בשנת {{year}}.', tradingDays_other: '{{count}} ימי מסחר בשנת {{year}}.', weekdays: { sun: 'א׳', mon: 'ב׳', tue: 'ג׳', wed: 'ד׳', thu: 'ה׳', fri: 'ו׳', sat: 'ש׳' }
});

Object.assign(he.rules, {
  tabRules: 'כללים',
  createRule: 'יצירת כלל',
  saveRule: 'שמירת כלל',
  recordCheckSubmit: 'תיעוד בדיקה',
  saveCheck: 'שמירת בדיקה',
  checkDeleted: 'בדיקת הכלל נמחקה.',
  recordCheckDialog: 'תיעוד בדיקת כלל',
});

Object.assign(he.journal, {
  loadingTimeline: 'טוען את ציר הזמן של היומן', loadingEntry: 'טוען רשומת יומן', loadingTitle: 'טוען כותרת', loadingContent: 'טוען תוכן',
  controls: 'בקרי היומן', view: 'תצוגת היומן', search: 'חיפוש ברשומות היומן', completionStatus: 'סטטוס השלמה', fromDate: 'מתאריך', toDate: 'עד תאריך',
  refreshFailed: 'לא ניתן לרענן את רשומות היומן', lastTimelineVisible: 'ציר הזמן האחרון שנטען נשאר מוצג.', filtersCalendarForm: 'מסננים, לוח שנה וטופס רשומה',
  entryCount: 'רשומה אחת', entryCount_other: '{{count}} רשומות', refreshingTimeline: 'מרענן את ציר הזמן…', invalidRange: 'טווח התאריכים אינו תקין', invalidRangeDetail: 'בחרו תאריך סיום זהה לתאריך ההתחלה או מאוחר ממנו.', entriesFiltersUnchanged: 'הרשומות והמסננים הקיימים נשארו ללא שינוי', loadFailed: 'לא ניתן לטעון את רשומות היומן', loadFailedDetail: 'הבקשה לציר הזמן נכשלה.', calendarAndForm: 'לוח שנה וטופס רשומה',
  deleteNamedConfirm: 'למחוק את „{{title}}”?', loadingCalendar: 'טוען את לוח השנה של היומן', calendarLoadFailed: 'לא ניתן לטעון את לוח השנה של היומן', monthCountsUnavailable: 'ספירת הרשומות החודשית אינה זמינה.', timelineAndForm: 'ציר הזמן וטופס הרשומה', calendarRefreshFailed: 'לא ניתן לרענן את לוח השנה של היומן', lastMonthVisible: 'החודש האחרון שנטען נשאר מוצג.', refreshingCalendar: 'מרענן את לוח השנה…', entriesForMonth: 'רשומות יומן עבור {{month}}', daySummaryLabel: '{{date}}, {{total}} רשומות, {{complete}} הושלמו, {{incomplete}} לא הושלמו', selectedDay: 'היום שנבחר', selectDay: 'בחרו יום בלוח השנה', selectDayDetail: 'בחרו יום כדי לראות את רשומות היומן שלו.', loadingSelectedDay: 'טוען רשומות ליום שנבחר', selectedDayLoadFailed: 'לא ניתן לטעון את היום שנבחר', selectedDayUnavailable: 'הרשומות ליום זה אינן זמינות.', monthNavigation: 'ספירות חודשיות וניווט', noEntriesDay: 'אין רשומות יומן ביום הזה', noEntriesDayDetail: 'לא נשמרו רשומות בתאריך שנבחר.', selectedDayRefreshFailed: 'לא ניתן לרענן את היום שנבחר', lastEntriesVisible: 'הרשומות האחרונות שנטענו נשארו מוצגות.',
  chooseEntryType: 'בחרו סוג רשומה.', chooseDate: 'בחרו תאריך ליומן.', enterTitle: 'הזינו כותרת.', enterContent: 'הזינו תוכן ליומן.', tagsPlaceholder: 'תהליך, סבלנות', searchTrades: 'חיפוש עסקאות לפי סימול', searchBySymbol: 'חיפוש לפי סימול', selectedTradesCount: '{{count}} מתוך {{max}} נבחרו', loadingRecentTrades: 'טוען עסקאות אחרונות…', tradesLoadFailed: 'לא ניתן לטעון עסקאות. הבחירות הקיימות נשמרו.', noTradeMatches: 'אין עסקאות בבעלותכם התואמות לחיפוש הסימול.', availableTrades: 'עסקאות זמינות'
});

Object.assign(he.rules, {
  loadingSummary: 'טוען סיכום עמידה בכללים', loadingMetric: 'טוען מדד עמידה', lastCheck: 'בדיקה אחרונה', ruleAdherenceLabel: 'עמידה בכלל {{name}}', historyPages: 'עמודי היסטוריית בדיקות', deleteNamedConfirm: 'למחוק את „{{name}}”? אי אפשר למחוק כללים שיש להם בדיקות היסטוריות.', deleteCheckConfirm: 'למחוק את בדיקת „{{outcome}}” עבור „{{name}}”?',
  fullLoadFailed: 'לא ניתן לטעון את כללי המסחר והעמידה בהם', fullLoadFailedDetail: 'הבקשות לכללים, לעמידה ולהיסטוריית הבדיקות נכשלו.', periodAndForms: 'בקרי תקופה וטפסים', summaryLoadFailed: 'לא ניתן לטעון את סיכום העמידה', rulesHistoryAvailable: 'הכללים והיסטוריית הבדיקות עדיין זמינים.', managementHistory: 'ניהול כללים והיסטוריה', refreshFailed: 'לא ניתן לרענן את העמידה בכללים', lastResultsVisible: 'התוצאות האחרונות שנטענו נשארו מוצגות.', rulesAndHistory: 'כללים והיסטוריה', recentLoadFailed: 'לא ניתן לטעון בדיקות אחרונות', adherenceRulesAvailable: 'העמידה והכללים עדיין זמינים.', adherenceManagement: 'עמידה וניהול כללים', rulesRefreshFailed: 'לא ניתן לרענן את הכללים', lastRulesVisible: 'הכללים האחרונים שנטענו נשארו מוצגים.', editingChecksAvailable: 'עריכה ותיעוד בדיקות', loadingRules: 'טוען כללים', rulesLoadFailed: 'לא ניתן לטעון את הכללים', rulesRequestFailed: 'הבקשה לכללים נכשלה.', adherenceHistory: 'עמידה והיסטוריית בדיקות', filteredEmpty: 'אין כללים התואמים למסננים הנוכחיים', clearRuleFiltersDetail: 'נקו את המסננים כדי לחזור לכל הכללים.', historicalChecks: 'בדיקה היסטורית אחת', historicalChecks_other: '{{count}} בדיקות היסטוריות', deactivate: 'השבתה', reactivate: 'הפעלה מחדש', historyRule: 'כלל בהיסטוריה', allRules: 'כל הכללים', historyOutcome: 'תוצאה בהיסטוריה', allOutcomes: 'כל התוצאות', historyRefreshFailed: 'לא ניתן לרענן את היסטוריית הבדיקות', lastChecksVisible: 'הבדיקות האחרונות שנטענו נשארו מוצגות.', adherenceAndRules: 'עמידה וכללים', loadingHistory: 'טוען היסטוריית בדיקות', historyLoadFailed: 'לא ניתן לטעון את היסטוריית הבדיקות', historyLoadFailedDetail: 'בקשת ההיסטוריה נכשלה. העמידה והכללים עדיין זמינים.', clearCheckFiltersDetail: 'נקו את המסננים כדי לחזור לכל הבדיקות בתקופה.',
  chooseRule: 'בחרו כלל.', chooseCheckDate: 'בחרו תאריך לבדיקה.', chooseOutcome: 'בחרו תוצאה.', scopeHelp: { trade: 'כלל לעסקה בדרך כלל מקושר לעסקה.', daily: 'כלל יומי בדרך כלל מקושר לסיכום יומי.', general: 'אפשר לתעד כלל כללי ללא קישור.' }, noLinkedTrade: 'ללא עסקה מקושרת', tradesLoadFailed: 'לא ניתן לטעון עסקאות. הבחירה הנוכחית נשמרה.', searchJournal: 'חיפוש רשומות ביומן', searchJournalPlaceholder: 'חיפוש בכותרת או בתוכן', availableJournal: 'רשומות יומן זמינות', noLinkedJournal: 'ללא רשומת יומן מקושרת', journalLoadFailed: 'לא ניתן לטעון רשומות יומן. הבחירה הנוכחית נשמרה.'
});

Object.assign(he.dailyReview, { metricsLoadFailed: 'לא ניתן לטעון את מדדי היום', tradesRulesReviewAvailable: 'העסקאות, הכללים והערות הסיכום עדיין זמינים.', tradesLoadFailed: 'לא ניתן לטעון את העסקאות', rulesReviewAvailable: 'עדיין אפשר לתעד כללים ולשמור את הסיכום.', noStrategyContext: 'ללא הקשר אסטרטגי', realizedUnavailable: 'רווח והפסד ממומש —', rulesLoadFailed: 'לא ניתן לטעון את הכללים', tradesReviewAvailable: 'העסקאות והסיכום היומי עדיין זמינים.', reviewLoadFailed: 'לא ניתן לטעון את הסיכום היומי', reviewLoadFailedDetail: 'מדדי היום, העסקאות והכללים עדיין זמינים. נסו שוב לפני עריכה כדי לא לדרוס תוכן שאינו ידוע.' });
Object.assign(he.analytics, { winsLosses: 'רווח / הפסד', refreshingDimension: 'מרענן ניתוח לפי ממד…', breakdownBy: 'פילוח ביצועים לפי', breakdownLoadFailed: 'לא ניתן לטעון את פילוח הביצועים', groupingUnavailable: 'הקיבוץ לפי {{dimension}} אינו זמין.', otherWidgetsAvailable: 'רכיבי לוח בקרה אחרים שנטענו ובקרי הפילוח', refreshingR: 'מרענן התפלגות R…', rBucketCounts: 'ספירות בטווחי מכפיל R', refreshingCalendar: 'מרענן את לוח השנה…', tradeSummary: '{{count}} עסקאות · אחוז הצלחה: {{rate}}', loadingBreakdown: 'טוען פילוח ביצועים', noBreakdown: 'עדיין אין פילוח לפי {{dimension}}', noBreakdownDetail: 'אין בטווח שנבחר עסקאות סגורות שאפשר לקבץ לתצוגה זו.', topGroups: '{{shown}} הקבוצות המובילות מתוך {{total}} לפי רווח והפסד נטו.', groupsInScope: 'קבוצה אחת בטווח.', groupsInScope_other: '{{count}} קבוצות בטווח.', netPnlChartLabel: 'תרשים רווח והפסד נטו עבור {{count}} קבוצות לפי {{dimension}}.' });
Object.assign(he.journal, { netPnlUnavailable: 'רווח והפסד נטו אינם זמינים', editNamed: 'עריכת {{title}}', deleteNamed: 'מחיקת {{title}}', pagination: 'דפדוף בציר הזמן של היומן' });
Object.assign(he.trades, { activeFilters: 'מסננים פעילים', loadingHeader: 'טוען כותרת טבלה', loadingRow: 'טוען שורת עסקה', filter: { from: 'מתאריך', to: 'עד תאריך', accountId: 'חשבון', symbol: 'סימול', market: 'שוק', direction: 'כיוון', status: 'סטטוס', outcome: 'תוצאה', strategy: 'אסטרטגיה', timeframe: 'טווח זמן' } });
Object.assign(he.trades, { notesPlaceholder: 'מחזור חזק בפריצה…' });
Object.assign(he.accounts, { numberPlaceholder: 'לדוגמה 12345678', namePlaceholder: 'לדוגמה ממומן ראשי' });
Object.assign(he.analytics, { increased: 'עלה', decreased: 'ירד', unchanged: 'נותר ללא שינוי', equityChartLabel: 'הרווח וההפסד הממומש המצטבר {{direction}} לאורך {{count}} ימים ומסתיים ב־{{value}}.', dailyNetPnl: 'רווח והפסד יומי נטו' });
Object.assign(he.goals, { metricHelp: { closed_trades: 'מספר העסקאות הסגורות.', win_rate: 'הגדרת אחוז ההצלחה הקיימת במוצר.', average_r: 'ממוצע ערכי R השמורים כאשר הם זמינים.', rule_adherence: 'בדיקות שבוצעו לפי הכלל חלקי בדיקות שבוצעו לפי הכלל ועוד הפרות.', journal_entries: 'מספר הרשומות ביומן.', broken_rule_checks: 'מספר ההפרות המרבי המותר.' } });
Object.assign(he.rules, { newRuleDialog: 'כלל מסחר חדש', editRuleDialog: 'עריכת כלל מסחר', recordCheckFormDialog: 'תיעוד בדיקת כלל', editCheckDialog: 'עריכת בדיקת כלל' });
Object.assign(he.journal, { daySummaryLabel: '{{date}}, רשומה אחת, {{complete}} הושלמו, {{incomplete}} לא הושלמו', daySummaryLabel_other: '{{date}}, {{total}} רשומות, {{complete}} הושלמו, {{incomplete}} לא הושלמו' });
Object.assign(he.analytics, { netPnlChartLabel: 'רווח והפסד נטו עבור קבוצה אחת לפי {{dimension}}.', netPnlChartLabel_other: 'רווח והפסד נטו עבור {{count}} קבוצות לפי {{dimension}}.', dimensionNames: { strategy: 'אסטרטגיה', symbol: 'סימול', timeframe: 'טווח זמן', direction: 'כיוון', account: 'חשבון', company: 'חברה', market: 'שוק', weekday: 'יום בשבוע', setup: 'סטאפ' } });
Object.assign(he.analytics, { dimensionChartLabel: 'תרשים רווח והפסד נטו עבור קבוצה אחת לפי {{dimension}}.', dimensionChartLabel_other: 'תרשים רווח והפסד נטו עבור {{count}} קבוצות לפי {{dimension}}.' });
Object.assign(he.common, { working: 'בביצוע' });
Object.assign(he.analytics, { loadingDimension: 'טוען ניתוח לפי ממד' });
Object.assign(he.dailyReview, { loadingMetric: 'טוען מדד יומי', loadingReview: 'טוען סיכום יומי' });
Object.assign(he.dailyReview, { emotionSuggestions: ['ממוקד', 'סבלני', 'בטוח', 'רגוע', 'לחוץ', 'מתוסכל', 'פחד מהחמצה'], mistakeSuggestions: ['מסחר יתר', 'רדיפה אחרי כניסה', 'הזזת סטופ', 'סיכון גדול מדי', 'עסקת נקמה', 'יציאה מוקדמת'] });
Object.assign(he.rules, { loadingPerRule: 'טוען עמידה לפי כלל', loadingRecent: 'טוען בדיקות אחרונות' });
Object.assign(he.trades, { loadingCard: 'טוען כרטיס עסקה' });
Object.assign(he.status, { stocks: 'מניות', crypto: 'קריפטו', futures: 'חוזים עתידיים', forex: 'פורקס' });
Object.assign(he.goals.metricHelp, { net_pnl: 'רווח והפסד נטו מעסקאות סגורות בתקופת היעד.' });
Object.assign(he.errors, { ACCOUNT_NOT_FOUND: 'החשבון לא נמצא.', EMAIL_IN_USE: 'כבר קיים חשבון עם כתובת האימייל הזו.', GOAL_NOT_FOUND: 'היעד לא נמצא.', INVALID_CREDENTIALS: 'כתובת האימייל או הסיסמה שגויות.', INVALID_FILE: 'הקובץ שנבחר אינו תקין.', INVALID_JOURNAL_LINK: 'רשומת היומן המקושרת אינה זמינה.', INVALID_REFRESH_TOKEN: 'פג תוקף החיבור. יש להתחבר מחדש.', INVALID_RULE_LINK: 'הכלל המקושר אינו זמין.', INVALID_TRADE_LINK: 'העסקה המקושרת אינה זמינה.', JOURNAL_ENTRY_NOT_FOUND: 'רשומת היומן לא נמצאה.', NO_REFRESH_TOKEN: 'פג תוקף החיבור. יש להתחבר מחדש.', RULE_CHECK_NOT_FOUND: 'בדיקת הכלל לא נמצאה.', RULE_HAS_CHECKS: 'אי אפשר למחוק כלל שיש לו בדיקות היסטוריות.', RULE_NOT_FOUND: 'הכלל לא נמצא.', SESSION_EXPIRED: 'פג תוקף החיבור. יש להתחבר מחדש.', TRADE_NOT_FOUND: 'העסקה לא נמצאה.', USER_NOT_FOUND: 'המשתמש לא נמצא.', VALIDATION_ERROR: 'יש לתקן את הערכים המסומנים.' });
Object.assign(he.auth, { namePlaceholder: 'דנה' });
Object.assign(he.validation, { numberRange: 'יש להזין ערך בין {{min}} ל־{{max}}.' });
Object.assign(he.goals, { targetWithUnit: 'יעד ({{unit}})', countUnit: 'כמות', nameRequired: 'יש להזין שם ליעד.', endDateOrder: 'תאריך הסיום אינו יכול להיות לפני תאריך ההתחלה.' });
Object.assign(he.rules, { nameRequired: 'יש להזין שם לכלל.' });
Object.assign(he.routes, {
  tradeNew: { title: 'עסקה חדשה', description: 'תיעוד עסקה חדשה עם ההקשר הדרוש לסקירה מדויקת.' },
  tradeEdit: { title: 'עריכת עסקה', description: 'עדכון תוצאת העסקה וההקשר המתועד לסקירה.' },
});
Object.assign(he.trades, {
  newTrade: 'עסקה חדשה', newTradeDescription: 'פתיחת עורך העסקה המלא', quickAdd: 'הוספה מהירה', quickAddDescription: 'תיעוד מהיר של פרטי העסקה החיוניים',
  tradeCreated: 'העסקה נוצרה.', saveTrade: 'שמירת העסקה', saveChanges: 'שמירת שינויים', saveAndAddAnother: 'שמירה והוספת עסקה נוספת', openFullForm: 'פתיחת הטופס המלא',
  openFullFormConfirm: 'לפתוח את הטופס המלא ולבטל את הערכים שהוזנו בהוספה המהירה?', discardQuickAddConfirm: 'לבטל את הערכים שהוזנו בהוספה המהירה?',
  discardConfirm: 'יש שינויים שלא נשמרו. לבטל אותם?', presentationMode: 'רמת פירוט', presentationModeHelp: 'המצבים הבסיסי והמתקדם משתמשים באותה רשומת עסקה.',
  simple: 'בסיסי', advanced: 'מתקדם', selectAccount: 'בחירת חשבון פעיל…', symbolPlaceholder: 'AAPL', strategyPlaceholder: 'פריצת טווח פתיחה', setupPlaceholder: 'פריצה',
  statusHelp: 'לעסקה פתוחה אין פרטי יציאה. עסקה סגורה דורשת את שני שדות היציאה.', closedTradeHelp: 'השרת מחשב את התוצאה הממומשת מתוך העסקה שנשמרה.',
  timezoneHelp: 'השעות מוצגות לפי {{timezone}}.', entryDatetime: 'תאריך ושעת כניסה', exitDatetime: 'תאריך ושעת יציאה', identityLockedHelp: 'זהות העסקה ופרטי הכניסה נשמרים לפי החוזה הקיים; אפשר לערוך את התוצאה ואת פרטי הסקירה.',
  emotionPre: 'רגש לפני הכניסה', emotionDuring: 'רגש במהלך העסקה', emotionPost: 'רגש לאחר היציאה', editorLoading: 'טוען את עורך העסקה', loadingAccounts: 'טוען חשבונות…', refreshingEditor: 'מרענן את נתוני עורך העסקה…',
  accountsLoadFailed: 'לא ניתן לטעון את החשבונות', accountsLoadFailedDetail: 'נדרש חשבון אמיתי בבעלות המשתמש כדי לשמור עסקה.', openAccounts: 'פתיחת חשבונות',
  invalidTrade: 'כתובת עסקה לא תקינה', invalidTradeDetail: 'כתובת העריכה אינה מכילה מזהה עסקה תקין.', backToTrade: 'חזרה לעסקה', backToTrades: 'חזרה לעסקאות',
  sections: {
    identity: 'פרטי העסקה', identityHelp: 'בחרו חשבון בבעלותכם וזהו את העסקה.', entry: 'פרטי כניסה', exit: 'פרטי יציאה', risk: 'ניהול סיכון',
    riskHelp: 'השדות האלה תומכים בחישובי הסיכון ו־R הקיימים בשרת.', context: 'אסטרטגיה והקשר', notes: 'הערות ורגשות',
  },
  validation: {
    accountRequired: 'יש לבחור חשבון.', symbolRequired: 'יש להזין סימול.', marketRequired: 'יש לבחור שוק.', directionRequired: 'יש לבחור כיוון.',
    entryRequired: 'יש להזין תאריך ושעת כניסה תקינים.', positiveNumber: 'יש להזין מספר גדול מאפס.', nonnegativeNumber: 'יש להזין אפס או מספר חיובי.',
    closedExitRequired: 'עסקה סגורה דורשת תאריך ושעת יציאה תקינים.', closedExitPriceRequired: 'עסקה סגורה דורשת מחיר יציאה גדול מאפס.',
    exitBeforeEntry: 'היציאה לא יכולה להיות לפני הכניסה.', screenshotLimit: 'אפשר להוסיף עד 10 קישורים לצילומי מסך.', screenshotUrl: 'יש להזין כתובת HTTP או HTTPS תקינה בכל שורה.',
  },
});

Object.assign(he.navigation, { strategies: 'אסטרטגיות וסטאפים' });
Object.assign(he.routes, { strategies: { title: 'אסטרטגיות וסטאפים', description: 'ניהול סיווגים חוזרים לעסקאות ובחינת הביצועים האמיתיים שלהם.' } });
Object.assign(he.strategies = {}, {
  summary: 'סיכום אסטרטגיות וסטאפים', activeStrategies: 'אסטרטגיות פעילות', activeSetups: 'סטאפים פעילים', managedClosedTrades: 'עסקאות סגורות משויכות', unlinkedClosedTrades: 'עסקאות סגורות שלא שויכו',
  strategyList: 'אסטרטגיות מנוהלות', setups: 'סטאפים מנוהלים', managedStrategy: 'אסטרטגיה מנוהלת', managedSetup: 'סטאפ מנוהל', classification: 'סיווג אסטרטגיה',
  createStrategy: 'יצירת אסטרטגיה', editStrategy: 'עריכת אסטרטגיה', saveStrategy: 'שמירת אסטרטגיה', createSetup: 'יצירת סטאפ', editSetup: 'עריכת סטאפ', saveSetup: 'שמירת סטאפ',
  strategyName: 'שם האסטרטגיה', setupName: 'שם הסטאפ', selectStrategy: 'בחירת אסטרטגיה', parentRequired: 'יש לבחור אסטרטגיית אב.', parentImmutable: 'לא ניתן להעביר סטאפ לאסטרטגיה אחרת לאחר היצירה.',
  nameRequired: 'יש להזין שם.', archive: 'העברה לארכיון', restore: 'שחזור', strategySaved: 'האסטרטגיה נשמרה.', setupSaved: 'הסטאפ נשמר.', saveFailed: 'לא ניתן לשמור את הסיווג המנוהל.',
  duplicateStrategy: 'כבר קיימת אסטרטגיה בשם הזה.', duplicateSetup: 'כבר קיים סטאפ בשם הזה באסטרטגיה.',
  noStrategies: 'עדיין אין אסטרטגיות מנוהלות', noStrategiesDetail: 'אפשר ליצור אסטרטגיה כדי להתחיל לנהל סיווגים חוזרים לעסקאות.', noSetups: 'עדיין אין סטאפים מנוהלים', noSetupsDetail: 'אפשר ליצור סטאפ בתוך האסטרטגיה כאשר דפוס הביצוע חוזר על עצמו.',
  closedTrades: 'עסקאות סגורות', openTrades: 'עסקאות פתוחות', outcomes: 'תוצאות', outcomeRecord: '{{winners}} ניצחונות / {{losers}} הפסדים / {{breakeven}} איזון', setupCount: 'סטאפ אחד', setupCount_other: '{{count}} סטאפים', closedCount: '{{count}} סגורות', tradeCount: 'עסקה אחת', tradeCount_other: '{{count}} עסקאות',
  legacyValues: 'ערכים היסטוריים שלא שויכו', legacyDetail: 'אלה ערכי טקסט שנשמרו בעסקאות ללא מזהה מנוהל. הם לקריאה בלבד ולעולם אינם משויכים אוטומטית.', legacyStrategies: 'ערכי אסטרטגיה היסטוריים', legacySetups: 'ערכי סטאפ היסטוריים', noLegacyValues: 'אין ערכים היסטוריים שלא שויכו.', unclassified: 'ללא סיווג',
  customLegacyValue: 'טקסט מותאם או היסטורי', hybridHelp: 'בחירה מנוהלת שומרת תמונת טקסט; עדיין אפשר להזין טקסט מותאם.', quickAddBoundary: 'בהוספה מהירה בחירת הסטאפ נשארת בטופס המלא.',
  loading: 'טוען אסטרטגיות וסטאפים', loadFailed: 'לא ניתן לטעון אסטרטגיות וסטאפים', loadFailedDetail: 'הסיווגים המנוהלים והביצועים שלהם אינם זמינים כרגע.', refreshFailed: 'לא ניתן לרענן את האסטרטגיות', staleVisible: 'הסיווגים האחרונים הזמינים נשארו מוצגים.', setupsLoadFailed: 'לא ניתן לטעון את הסטאפים', legacyLoadFailed: 'לא ניתן לטעון את הערכים ההיסטוריים', selectorLoadFailed: 'לא ניתן לטעון את הסיווגים המנוהלים', customStillAvailable: 'עדיין אפשר להשתמש בטקסט מותאם לאסטרטגיה ולסטאפ.',
});
Object.assign(he.trades.validation, { setupRequiresStrategy: 'סטאפ מנוהל דורש אסטרטגיה מנוהלת.' });
Object.assign(he.errors, { STRATEGY_NOT_FOUND: 'האסטרטגיה לא נמצאה.', SETUP_NOT_FOUND: 'הסטאפ לא נמצא.', STRATEGY_NAME_EXISTS: 'כבר קיימת אסטרטגיה בשם הזה.', SETUP_NAME_EXISTS: 'כבר קיים סטאפ בשם הזה באסטרטגיה.', STRATEGY_ARCHIVED: 'יש לבחור אסטרטגיה פעילה.', SETUP_ARCHIVED: 'יש לבחור סטאפ פעיל.', SETUP_REQUIRES_STRATEGY: 'סטאפ מנוהל דורש אסטרטגיה מנוהלת.', SETUP_STRATEGY_MISMATCH: 'הסטאפ אינו שייך לאסטרטגיה שנבחרה.' });

Object.assign(he.routes, {
  accountDetail: { title: 'פרטי החשבון', description: 'סקירת זהות החשבון, היתרה המחושבת, הביצועים והעסקאות האחרונות.' },
});
Object.assign(he.accounts, {
  accountName: 'שם החשבון', companyBroker: 'חברה או ברוקר', baseCurrency: 'מטבע בסיס', openingBalance: 'יתרת פתיחה',
  defaultAccount: 'חשבון ברירת מחדל', noDefault: 'לא הוגדר חשבון ברירת מחדל', setDefault: 'הגדרה כברירת מחדל', archive: 'העברת החשבון לארכיון', restore: 'שחזור החשבון',
  activeAccounts: 'חשבונות פעילים', archivedAccounts: 'חשבונות לא פעילים או בארכיון', inactiveArchivedAccounts: 'חשבונות לא פעילים ובארכיון', closedOpen: 'עסקאות סגורות / פתוחות', trackedBalance: 'יתרה מחושבת',
  trackedBalanceExplanation: 'יתרת הפתיחה בתוספת הרווח וההפסד הממומש שתועד ב־TradingLog. זו אינה יתרה חיה מהברוקר.',
  mixedCurrencyDetail: 'החשבונות משתמשים במספר מטבעות. הסכומים הכוללים אינם זמינים משום שלא מתבצעת המרת מטבע.',
  newAccountDialog: 'חשבון חדש', editAccount: 'עריכת חשבון', createAccount: 'יצירת חשבון', accountSaved: 'החשבון נשמר.',
  confirmLifecycle: 'אישור שינוי בחשבון', archiveConfirm: 'להעביר את {{name}} לארכיון? העסקאות והביצועים ההיסטוריים יישארו זמינים.',
  restoreConfirm: 'לשחזר את {{name}}? החשבון יהיה זמין לעסקאות חדשות, אך לא יהפוך אוטומטית לברירת המחדל.',
  activeAccount: 'חשבון פעיל', archivedAccount: 'חשבון בארכיון', lastTrade: 'עסקה אחרונה', balanceContext: 'הקשר היתרה', performance: 'ביצועים',
  closedTrades: 'עסקאות סגורות', openTrades: 'עסקאות פתוחות', winners: 'עסקאות מרוויחות', losers: 'עסקאות מפסידות', recentTrades: 'עסקאות אחרונות',
  viewAllTrades: 'הצגת כל עסקאות החשבון', recentTradesFailed: 'לא ניתן לטעון את העסקאות האחרונות', noTrades: 'אין עסקאות בחשבון הזה',
  noTradesDetail: 'יש לתעד עסקה בחשבון כדי להתחיל היסטוריית ביצועים.', createTrade: 'יצירת עסקה בחשבון הזה',
  loadingDetail: 'טוען את פרטי החשבון', notFound: 'החשבון לא נמצא', notFoundDetail: 'החשבון אינו זמין או שייך למשתמש אחר.',
  backToAccounts: 'חזרה לחשבונות', accountUpdated: 'החשבון עודכן.', saveFailed: 'לא ניתן לשמור את החשבון.', loadFailed: 'לא ניתן לטעון את החשבונות',
  loadFailedDetail: 'פרטי החשבונות והביצועים אינם זמינים כרגע.',
  validation: { companyRequired: 'יש להזין חברה או ברוקר.', numberRequired: 'יש להזין מספר חשבון.', currency: 'יש להזין קוד מטבע בן שלוש אותיות.', balance: 'יש להזין יתרת פתיחה תקינה.' },
});
Object.assign(he.analytics, {
  mixedCurrencies: 'מספר מטבעות', mixedCurrenciesDetail: 'הסכומים הכספיים אינם זמינים משום שהטווח כולל מספר מטבעות בסיס ו־TradingLog אינו מבצע המרת מטבע.'
});
Object.assign(he.errors, { ACCOUNT_NOT_ACTIVE: 'יש לבחור חשבון פעיל.', ACCOUNT_STATE_INVALID: 'מצב החשבון או המטבע אינם תקינים.', ACCOUNT_EXISTS: 'כבר קיים חשבון עם החברה ומספר החשבון האלה.' });

Object.assign(he.routes, { importRunDetail: { title: 'הרצת ייבוא', description: 'סקירת התוצאות השמורות של ייבוא עסקאות שאושר.' } });
he.importHistory = {
  title: 'היסטוריית ייבוא', privacy: 'בייבוא שאושר נשמרות רק תוצאות תפעוליות מוגבלות. הקובץ המקורי והשורות המלאות אינם נשמרים.',
  hashing: 'מחשב טביעת קובץ ומנתח…',
  loading: 'טוען היסטוריית ייבוא', loadFailed: 'לא ניתן לטעון את היסטוריית הייבוא.', empty: 'אין עדיין היסטוריית ייבוא.',
  viewDetails: 'צפייה בפרטים', viewPrevious: 'צפייה בייבוא הקודם', duplicateTitle: 'קובץ שכבר יובא',
  duplicateDetail: 'הקובץ הזה כבר יובא בעבר. הוספת העסקאות נחסמה.',
  imported: 'יובאו', skipped: 'דולגו', failed: 'נכשלו', importedRows: 'שורות שיובאו', skippedRows: 'שורות שדולגו', failedRows: 'שורות שנכשלו',
  loadingDetail: 'טוען הרצת ייבוא', notFound: 'הרצת הייבוא לא נמצאה', notFoundDetail: 'הרצת הייבוא אינה זמינה או שייכת למשתמש אחר.', back: 'חזרה לייבוא',
  noRawFile: 'הקובץ המקורי אינו נשמר ב־TradingLog.', sourceType: 'סוג מקור', fileSize: 'גודל קובץ', started: 'התחלה', completedAt: 'סיום', totalRows: 'סך הכול שורות',
  mapping: 'פרטי מיפוי בטוחים', rowResults: 'תוצאות שורות', rowFilters: 'סינון תוצאות שורות', linkedTrade: 'צפייה בעסקה המקושרת', tradeUnavailable: 'העסקה המקושרת אינה זמינה עוד.', unknownFailure: 'לא ניתן להשלים את הייבוא.',
  rowPagination: 'דפדוף בשורות הייבוא', previousRows: 'שורות קודמות', nextRows: 'שורות הבאות',
  noMatchingRows: 'אין תוצאות שורות התואמות למסנן הזה.',
  status: { processing: 'בתהליך', completed: 'הושלם', completed_with_errors: 'הושלם עם שגיאות', failed: 'נכשל' },
  rowStatus: { imported: 'יובאה', skipped_duplicate: 'דולגה ככפילות', failed_validation: 'נכשלה בבדיקה', failed_insert: 'נכשלה בהוספה' },
  filters: { all: 'הכול', imported: 'יובאו', skipped: 'דולגו', failed: 'נכשלו' },
  errors: { IMPORT_INVALID_FILE: 'קובץ המקור אינו תקין.', IMPORT_INVALID_MAPPING: 'מיפוי הייבוא אינו תקין.', IMPORT_FATAL_ERROR: 'הייבוא נכשל ושינויי העסקאות בוטלו.', IMPORT_NO_ROWS_IMPORTED: 'אף שורת מקור לא יצרה עסקה חדשה.', IMPORT_ROW_DUPLICATE: 'השורה תואמת לשורה אחרת או לעסקה קיימת.', IMPORT_ROW_VALIDATION_FAILED: 'השורה לא עברה את בדיקות העסקה.', IMPORT_ROW_INSERT_FAILED: 'השורה לא נוספה משום שהטרנזקציה בוטלה.' },
};
Object.assign(he.errors, { IMPORT_DUPLICATE_FILE: 'הקובץ הזה כבר יובא בעבר.', IMPORT_INVALID_FILE: 'הקובץ שנבחר אינו תקין.', IMPORT_INVALID_MAPPING: 'מיפוי הייבוא אינו תקין.', IMPORT_FATAL_ERROR: 'הייבוא נכשל ולא נשמרו שינויים בעסקאות.', IMPORT_ACCOUNT_NOT_FOUND: 'החשבון שנבחר לא נמצא.', IMPORT_ACCOUNT_ARCHIVED: 'יש לבחור חשבון פעיל לייבוא.' });

Object.assign(he.navigation, { system: 'מערכת', settings: 'הגדרות' });
Object.assign(he.routes, {
  settings: { title: 'הגדרות', description: 'ניהול שפה, מראה, אזור זמן וברירות מחדל למסחר.' },
});
he.settings = {
  language: 'שפה', languageDirection: 'שפה וכיוון', languageHelp: 'השינוי חל מיד בלי לטעון מחדש את העמוד.',
  appearance: 'מראה', appearanceHelp: 'אפשר להשתמש בהגדרת המכשיר או לבחור מראה בהיר או כהה.', theme: 'ערכת נושא',
  themeOptions: { system: 'לפי הגדרות המערכת', light: 'בהיר', dark: 'כהה' },
  timezone: 'אזור זמן', timezoneHelp: 'אזור הזמן קובע לאיזה יום משויכות עסקאות, רשומות יומן, בדיקות כללים, יעדים וסיכומים יומיים.',
  saveTimezone: 'שמירת אזור הזמן', timezoneUpdated: 'אזור הזמן עודכן.', invalidTimezone: 'יש להזין אזור זמן תקין מסוג IANA.', timezoneSaveFailed: 'לא ניתן לשמור את אזור הזמן.',
  tradingDefaults: 'ברירות מחדל למסחר', tradingDefaultsHelp: 'בחירות אלה משפיעות על פתיחות עתידיות של טופס העסקה ועל בחירת החשבון לעסקה חדשה.',
  defaultAccount: 'חשבון ברירת מחדל', applyDefaultAccount: 'החלת חשבון ברירת המחדל', defaultAccountUpdated: 'חשבון ברירת המחדל עודכן.', defaultAccountSaveFailed: 'לא ניתן לעדכן את חשבון ברירת המחדל.',
  accountsLoadFailed: 'לא ניתן לטעון את החשבונות.', noActiveAccounts: 'אין חשבונות פעילים', noActiveAccountsDetail: 'יש ליצור או לשחזר חשבון לפני בחירת ברירת מחדל.', manageAccounts: 'ניהול חשבונות',
  defaultTradeMode: 'מצב ברירת המחדל של טופס העסקה', tradeModeHelp: 'השינוי משפיע רק על הצגת השדות; נתוני העסקה והבדיקות אינם משתנים.',
  syncStatus: 'סנכרון העדפות', syncFailedDeviceOnly: 'שמירת ההעדפה בחשבון נכשלה. הבחירה נשמרה במכשיר הזה בלבד.',
  syncStates: { local: 'נעשה שימוש בהעדפות שנשמרו במכשיר הזה.', saving: 'ההעדפה נשמרת בחשבון…', synced: 'נשמר בכל המכשירים.', 'local-only': 'נשמר במכשיר הזה בלבד.' },
  loadFailed: 'לא ניתן לטעון את ההגדרות.', loadFailedDetail: 'העדפות החשבון אינן זמינות כרגע. השפה והמראה המקומיים נשארים זמינים.',
};

Object.assign(he.navigation, { investments: 'השקעות', portfolio: 'תיק השקעות' });
Object.assign(he.routes, {
  portfolio: { title: 'תיק השקעות', description: 'ניהול תיקי השקעות לטווח ארוך והערך המחושב שלהם בנפרד מהמסחר היומי.' },
  portfolioDetail: { title: 'פרטי תיק השקעות', description: 'סקירת אחזקות מחושבות, מזומן, פעולות ומחירים ידניים.' },
});
he.portfolio = {
  name: 'שם התיק', baseCurrency: 'מטבע בסיס', currency: 'מטבע', currencyHelp: 'כל הפעולות והמחירים בתיק משתמשים במטבע אחד. לא מתבצעת המרת מטבע.', currencyLockedHelp: 'לא ניתן לשנות את מטבע הבסיס לאחר שנרשמו פעולות.',
  createPortfolio: 'יצירת תיק השקעות', editPortfolio: 'עריכת תיק השקעות', saved: 'תיק ההשקעות נשמר.', saveFailed: 'לא ניתן לשמור את השינויים בתיק.', duplicate: 'כבר קיים תיק השקעות בשם הזה.',
  defaultPortfolio: 'תיק ברירת מחדל', setDefault: 'הגדרה כברירת מחדל', archive: 'העברת התיק לארכיון', restore: 'שחזור התיק', archiveConfirm: 'להעביר את „{{name}}” לארכיון? האחזקות והפעולות ההיסטוריות יישארו זמינות.', restoreConfirm: 'לשחזר את „{{name}}”? התיק לא יהפוך אוטומטית לברירת המחדל.', editNamed: 'עריכת {{name}}',
  loading: 'טעינת תיקי השקעות', loadingDetail: 'טעינת פרטי תיק ההשקעות', loadFailed: 'לא ניתן לטעון את תיקי ההשקעות', loadFailedDetail: 'תחום ההשקעות אינו זמין כרגע. נתוני המסחר היומי נשארו נפרדים וללא שינוי.', notFound: 'תיק ההשקעות לא נמצא', notFoundDetail: 'תיק ההשקעות אינו זמין או שייך למשתמש אחר.', back: 'חזרה לתיקי השקעות',
  empty: 'אין עדיין תיקי השקעות', emptyDetail: 'יש ליצור תיק כדי לעקוב אחר השקעות לטווח ארוך בנפרד מעסקאות המסחר היומי.', summary: 'סיכום תיק ההשקעות', activePortfolios: 'תיקים פעילים', archivedPortfolios: 'תיקים בארכיון', totalPositions: 'סך האחזקות', positions: 'אחזקות', position: 'אחזקה', transactions: 'פעולות',
  cashBalance: 'יתרת מזומן', netContributions: 'הפקדות נטו', averageCost: 'עלות ממוצעת', costBasis: 'בסיס עלות', marketValue: 'שווי שוק', totalValue: 'שווי כולל', totalReturn: 'תשואה כוללת', realizedPnl: 'רווח והפסד ממומש', unrealizedPnl: 'רווח והפסד לא ממומש', unrealizedReturn: 'תשואה לא ממומשת', dividendIncome: 'הכנסה מדיבידנדים',
  noFxConversion: 'אין המרת מטבע', totalUnavailable: 'סכום מלא אינו זמין עד שלכל אחזקה יהיה מחיר ידני.', valuationUnavailable: 'שווי התיק אינו מלא', valuationUnavailableDetail: 'לאחזקה אחת חסר מחיר ידני עדכני.', valuationUnavailableDetail_other: 'ל־{{count}} אחזקות חסר מחיר ידני עדכני.', missingPriceCount: 'חסר מחיר אחד', missingPriceCount_other: 'חסרים {{count}} מחירים',
  lastTransaction: 'פעולה אחרונה', totalInstrumentCount: 'ניירות ערך בשימוש', accountingBoundary: 'עלות ממוצעת משוקללת נעה היא שיטת מעקב של TradingLog. זה אינו חישוב לצורכי מס, והמחירים מוזנים ידנית ואינם נתוני שוק חיים.', weightedAverageNotice: 'מכירות משתמשות בעלות הממוצעת המשוקללת של האחזקה הזמינה. שינוי היסטורי בודק מחדש כל מכירה מאוחרת יותר.',
  instrument: 'נייר ערך', instrumentName: 'שם נייר הערך', exchange: 'בורסה', assetType: 'סוג נכס', createInstrument: 'יצירת נייר ערך', addInstrument: 'הוספת נייר ערך', editInstrument: 'עריכת נייר ערך', deactivateInstrument: 'השבתה', reactivateInstrument: 'הפעלה מחדש', instrumentLibrary: 'ספריית ניירות ערך', noInstruments: 'אין עדיין ניירות ערך', noInstrumentsDetail: 'יש להוסיף מניה או קרן סל במטבע של התיק.', instrumentSaved: 'נייר הערך נשמר.', duplicateInstrument: 'נייר הערך הזה כבר קיים.', instrumentsLoadFailed: 'לא ניתן לטעון את ניירות הערך.', chooseInstrument: 'בחירת נייר ערך', noInstrument: 'ללא נייר ערך מסוים', optionalInstrument: 'בחירה אופציונלית לעמלה נפרדת.', instrumentCurrencyHelp: 'מטבע נייר הערך חייב להתאים למטבע הבסיס של התיק.',
  assetTypes: { stock: 'מניה', etf: 'קרן סל' },
  addTransaction: 'הוספת פעולה', editTransaction: 'עריכת פעולה', deleteTransaction: 'מחיקת פעולה', transactionSaved: 'הפעולה נשמרה.', transactionDeleted: 'הפעולה נמחקה.', deleteFailed: 'לא ניתן למחוק את הפעולה.', deleteConfirm: 'למחוק את הפעולה? כל האחזקות המאוחרות יותר ייבדקו מחדש לפני אישור השינוי.', transactionType: 'סוג פעולה', transactionTypes: { buy: 'קנייה', sell: 'מכירה', dividend: 'דיבידנד', fee: 'עמלה', deposit: 'הפקדה', withdrawal: 'משיכה' },
  price: 'מחיר', amount: 'סכום', value: 'שווי', manualPrice: 'מחיר ידני', priceDate: 'תאריך מחיר', updatePrice: 'עדכון מחיר', updateManualPrice: 'עדכון מחיר ידני', saveManualPrice: 'שמירת מחיר ידני', manualPriceNotice: 'זהו מחיר שהוזן ידנית ואינו ציטוט שוק חי.', priceSaved: 'המחיר הידני נשמר.',
  noPositions: 'אין אחזקות נוכחיות', noPositionsDetail: 'יש להוסיף הפקדה ופעולת קנייה כדי ליצור אחזקה מחושבת.', noTransactions: 'אין עדיין פעולות', noTransactionsDetail: 'יש לתעד הפקדה ולאחר מכן קנייה, מכירה, דיבידנד, עמלה או משיכה.',
  errors: { PORTFOLIO_INSUFFICIENT_HOLDINGS: 'כמות המכירה גדולה מהכמות הזמינה בנקודה הכרונולוגית הזאת.', PORTFOLIO_INSUFFICIENT_CASH: 'הפעולה תגרום ליתרת מזומן שלילית בתיק.', PORTFOLIO_ARCHIVED: 'לא ניתן להוסיף פעולות לתיק בארכיון או להגדיר אותו כברירת מחדל.', PORTFOLIO_CURRENCY_MISMATCH: 'התיק, נייר הערך והמחיר הידני חייבים להשתמש באותו מטבע.', PORTFOLIO_CURRENCY_IMMUTABLE: 'לא ניתן לשנות את מטבע הבסיס לאחר שנרשמו פעולות.', PORTFOLIO_NAME_EXISTS: 'כבר קיים תיק השקעות בשם הזה.', INVESTMENT_INSTRUMENT_EXISTS: 'נייר הערך הזה כבר קיים.', INVESTMENT_INSTRUMENT_IDENTITY_IMMUTABLE: 'לא ניתן לשנות את זהות נייר הערך לאחר שנרשמו פעולות.', PORTFOLIO_INTEGRITY_ERROR: 'רשומת ההשקעה נכשלה בבדיקת בעלות, מטבע או מבנה.' },
  validation: { nameRequired: 'יש להזין שם לתיק.', currency: 'יש להזין קוד מטבע ISO בן שלוש אותיות.', symbol: 'יש להזין סימול שוק תקין.', instrumentRequired: 'יש לבחור נייר ערך.', positive: 'יש להזין ערך גדול מאפס.' },
};

Object.assign(he.errors, {
  unexpectedTitle: 'לא ניתן להציג את העמוד ב־TradingLog',
  unexpectedDetail: 'אירעה שגיאת תצוגה בלתי צפויה. אפשר לטעון מחדש את העמוד כדי להתאושש בבטחה.',
  reloadPage: 'טעינה מחדש של העמוד',
  IMPORT_FILE_TOO_LARGE: 'קובץ CSV חייב להיות בגודל של עד 5 MB.',
});

export default he;

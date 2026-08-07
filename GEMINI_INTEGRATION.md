# على الطاير × Gemini

## القرار المعماري

لا يوضع `GEMINI_API_KEY` في `index.html` أو `app.js` أو أي ملف منشور على GitHub Pages.

المسار المعتمد:

`مسراح في المتصفح → Firebase HTTPS Function → Gemini API → أوامر منظمة → مسراح / Google Calendar / Gmail`

## نموذج الأوامر

Gemini يعيد أمرًا منظمًا، وليس نصًا حرًا فقط.

```json
{
  "intent": "create_task | create_calendar_event | create_followup | draft_email | update_task | query_day",
  "title": "",
  "date": "YYYY-MM-DD",
  "time": "HH:mm",
  "duration_minutes": 60,
  "person": "",
  "space": "",
  "followup_date": "YYYY-MM-DD",
  "priority": "normal | important | strategic",
  "notes": "",
  "requires_confirmation": true
}
```

## أمثلة

### مهمة
`بكرة تابع مع محمد عن عرض الاستثمار`

→ `create_followup`

### موعد
`الخميس الساعة 11 اجتماع مع عبدالله في الجمعية وذكرني قبلها بساعتين`

→ `create_calendar_event` + مهمة مرتبطة في مسراح.

### بريد
`جهز لمحمد بريد بكرة عن الاستثمار`

→ `draft_email`

في المرحلة الأولى ينشئ Gmail Draft ولا يرسل الرسالة تلقائيًا.

## أدوات Gemini المقترحة

- `createTask`
- `updateTask`
- `createFollowup`
- `createCalendarEvent`
- `draftGmailMessage`
- `getTodayAgenda`
- `findPerson`
- `findSpace`

## التأكيد

الأوامر التي تغير موعدًا قائمًا أو تحذف أو ترسل رسالة تحتاج تأكيد المستخدم.
إضافة مهمة بسيطة يمكن تنفيذها مباشرة بعد ارتفاع موثوقية النظام.

## المرحلة التالية

1. Firebase Authentication.
2. Firestore: مخزن مستقل لكل مستخدم.
3. HTTPS Function باسم `mesraahAssistant`.
4. حفظ مفتاح Gemini في Firebase Secret Manager.
5. Google OAuth بصلاحيات Calendar وGmail المطلوبة فقط.
6. استبدال محلل `parseFly` المحلي بطلب إلى `mesraahAssistant` مع fallback محلي عند تعذر الشبكة.

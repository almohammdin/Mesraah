# Mesraah Native Live token worker

هذا Worker يصدر Ephemeral Token قصير العمر فقط. الصوت لا يمر عبر Cloudflare؛ المتصفح يتصل مباشرة بـ Gemini Live بعد استلام الرمز.

## الحماية

- يقبل الطلبات من `https://almohammdin.github.io` فقط.
- يتطلب `X-Firebase-AppCheck` صالحا لمشروع Mesraah.
- يتحقق من توقيع App Check عبر JWKS الرسمي، والمصدر، والجمهور، والانتهاء وApp ID.
- مفتاح Gemini محفوظ كـ Cloudflare Secret باسم `GEMINI_API_KEY` ولا يوضع في GitHub.
- الرمز الناتج استخدام واحد، ويسمح ببدء جلسة جديدة خلال 60 ثانية، وينتهي خلال 30 دقيقة.
- الرمز مقيد بـ `gemini-3.1-flash-live-preview` وبإخراج AUDIO.

## النشر

من مجلد `cloudflare`:

```bash
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

بعد النشر سيكون endpoint بالشكل:

```text
https://mesraah-live-token.<account-subdomain>.workers.dev/token
```

يوضع هذا العنوان في إعداد `MESRAAH_NATIVE_LIVE_TOKEN_ENDPOINT` قبل دمج فرع `native-live-v0.9.0` إلى `main`.

## ملاحظة

النسخة العامة v0.8.7 تبقى كما هي حتى ينجح اختبار Native Live على فرع التطوير.

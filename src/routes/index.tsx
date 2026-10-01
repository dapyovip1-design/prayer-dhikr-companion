import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Qibla } from "adhan";
import { ADHKAR_DATA, DUAS_DATA, TASBEEH_LIST } from "@/lib/adhkar-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أذكار الحصن — مواقيت الصلاة والأذكار" },
      { name: "description", content: "مواقيت الصلاة حسب موقعك، تنبيهات الأذان والأذكار، وتلاوة صوتية للأذكار والأدعية مع مسبحة إلكترونية." },
      { property: "og:title", content: "أذكار الحصن — مواقيت الصلاة والأذكار" },
      { property: "og:description", content: "مواقيت دقيقة، تنبيهات، أذكار الصباح والمساء بتلاوة صوتية، ومسبحة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: App,
});

type Tab = "prayer" | "adhkar" | "tasbeeh" | "duas" | "settings";
const PRAYERS = [
  { key: "fajr", ar: "الفجر" },
  { key: "sunrise", ar: "الشروق" },
  { key: "dhuhr", ar: "الظهر" },
  { key: "asr", ar: "العصر" },
  { key: "maghrib", ar: "المغرب" },
  { key: "isha", ar: "العشاء" },
] as const;
const METHODS: Record<string, string> = {
  Egyptian: "الهيئة المصرية العامة للمساحة",
  UmmAlQura: "أم القرى - مكة",
  MuslimWorldLeague: "رابطة العالم الإسلامي",
  Karachi: "جامعة العلوم الإسلامية - كراتشي",
  Dubai: "دبي",
  Kuwait: "الكويت",
  Qatar: "قطر",
  NorthAmerica: "أمريكا الشمالية (ISNA)",
  Turkey: "تركيا",
};
const CATS = [
  { key: "morning", ar: "أذكار الصباح" },
  { key: "evening", ar: "أذكار المساء" },
  { key: "sleep", ar: "أذكار النوم" },
];
const TABS: Tab[] = ["prayer", "adhkar", "tasbeeh", "duas", "settings"];
const HISN_AUDIO = "/audio/adhkar";
const ADHAN_AUDIO = "/audio/adhan/adhan.mp3";
const ADHKAR_AUDIO: Record<string, Record<string, string>> = {
  morning: { m1: "69", m2: "78", m3: "79", m4: "87", m5: "82", m6: "82", m7: "83", m8: "86", m9: "94", m10: "95" },
  evening: { e1: "69", e2: "78", e3: "79", e4: "87", e5: "80", e6: "83", e7: "86", e8: "216" },
  sleep: { s1: "102", s2: "103", s3: "104", s4: "105", s5: "91" },
};
const DUA_AUDIO = [
  "/audio/duas/2-201.mp3",
  "/audio/duas/3-8.mp3",
  `${HISN_AUDIO}/79.mp3`,
  `${HISN_AUDIO}/120.mp3`,
  `${HISN_AUDIO}/136.mp3`,
  `${HISN_AUDIO}/122.mp3`,
  null,
  "/audio/duas/14-40.mp3",
];

type Lang = "ar" | "en" | "hi";
const LANGS: { k: Lang; label: string }[] = [{ k: "ar", label: "العربية" }, { k: "en", label: "English" }, { k: "hi", label: "हिन्दी" }];
const LOCALE: Record<Lang, string> = { ar: "ar-EG", en: "en-US", hi: "hi-IN" };
const PRAYER_NAMES: Record<Lang, Record<string, string>> = {
  ar: { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" },
  en: { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" },
  hi: { fajr: "फ़ज्र", sunrise: "सूर्योदय", dhuhr: "ज़ुहर", asr: "अस्र", maghrib: "मग़रिब", isha: "ईशा" },
};
const METHODS_EN: Record<string, string> = {
  Egyptian: "Egyptian General Authority of Survey", UmmAlQura: "Umm al-Qura, Makkah", MuslimWorldLeague: "Muslim World League",
  Karachi: "University of Islamic Sciences, Karachi", Dubai: "Dubai", Kuwait: "Kuwait", Qatar: "Qatar", NorthAmerica: "North America (ISNA)", Turkey: "Turkey",
};
const DICT = {
  ar: {
    appName: "أذكار الحصن", next: "الصلاة القادمة", locating: "جارٍ تحديد موقعك...", locUnsupported: "المتصفح لا يدعم تحديد الموقع", locFail: "تعذّر تحديد الموقع. يرجى السماح بالوصول للموقع.",
    needLoc: "نحتاج موقعك لحساب المواقيت بدقة", locate: "تحديد الموقع", upcoming: "القادمة", qibla: "اتجاه القبلة", fromNorth: "من الشمال", method: "طريقة الحساب", hanafi: "حنفي", jumhur: "جمهور",
    tabs: ["المواقيت", "الأذكار", "المسبحة", "الأدعية", "الإعدادات"], cats: { morning: "أذكار الصباح", evening: "أذكار المساء", sleep: "أذكار النوم" },
    noAudio: "لا يتوفر تسجيل بشري لهذا الذكر حالياً", audioFail: "تعذّر تشغيل التسجيل. تحقق من اتصال الإنترنت.", stop: "إيقاف", playAll: "تلاوة الكل", listen: "استماع", done: "تم", reset: "إعادة تعيين التقدّم",
    total: "الإجمالي", zero: "تصفير", search: "ابحث في الأدعية...", noRec: "لا يوجد تسجيل", recUnavailable: "التسجيل البشري غير متاح حالياً", copy: "نسخ",
    location: "الموقع", notSet: "غير محدد", update: "تحديث", hanafiAsr: "العصر حسب المذهب الحنفي", browserNotif: "إشعارات المتصفح", enabled: "مفعّلة ✓", unsupported: "غير مدعومة", enable: "تفعيل",
    adhanAlert: "تنبيه الأذان", before: "تذكير قبل الصلاة", minutes: (m: number) => `${m} دقيقة`, none: "بدون", adhkarAlert: "تذكير الأذكار (صباح/مساء/نوم)", testAlert: "تجربة التنبيه", test: "تجربة",
    testTitle: "تجربة", testBody: "هكذا سيظهر التنبيه", recitations: "التلاوات", recitationsDesc: "صوت بشري مسجّل، والآيات بصوت الشيخ مشاري العفاسي", dark: "الوضع الليلي", language: "اللغة",
    note: "تعمل التنبيهات أثناء فتح التطبيق في المتصفح.", soon: (p: string) => `اقتربت صلاة ${p}`, inMin: (m: number) => `بعد ${m} دقيقة`, time: (p: string) => `حان وقت صلاة ${p}`,
    morningBody: "حان وقت أذكار الصباح", eveningBody: "حان وقت أذكار المساء", sleepBody: "لا تنسَ أذكار النوم", toggle: "تبديل الوضع", tasbeeh: "تسبيح",
  },
  en: {
    appName: "Hisn Adhkar", next: "Next prayer", locating: "Detecting your location...", locUnsupported: "Your browser doesn't support location", locFail: "Couldn't get your location. Please allow location access.",
    needLoc: "We need your location to calculate accurate prayer times", locate: "Detect location", upcoming: "Next", qibla: "Qibla direction", fromNorth: "from North", method: "Calculation method", hanafi: "Hanafi", jumhur: "Standard",
    tabs: ["Prayers", "Adhkar", "Tasbeeh", "Duas", "Settings"], cats: { morning: "Morning Adhkar", evening: "Evening Adhkar", sleep: "Sleep Adhkar" },
    noAudio: "No human recording is available for this dhikr yet", audioFail: "Couldn't play the recording. Check your internet connection.", stop: "Stop", playAll: "Play all", listen: "Listen", done: "Done", reset: "Reset progress",
    total: "Total", zero: "Reset", search: "Search duas...", noRec: "No recording", recUnavailable: "Human recording not available yet", copy: "Copy",
    location: "Location", notSet: "Not set", update: "Update", hanafiAsr: "Asr by Hanafi school", browserNotif: "Browser notifications", enabled: "Enabled ✓", unsupported: "Unsupported", enable: "Enable",
    adhanAlert: "Adhan alert", before: "Reminder before prayer", minutes: (m: number) => `${m} min`, none: "Off", adhkarAlert: "Adhkar reminders (morning/evening/sleep)", testAlert: "Test alert", test: "Test",
    testTitle: "Test", testBody: "This is how the alert will look", recitations: "Recitations", recitationsDesc: "Recorded human voice; verses by Sheikh Mishary Alafasy", dark: "Dark mode", language: "Language",
    note: "Alerts work while the app is open in your browser.", soon: (p: string) => `${p} prayer is approaching`, inMin: (m: number) => `In ${m} minutes`, time: (p: string) => `It's time for ${p} prayer`,
    morningBody: "Time for morning adhkar", eveningBody: "Time for evening adhkar", sleepBody: "Don't forget your sleep adhkar", toggle: "Toggle theme", tasbeeh: "Tasbeeh",
  },
  hi: {
    appName: "हिस्न अज़कार", next: "अगली नमाज़", locating: "आपकी लोकेशन ढूँढी जा रही है...", locUnsupported: "आपका ब्राउज़र लोकेशन सपोर्ट नहीं करता", locFail: "लोकेशन नहीं मिल सकी। कृपया लोकेशन की अनुमति दें।",
    needLoc: "सही नमाज़ के समय के लिए आपकी लोकेशन चाहिए", locate: "लोकेशन पता करें", upcoming: "अगली", qibla: "क़िबला की दिशा", fromNorth: "उत्तर से", method: "गणना का तरीका", hanafi: "हनफ़ी", jumhur: "सामान्य",
    tabs: ["नमाज़", "अज़कार", "तस्बीह", "दुआएँ", "सेटिंग्स"], cats: { morning: "सुबह के अज़कार", evening: "शाम के अज़कार", sleep: "सोने के अज़कार" },
    noAudio: "इस ज़िक्र की मानव रिकॉर्डिंग अभी उपलब्ध नहीं है", audioFail: "रिकॉर्डिंग नहीं चल सकी। इंटरनेट कनेक्शन जाँचें।", stop: "रोकें", playAll: "सभी सुनें", listen: "सुनें", done: "पूरा", reset: "प्रगति रीसेट करें",
    total: "कुल", zero: "रीसेट", search: "दुआएँ खोजें...", noRec: "रिकॉर्डिंग नहीं", recUnavailable: "मानव रिकॉर्डिंग अभी उपलब्ध नहीं", copy: "कॉपी",
    location: "लोकेशन", notSet: "तय नहीं", update: "अपडेट", hanafiAsr: "हनफ़ी मसलक के अनुसार अस्र", browserNotif: "ब्राउज़र सूचनाएँ", enabled: "चालू ✓", unsupported: "समर्थित नहीं", enable: "चालू करें",
    adhanAlert: "अज़ान अलर्ट", before: "नमाज़ से पहले याद दिलाएँ", minutes: (m: number) => `${m} मिनट`, none: "बंद", adhkarAlert: "अज़कार रिमाइंडर (सुबह/शाम/सोना)", testAlert: "अलर्ट जाँचें", test: "जाँचें",
    testTitle: "जाँच", testBody: "अलर्ट ऐसा दिखेगा", recitations: "तिलावत", recitationsDesc: "रिकॉर्ड की गई मानव आवाज़; आयतें शेख़ मिशारी अल-अफ़ासी की आवाज़ में", dark: "डार्क मोड", language: "भाषा",
    note: "अलर्ट तभी काम करते हैं जब ऐप ब्राउज़र में खुला हो।", soon: (p: string) => `${p} की नमाज़ क़रीब है`, inMin: (m: number) => `${m} मिनट में`, time: (p: string) => `${p} की नमाज़ का समय हो गया`,
    morningBody: "सुबह के अज़कार का समय", eveningBody: "शाम के अज़कार का समय", sleepBody: "सोने के अज़कार न भूलें", toggle: "थीम बदलें", tasbeeh: "तस्बीह",
  },
};
type Dict = typeof DICT.ar;
const LangCtx = createContext<{ lang: Lang; t: Dict }>({ lang: "ar", t: DICT.ar });
const useT = () => useContext(LangCtx);
const pName = (lang: Lang, key: string): string => PRAYER_NAMES[lang][key] ?? key;

type Settings = {
  lat?: number; lng?: number; city?: string;
  method: string; hanafi: boolean;
  notifyPrayer: boolean; notifyAdhkar: boolean; before: number;
  dark: boolean; lang: Lang;
};
const DEFAULT: Settings = { method: "Egyptian", hanafi: false, notifyPrayer: true, notifyAdhkar: true, before: 0, dark: false, lang: "ar" };

function useStored<T>(key: string, init: T) {
  const [v, setV] = useState<T>(init);
  const loaded = useRef(false);
  useEffect(() => {
    try { const s = localStorage.getItem(key); if (s) setV({ ...(init as object), ...JSON.parse(s) } as T); } catch {}
    loaded.current = true;
  }, []); // eslint-disable-line
  useEffect(() => { if (loaded.current) localStorage.setItem(key, JSON.stringify(v)); }, [key, v]);
  return [v, setV] as const;
}

let curLocale = "ar-EG";
const fmt = (d: Date) => d.toLocaleTimeString(curLocale, { hour: "numeric", minute: "2-digit" });

let activeAudio: HTMLAudioElement | null = null;
function stopAudio() {
  activeAudio?.pause();
  if (activeAudio) activeAudio.currentTime = 0;
  activeAudio = null;
}

function playAudio(source: string, onEnd?: () => void, onError?: () => void) {
  if (typeof Audio === "undefined") return;
  stopAudio();
  const audio = new Audio(source);
  activeAudio = audio;
  audio.preload = "auto";
  audio.onended = () => { if (activeAudio === audio) activeAudio = null; onEnd?.(); };
  audio.onerror = () => { if (activeAudio === audio) activeAudio = null; onError?.(); };
  void audio.play().catch(() => { if (activeAudio === audio) activeAudio = null; onError?.(); });
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.5, 1].forEach((t, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = i === 2 ? 880 : 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.45);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.5);
    });
  } catch {}
}

function notify(title: string, body: string, audioSource: string) {
  beep();
  if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "/favicon.ico" });
  setTimeout(() => playAudio(audioSource), 1600);
}

function App() {
  const [tab, setTab] = useState<Tab>("prayer");
  const [s, setS] = useStored<Settings>("hisn_settings", DEFAULT);
  const [now, setNow] = useState<Date | null>(null);
  const [locErr, setLocErr] = useState("");
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { setNow(new Date()); const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  useEffect(() => { document.documentElement.classList.toggle("dark", s.dark); }, [s.dark]);
  const lang: Lang = (DICT as any)[s.lang] ? s.lang : "ar";
  const t = DICT[lang];
  curLocale = LOCALE[lang];
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr"; }, [lang]);

  const locate = () => {
    setLocErr("");
    if (!navigator.geolocation) return setLocErr(t.locUnsupported);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        let city = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${lang}&zoom=10`);
          const j = await r.json();
          city = j.address?.city || j.address?.town || j.address?.state || city;
        } catch {}
        setS((o) => ({ ...o, lat, lng, city }));
      },
      () => setLocErr(t.locFail),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };
  useEffect(() => { if (now && s.lat === undefined) locate(); }, [!!now]); // eslint-disable-line

  const dayKey = now ? now.toDateString() : "";
  const times = useMemo(() => {
    if (s.lat === undefined || s.lng === undefined || !now) return null;
    const coords = new Coordinates(s.lat, s.lng);
    const params = (CalculationMethod as any)[s.method]();
    params.madhab = s.hanafi ? Madhab.Hanafi : Madhab.Shafi;
    const today = new PrayerTimes(coords, now, params);
    const tomorrow = new PrayerTimes(coords, new Date(now.getTime() + 864e5), params);
    return { today, tomorrow, qibla: Qibla(coords) };
  }, [s.lat, s.lng, s.method, s.hanafi, dayKey]); // eslint-disable-line

  // schedule alerts
  useEffect(() => {
    if (!times) return;
    const timers: number[] = [];
    const at = (d: Date, fn: () => void) => { const ms = d.getTime() - Date.now(); if (ms > 0 && ms < 2 ** 31) timers.push(window.setTimeout(fn, ms)); };
    const all = [times.today, times.tomorrow];
    for (const pt of all) {
      if (s.notifyPrayer) for (const p of PRAYERS) {
        if (p.key === "sunrise") continue;
        const tm = (pt as any)[p.key] as Date;
        const n = pName(lang, p.key);
        if (s.before > 0) at(new Date(tm.getTime() - s.before * 60000), () => notify(t.soon(n), t.inMin(s.before), ADHAN_AUDIO));
        at(tm, () => notify(t.time(n), `${s.city ?? ""} — ${fmt(tm)}`, ADHAN_AUDIO));
      }
      if (s.notifyAdhkar) {
        at(new Date(pt.sunrise.getTime() - 20 * 60000), () => notify(t.cats.morning, t.morningBody, `${HISN_AUDIO}/69.mp3`));
        at(new Date(pt.asr.getTime() + 15 * 60000), () => notify(t.cats.evening, t.eveningBody, `${HISN_AUDIO}/69.mp3`));
        at(new Date(pt.isha.getTime() + 90 * 60000), () => notify(t.cats.sleep, t.sleepBody, `${HISN_AUDIO}/102.mp3`));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [times, s.notifyPrayer, s.notifyAdhkar, s.before, s.city, lang]); // eslint-disable-line

  const changeTabBySwipe = (direction: "left" | "right") => {
    const current = TABS.indexOf(tab);
    const nextIndex = direction === "left" ? current + 1 : current - 1;
    const nextTab = TABS[nextIndex];
    if (nextTab) { stopAudio(); setTab(nextTab); }
  };

  let next: { ar: string; t: Date } | null = null;
  if (times && now) {
    for (const p of PRAYERS) { const pt = (times.today as any)[p.key] as Date; if (p.key !== "sunrise" && pt > now) { next = { ar: pName(lang, p.key), t: pt }; break; } }
    if (!next) next = { ar: pName(lang, "fajr"), t: times.tomorrow.fajr };
  }
  const left = next && now ? Math.max(0, next.t.getTime() - now.getTime()) : 0;
  const cd = `${String(Math.floor(left / 36e5)).padStart(2, "0")}:${String(Math.floor((left % 36e5) / 6e4)).padStart(2, "0")}:${String(Math.floor((left % 6e4) / 1e3)).padStart(2, "0")}`;
  const hijri = now ? new Intl.DateTimeFormat(`${lang === "ar" ? "ar-SA" : lang}-u-ca-islamic`, { day: "numeric", month: "long", year: "numeric" }).format(now) : "";

  return (
    <LangCtx.Provider value={{ lang, t }}>
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-hero-from to-hero-to p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">{t.appName}</h1>
            <p className="text-xs opacity-80">{hijri}</p>
          </div>
          <button onClick={() => setS((o) => ({ ...o, dark: !o.dark }))} className="rounded-full bg-background/15 px-3 py-1.5 text-sm" aria-label={t.toggle}>{s.dark ? "☀️" : "🌙"}</button>
        </div>
        <div className="mt-4 rounded-2xl bg-background/10 p-4 text-center backdrop-blur">
          {next ? (<>
            <p className="text-sm opacity-90">{t.next}: <b>{next.ar}</b> — {fmt(next.t)}</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-wider" dir="ltr">{cd}</p>
            <p className="mt-1 text-xs opacity-80">📍 {s.city}</p>
          </>) : <p className="text-sm">{locErr || t.locating}</p>}
        </div>
      </header>

      <main
        className="flex-1 touch-pan-y p-4"
        onTouchStart={(event) => {
          if ((event.target as HTMLElement).closest("select,input,textarea")) { touchStart.current = null; return; }
          const touch = event.changedTouches[0];
          if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          const touch = event.changedTouches[0];
          touchStart.current = null;
          if (!start || !touch) return;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
          changeTabBySwipe(dx < 0 ? "left" : "right");
        }}
      >
        {tab === "prayer" && <PrayerTab times={times} now={now} s={s} locate={locate} locErr={locErr} />}
        {tab === "adhkar" && <AdhkarTab />}
        {tab === "tasbeeh" && <TasbeehTab />}
        {tab === "duas" && <DuasTab />}
        {tab === "settings" && <SettingsTab s={s} setS={setS} locate={locate} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-md justify-around border-t bg-card/95 py-2 backdrop-blur">
        {(["🕌", "📖", "📿", "🤲", "⚙️"] as const).map((i, idx) => { const k = TABS[idx]; const l = t.tabs[idx]; return (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center rounded-xl px-3 py-1 text-[11px] font-semibold ${tab === k ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
            <span className="text-lg">{i}</span>{l}
          </button>
        ); })}
      </nav>
    </div>
    </LangCtx.Provider>
  );
}

function PrayerTab({ times, now, s, locate, locErr }: any) {
  const { lang, t } = useT();
  if (!times) return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <p className="mb-3 text-muted-foreground">{locErr || t.needLoc}</p>
      <button onClick={locate} className="rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground">{t.locate}</button>
    </div>
  );
  let nextKey = "";
  for (const p of PRAYERS) if (p.key !== "sunrise" && times.today[p.key] > now) { nextKey = p.key; break; }
  return (
    <div className="space-y-2">
      {PRAYERS.map((p) => {
        const tm: Date = times.today[p.key]; const past = tm < now; const isNext = p.key === nextKey;
        return (
          <div key={p.key} className={`flex items-center justify-between rounded-2xl border p-4 ${isNext ? "border-primary bg-secondary" : "bg-card"} ${past && !isNext ? "opacity-60" : ""}`}>
            <span className="font-bold">{pName(lang, p.key)}{isNext && <span className="mx-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{t.upcoming}</span>}</span>
            <span className="font-mono text-lg font-semibold">{fmt(tm)}</span>
          </div>
        );
      })}
      <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-4">
        <div><p className="font-bold">{t.qibla}</p><p className="text-xs text-muted-foreground">{Math.round(times.qibla)}° {t.fromNorth}</p></div>
        <div className="relative h-14 w-14 rounded-full border-2 border-primary">
          <span className="absolute inset-0 flex items-start justify-center text-xl" style={{ transform: `rotate(${times.qibla}deg)` }}>🕋</span>
        </div>
      </div>
      <p className="pt-2 text-center text-xs text-muted-foreground">{t.method}: {(lang === "ar" ? METHODS : METHODS_EN)[s.method]} · {s.hanafi ? t.hanafi : t.jumhur}</p>
    </div>
  );
}

function AdhkarTab() {
  const { lang, t } = useT();
  const [cat, setCat] = useState("morning");
  const [prog, setProg] = useStored<Record<string, number>>("hisn_prog", {});
  const [playing, setPlaying] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const list: any[] = ADHKAR_DATA[cat] || [];
  const done = list.filter((d) => (prog[`${cat}_${d.id}`] || 0) >= d.count).length;
  const [audioError, setAudioError] = useState("");
  useEffect(() => () => stopAudio(), []);

  const play = (i: number, chain: boolean) => {
    const d = list[i]; if (!d) { setPlaying(null); setAuto(false); return; }
    const audioId = ADHKAR_AUDIO[cat]?.[d.id];
    if (!audioId) { setAudioError(t.noAudio); setPlaying(null); setAuto(false); return; }
    setAudioError("");
    setPlaying(d.id);
    playAudio(`${HISN_AUDIO}/${audioId}.mp3`, () => chain ? play(i + 1, true) : setPlaying(null), () => { setPlaying(null); setAuto(false); setAudioError(t.audioFail); });
  };
  const stop = () => { stopAudio(); setPlaying(null); setAuto(false); };

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {CATS.map((c) => <button key={c.key} onClick={() => { stop(); setCat(c.key); }} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${cat === c.key ? "bg-primary text-primary-foreground" : "bg-card border"}`}>{(t.cats as any)[c.key]}</button>)}
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} /></div>
        <span className="text-xs font-bold">{done}/{list.length}</span>
        <button onClick={() => auto ? stop() : (setAuto(true), play(0, true))} className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{auto ? `⏹ ${t.stop}` : `▶ ${t.playAll}`}</button>
      </div>
      {audioError && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{audioError}</p>}
      <div className="space-y-3">
        {list.map((d, i) => {
          const k = `${cat}_${d.id}`; const c = prog[k] || 0; const fin = c >= d.count;
          return (
            <div key={d.id} className={`rounded-2xl border p-4 ${playing === d.id ? "border-accent ring-2 ring-accent/40" : ""} ${fin ? "bg-secondary" : "bg-card"}`}>
              <p className="text-lg leading-loose" dir="rtl" lang="ar">{d.textAr}</p>
              {lang !== "ar" && d.transliterationEn && <p className="mt-2 text-sm italic text-muted-foreground" dir="ltr">{d.transliterationEn}</p>}
              {lang !== "ar" && d.textEn && <p className="mt-2 text-sm" dir="ltr">{d.textEn}</p>}
              {(lang === "ar" ? d.virtueAr : d.virtueEn) && <p className="mt-2 text-xs text-muted-foreground">✨ {lang === "ar" ? d.virtueAr : d.virtueEn}</p>}
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => playing === d.id ? stop() : play(i, false)} className="rounded-full border px-3 py-1 text-sm">{playing === d.id ? `⏸ ${t.stop}` : `🔊 ${t.listen}`}</button>
                <button disabled={fin} onClick={() => setProg((p) => ({ ...p, [k]: c + 1 }))} className={`min-w-24 rounded-xl px-4 py-2 font-bold ${fin ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground active:scale-95"}`}>{fin ? `✓ ${t.done}` : `${c} / ${d.count}`}</button>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setProg((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(cat + "_"))))} className="mt-4 w-full rounded-xl border py-2 text-sm text-muted-foreground">{t.reset}</button>
    </div>
  );
}

function TasbeehTab() {
  const { lang, t } = useT();
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useStored<{ count: number; total: number }>("hisn_tasbeeh", { count: 0, total: 0 });
  const d = TASBEEH_LIST[idx]; const pct = Math.min(1, st.count / d.target); const C = 527.7;
  const tap = () => { setSt((o) => ({ count: o.count + 1, total: o.total + 1 })); if (st.count + 1 === d.target) navigator.vibrate?.(200); else navigator.vibrate?.(15); };
  return (
    <div className="text-center">
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {TASBEEH_LIST.map((x: any, i: number) => <button key={i} onClick={() => { setIdx(i); setSt((o) => ({ ...o, count: 0 })); }} className={`rounded-full px-3 py-1 text-xs font-bold ${i === idx ? "bg-primary text-primary-foreground" : "border bg-card"}`}>{lang === "ar" ? x.textAr : x.textEn}</button>)}
      </div>
      <p className="mb-1 text-xl font-bold" dir="rtl">{d.textAr}</p>
      {lang !== "ar" && <p className="mb-4 text-sm text-muted-foreground">{d.textEn}</p>}
      <button onClick={tap} className="relative mx-auto block h-52 w-52 rounded-full active:scale-95 transition" aria-label={t.tasbeeh}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200"><circle cx="100" cy="100" r="84" className="fill-card stroke-muted" strokeWidth="12" /><circle cx="100" cy="100" r="84" fill="none" className="stroke-primary transition-all" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - pct * C} /></svg>
        <span className="relative text-5xl font-extrabold">{st.count}</span>
        <span className="relative block text-sm text-muted-foreground">/ {d.target}</span>
      </button>
      <p className="mt-4 text-sm text-muted-foreground">{t.total}: {st.total}</p>
      <button onClick={() => setSt((o) => ({ ...o, count: 0 }))} className="mt-2 rounded-xl border px-5 py-2 text-sm">{t.zero}</button>
    </div>
  );
}

function DuasTab() {
  const { lang, t } = useT();
  const [q, setQ] = useState(""); const [playing, setPlaying] = useState<number | null>(null);
  const [audioError, setAudioError] = useState("");
  const list = (DUAS_DATA as any[]).filter((d) => !q || d.titleAr.includes(q) || d.textAr.includes(q) || d.titleEn.toLowerCase().includes(q.toLowerCase()) || d.textEn.toLowerCase().includes(q.toLowerCase()));
  useEffect(() => () => stopAudio(), []);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} className="mb-3 w-full rounded-xl border bg-card px-4 py-2" />
      {audioError && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{audioError}</p>}
      <div className="space-y-3">
        {list.map((d, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4">
            <h3 className="mb-2 font-bold text-primary">{lang === "ar" ? d.titleAr : d.titleEn}</h3>
            <p className="text-lg leading-loose" dir="rtl" lang="ar">{d.textAr}</p>
            {lang !== "ar" && <p className="mt-2 text-sm" dir="ltr">{d.textEn}</p>}
            <p className="mt-2 text-xs text-muted-foreground">✨ {lang === "ar" ? d.virtueAr : d.virtueEn}</p>
            <div className="mt-3 flex gap-2">
              <button disabled={!DUA_AUDIO[DUAS_DATA.indexOf(d)]} title={!DUA_AUDIO[DUAS_DATA.indexOf(d)] ? t.recUnavailable : undefined} onClick={() => { const source = DUA_AUDIO[DUAS_DATA.indexOf(d)]; if (!source) return; if (playing === i) { stopAudio(); setPlaying(null); } else { setAudioError(""); setPlaying(i); playAudio(source, () => setPlaying(null), () => { setPlaying(null); setAudioError(t.audioFail); }); } }} className="rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-45">{playing === i ? `⏸ ${t.stop}` : DUA_AUDIO[DUAS_DATA.indexOf(d)] ? `🔊 ${t.listen}` : t.noRec}</button>
              <button onClick={() => navigator.clipboard?.writeText(d.textAr)} className="rounded-full border px-3 py-1 text-sm">📋 {t.copy}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0"><span className="text-sm font-semibold">{label}</span>{children}</div>;
}
function Toggle({ v, on }: { v: boolean; on: () => void }) {
  return <button onClick={on} className={`h-7 w-12 shrink-0 rounded-full p-1 transition ${v ? "bg-primary" : "bg-muted"}`}><span className={`block h-5 w-5 rounded-full bg-card shadow transition ${v ? "ltr:translate-x-5 rtl:-translate-x-5" : ""}`} /></button>;
}

function SettingsTab({ s, setS, locate }: { s: Settings; setS: (f: (o: Settings) => Settings) => void; locate: () => void }) {
  const [perm, setPerm] = useState<string>("");
  useEffect(() => { setPerm("Notification" in window ? Notification.permission : "unsupported"); }, []);
  const up = (p: Partial<Settings>) => setS((o) => ({ ...o, ...p }));
  const { lang, t } = useT();
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card px-4">
        <Row label={t.language}><select value={lang} onChange={(e) => up({ lang: e.target.value as Lang })} className="rounded-lg border bg-background px-2 py-1 text-sm">{LANGS.map((l) => <option key={l.k} value={l.k}>{l.label}</option>)}</select></Row>
      </section>
      <section className="rounded-2xl border bg-card px-4">
        <Row label={`${t.location}: ${s.city ?? t.notSet}`}><button onClick={locate} className="rounded-lg bg-secondary px-3 py-1 text-sm text-secondary-foreground">{t.update}</button></Row>
        <Row label={t.method}><select value={s.method} onChange={(e) => up({ method: e.target.value })} className="max-w-44 rounded-lg border bg-background px-2 py-1 text-sm">{Object.entries(lang === "ar" ? METHODS : METHODS_EN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label={t.hanafiAsr}><Toggle v={s.hanafi} on={() => up({ hanafi: !s.hanafi })} /></Row>
      </section>
      <section className="rounded-2xl border bg-card px-4">
        <Row label={t.browserNotif}>
          {perm === "granted" ? <span className="text-sm text-primary">{t.enabled}</span> : perm === "unsupported" ? <span className="text-xs text-muted-foreground">{t.unsupported}</span> :
            <button onClick={async () => setPerm(await Notification.requestPermission())} className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground">{t.enable}</button>}
        </Row>
        <Row label={t.adhanAlert}><Toggle v={s.notifyPrayer} on={() => up({ notifyPrayer: !s.notifyPrayer })} /></Row>
        <Row label={t.before}><select value={s.before} onChange={(e) => up({ before: +e.target.value })} className="rounded-lg border bg-background px-2 py-1 text-sm">{[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? t.minutes(m) : t.none}</option>)}</select></Row>
        <Row label={t.adhkarAlert}><Toggle v={s.notifyAdhkar} on={() => up({ notifyAdhkar: !s.notifyAdhkar })} /></Row>
        <Row label={t.testAlert}><button onClick={() => notify(t.testTitle, t.testBody, ADHAN_AUDIO)} className="rounded-lg border px-3 py-1 text-sm">🔔 {t.test}</button></Row>
      </section>
      <section className="rounded-2xl border bg-card px-4">
        <Row label={t.recitations}><span className="max-w-48 text-end text-xs text-muted-foreground">{t.recitationsDesc}</span></Row>
        <Row label={t.dark}><Toggle v={s.dark} on={() => up({ dark: !s.dark })} /></Row>
      </section>
      <p className="text-center text-xs text-muted-foreground">{t.note}</p>
    </div>
  );
}

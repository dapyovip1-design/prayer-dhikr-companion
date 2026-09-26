import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
const HISN_AUDIO = "https://www.hisnmuslim.com/audio/ar";
const ADHAN_AUDIO = "https://cdn.aladhan.com/audio/adhans/a1.mp3";
const ADHKAR_AUDIO: Record<string, Record<string, string>> = {
  morning: { m1: "69", m2: "78", m3: "79", m4: "87", m5: "82", m6: "82", m7: "83", m8: "86", m9: "94", m10: "95" },
  evening: { e1: "69", e2: "78", e3: "79", e4: "87", e5: "80", e6: "83", e7: "86", e8: "216" },
  sleep: { s1: "102", s2: "103", s3: "104", s4: "105", s5: "91" },
};
const DUA_AUDIO = [
  "https://everyayah.com/data/Alafasy_128kbps/002201.mp3",
  "https://everyayah.com/data/Alafasy_128kbps/003008.mp3",
  `${HISN_AUDIO}/79.mp3`,
  `${HISN_AUDIO}/120.mp3`,
  `${HISN_AUDIO}/136.mp3`,
  `${HISN_AUDIO}/122.mp3`,
  null,
  "https://everyayah.com/data/Alafasy_128kbps/014040.mp3",
];

type Settings = {
  lat?: number; lng?: number; city?: string;
  method: string; hanafi: boolean;
  notifyPrayer: boolean; notifyAdhkar: boolean; before: number;
  dark: boolean;
};
const DEFAULT: Settings = { method: "Egyptian", hanafi: false, notifyPrayer: true, notifyAdhkar: true, before: 0, dark: false };

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

const fmt = (d: Date) => d.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });

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

  const locate = () => {
    setLocErr("");
    if (!navigator.geolocation) return setLocErr("المتصفح لا يدعم تحديد الموقع");
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lat = p.coords.latitude, lng = p.coords.longitude;
        let city = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&zoom=10`);
          const j = await r.json();
          city = j.address?.city || j.address?.town || j.address?.state || city;
        } catch {}
        setS((o) => ({ ...o, lat, lng, city }));
      },
      () => setLocErr("تعذّر تحديد الموقع. يرجى السماح بالوصول للموقع."),
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
        const t = (pt as any)[p.key] as Date;
        if (s.before > 0) at(new Date(t.getTime() - s.before * 60000), () => notify(`اقتربت صلاة ${p.ar}`, `بعد ${s.before} دقيقة`, ADHAN_AUDIO));
        at(t, () => notify(`حان وقت صلاة ${p.ar}`, `${s.city ?? ""} — ${fmt(t)}`, ADHAN_AUDIO));
      }
      if (s.notifyAdhkar) {
        at(new Date(pt.sunrise.getTime() - 20 * 60000), () => notify("أذكار الصباح", "حان وقت أذكار الصباح", `${HISN_AUDIO}/69.mp3`));
        at(new Date(pt.asr.getTime() + 15 * 60000), () => notify("أذكار المساء", "حان وقت أذكار المساء", `${HISN_AUDIO}/69.mp3`));
        at(new Date(pt.isha.getTime() + 90 * 60000), () => notify("أذكار النوم", "لا تنسَ أذكار النوم", `${HISN_AUDIO}/102.mp3`));
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [times, s.notifyPrayer, s.notifyAdhkar, s.before, s.city]);

  const changeTabBySwipe = (direction: "left" | "right") => {
    const current = TABS.indexOf(tab);
    const nextIndex = direction === "left" ? current + 1 : current - 1;
    const nextTab = TABS[nextIndex];
    if (nextTab) { stopAudio(); setTab(nextTab); }
  };

  let next: { ar: string; t: Date } | null = null;
  if (times && now) {
    for (const p of PRAYERS) { const t = (times.today as any)[p.key] as Date; if (p.key !== "sunrise" && t > now) { next = { ar: p.ar, t }; break; } }
    if (!next) next = { ar: "الفجر", t: times.tomorrow.fajr };
  }
  const left = next && now ? Math.max(0, next.t.getTime() - now.getTime()) : 0;
  const cd = `${String(Math.floor(left / 36e5)).padStart(2, "0")}:${String(Math.floor((left % 36e5) / 6e4)).padStart(2, "0")}:${String(Math.floor((left % 6e4) / 1e3)).padStart(2, "0")}`;
  const hijri = now ? new Intl.DateTimeFormat("ar-SA-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(now) : "";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background pb-24">
      <header className="relative overflow-hidden rounded-b-[28px] bg-gradient-to-br from-hero-from to-hero-to p-5 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold">أذكار الحصن</h1>
            <p className="text-xs opacity-80">{hijri}</p>
          </div>
          <button onClick={() => setS((o) => ({ ...o, dark: !o.dark }))} className="rounded-full bg-background/15 px-3 py-1.5 text-sm" aria-label="تبديل الوضع">{s.dark ? "☀️" : "🌙"}</button>
        </div>
        <div className="mt-4 rounded-2xl bg-background/10 p-4 text-center backdrop-blur">
          {next ? (<>
            <p className="text-sm opacity-90">الصلاة القادمة: <b>{next.ar}</b> — {fmt(next.t)}</p>
            <p className="mt-1 font-mono text-4xl font-bold tracking-wider" dir="ltr">{cd}</p>
            <p className="mt-1 text-xs opacity-80">📍 {s.city}</p>
          </>) : <p className="text-sm">{locErr || "جارٍ تحديد موقعك..."}</p>}
        </div>
      </header>

      <main
        className="flex-1 touch-pan-y p-4"
        onTouchStart={(event) => {
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
        {([["prayer", "🕌", "المواقيت"], ["adhkar", "📖", "الأذكار"], ["tasbeeh", "📿", "المسبحة"], ["duas", "🤲", "الأدعية"], ["settings", "⚙️", "الإعدادات"]] as const).map(([k, i, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex flex-col items-center rounded-xl px-3 py-1 text-[11px] font-semibold ${tab === k ? "bg-secondary text-primary" : "text-muted-foreground"}`}>
            <span className="text-lg">{i}</span>{l}
          </button>
        ))}
      </nav>
    </div>
  );
}

function PrayerTab({ times, now, s, locate, locErr }: any) {
  if (!times) return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <p className="mb-3 text-muted-foreground">{locErr || "نحتاج موقعك لحساب المواقيت بدقة"}</p>
      <button onClick={locate} className="rounded-xl bg-primary px-5 py-2 font-bold text-primary-foreground">تحديد الموقع</button>
    </div>
  );
  let nextKey = "";
  for (const p of PRAYERS) if (p.key !== "sunrise" && times.today[p.key] > now) { nextKey = p.key; break; }
  return (
    <div className="space-y-2">
      {PRAYERS.map((p) => {
        const t: Date = times.today[p.key]; const past = t < now; const isNext = p.key === nextKey;
        return (
          <div key={p.key} className={`flex items-center justify-between rounded-2xl border p-4 ${isNext ? "border-primary bg-secondary" : "bg-card"} ${past && !isNext ? "opacity-60" : ""}`}>
            <span className="font-bold">{p.ar}{isNext && <span className="mr-2 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">القادمة</span>}</span>
            <span className="font-mono text-lg font-semibold">{fmt(t)}</span>
          </div>
        );
      })}
      <div className="mt-4 flex items-center justify-between rounded-2xl border bg-card p-4">
        <div><p className="font-bold">اتجاه القبلة</p><p className="text-xs text-muted-foreground">{Math.round(times.qibla)}° من الشمال</p></div>
        <div className="relative h-14 w-14 rounded-full border-2 border-primary">
          <span className="absolute inset-0 flex items-start justify-center text-xl" style={{ transform: `rotate(${times.qibla}deg)` }}>🕋</span>
        </div>
      </div>
      <p className="pt-2 text-center text-xs text-muted-foreground">طريقة الحساب: {METHODS[s.method]} · {s.hanafi ? "حنفي" : "جمهور"}</p>
    </div>
  );
}

function AdhkarTab() {
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
    if (!audioId) { setAudioError("لا يتوفر تسجيل بشري لهذا الذكر حالياً"); setPlaying(null); setAuto(false); return; }
    setAudioError("");
    setPlaying(d.id);
    playAudio(`${HISN_AUDIO}/${audioId}.mp3`, () => chain ? play(i + 1, true) : setPlaying(null), () => { setPlaying(null); setAuto(false); setAudioError("تعذّر تشغيل التسجيل. تحقق من اتصال الإنترنت."); });
  };
  const stop = () => { stopAudio(); setPlaying(null); setAuto(false); };

  return (
    <div>
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {CATS.map((c) => <button key={c.key} onClick={() => { stop(); setCat(c.key); }} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold ${cat === c.key ? "bg-primary text-primary-foreground" : "bg-card border"}`}>{c.ar}</button>)}
      </div>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${list.length ? (done / list.length) * 100 : 0}%` }} /></div>
        <span className="text-xs font-bold">{done}/{list.length}</span>
        <button onClick={() => auto ? stop() : (setAuto(true), play(0, true))} className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{auto ? "⏹ إيقاف" : "▶ تلاوة الكل"}</button>
      </div>
      {audioError && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{audioError}</p>}
      <div className="space-y-3">
        {list.map((d, i) => {
          const k = `${cat}_${d.id}`; const c = prog[k] || 0; const fin = c >= d.count;
          return (
            <div key={d.id} className={`rounded-2xl border p-4 ${playing === d.id ? "border-accent ring-2 ring-accent/40" : ""} ${fin ? "bg-secondary" : "bg-card"}`}>
              <p className="text-lg leading-loose">{d.textAr}</p>
              {d.virtueAr && <p className="mt-2 text-xs text-muted-foreground">✨ {d.virtueAr}</p>}
              <div className="mt-3 flex items-center justify-between">
                <button onClick={() => playing === d.id ? stop() : play(i, false)} className="rounded-full border px-3 py-1 text-sm">{playing === d.id ? "⏸ إيقاف" : "🔊 استماع"}</button>
                <button disabled={fin} onClick={() => setProg((p) => ({ ...p, [k]: c + 1 }))} className={`min-w-24 rounded-xl px-4 py-2 font-bold ${fin ? "bg-primary/20 text-primary" : "bg-primary text-primary-foreground active:scale-95"}`}>{fin ? "✓ تم" : `${c} / ${d.count}`}</button>
              </div>
            </div>
          );
        })}
      </div>
      <button onClick={() => setProg((p) => Object.fromEntries(Object.entries(p).filter(([k]) => !k.startsWith(cat + "_"))))} className="mt-4 w-full rounded-xl border py-2 text-sm text-muted-foreground">إعادة تعيين التقدّم</button>
    </div>
  );
}

function TasbeehTab() {
  const [idx, setIdx] = useState(0);
  const [st, setSt] = useStored<{ count: number; total: number }>("hisn_tasbeeh", { count: 0, total: 0 });
  const d = TASBEEH_LIST[idx]; const pct = Math.min(1, st.count / d.target); const C = 527.7;
  const tap = () => { setSt((o) => ({ count: o.count + 1, total: o.total + 1 })); if (st.count + 1 === d.target) navigator.vibrate?.(200); else navigator.vibrate?.(15); };
  return (
    <div className="text-center">
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {TASBEEH_LIST.map((t: any, i: number) => <button key={i} onClick={() => { setIdx(i); setSt((o) => ({ ...o, count: 0 })); }} className={`rounded-full px-3 py-1 text-xs font-bold ${i === idx ? "bg-primary text-primary-foreground" : "border bg-card"}`}>{t.textAr}</button>)}
      </div>
      <p className="mb-4 text-xl font-bold">{d.textAr}</p>
      <button onClick={tap} className="relative mx-auto block h-52 w-52 rounded-full active:scale-95 transition" aria-label="تسبيح">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200"><circle cx="100" cy="100" r="84" className="fill-card stroke-muted" strokeWidth="12" /><circle cx="100" cy="100" r="84" fill="none" className="stroke-primary transition-all" strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - pct * C} /></svg>
        <span className="relative text-5xl font-extrabold">{st.count}</span>
        <span className="relative block text-sm text-muted-foreground">/ {d.target}</span>
      </button>
      <p className="mt-4 text-sm text-muted-foreground">الإجمالي: {st.total}</p>
      <button onClick={() => setSt((o) => ({ ...o, count: 0 }))} className="mt-2 rounded-xl border px-5 py-2 text-sm">تصفير</button>
    </div>
  );
}

function DuasTab() {
  const [q, setQ] = useState(""); const [playing, setPlaying] = useState<number | null>(null);
  const [audioError, setAudioError] = useState("");
  const list = (DUAS_DATA as any[]).filter((d) => !q || d.titleAr.includes(q) || d.textAr.includes(q));
  useEffect(() => () => stopAudio(), []);
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الأدعية..." className="mb-3 w-full rounded-xl border bg-card px-4 py-2" />
      {audioError && <p className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{audioError}</p>}
      <div className="space-y-3">
        {list.map((d, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4">
            <h3 className="mb-2 font-bold text-primary">{d.titleAr}</h3>
            <p className="text-lg leading-loose">{d.textAr}</p>
            {d.virtueAr && <p className="mt-2 text-xs text-muted-foreground">✨ {d.virtueAr}</p>}
            <div className="mt-3 flex gap-2">
              <button disabled={!DUA_AUDIO[DUAS_DATA.indexOf(d)]} title={!DUA_AUDIO[DUAS_DATA.indexOf(d)] ? "التسجيل البشري غير متاح حالياً" : undefined} onClick={() => { const source = DUA_AUDIO[DUAS_DATA.indexOf(d)]; if (!source) return; if (playing === i) { stopAudio(); setPlaying(null); } else { setAudioError(""); setPlaying(i); playAudio(source, () => setPlaying(null), () => { setPlaying(null); setAudioError("تعذّر تشغيل التسجيل. تحقق من اتصال الإنترنت."); }); } }} className="rounded-full border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-45">{playing === i ? "⏸ إيقاف" : DUA_AUDIO[DUAS_DATA.indexOf(d)] ? "🔊 استماع" : "لا يوجد تسجيل"}</button>
              <button onClick={() => navigator.clipboard?.writeText(d.textAr)} className="rounded-full border px-3 py-1 text-sm">📋 نسخ</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ s, setS, locate }: { s: Settings; setS: (f: (o: Settings) => Settings) => void; locate: () => void }) {
  const [perm, setPerm] = useState<string>("");
  useEffect(() => { setPerm("Notification" in window ? Notification.permission : "unsupported"); }, []);
  const up = (p: Partial<Settings>) => setS((o) => ({ ...o, ...p }));
  const Row = ({ label, children }: any) => <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0"><span className="text-sm font-semibold">{label}</span>{children}</div>;
  const Toggle = ({ v, on }: { v: boolean; on: () => void }) => <button onClick={on} className={`h-7 w-12 rounded-full p-1 transition ${v ? "bg-primary" : "bg-muted"}`}><span className={`block h-5 w-5 rounded-full bg-card shadow transition ${v ? "-translate-x-5" : ""}`} /></button>;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-card px-4">
        <Row label={`الموقع: ${s.city ?? "غير محدد"}`}><button onClick={locate} className="rounded-lg bg-secondary px-3 py-1 text-sm text-secondary-foreground">تحديث</button></Row>
        <Row label="طريقة الحساب"><select value={s.method} onChange={(e) => up({ method: e.target.value })} className="max-w-44 rounded-lg border bg-background px-2 py-1 text-sm">{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Row>
        <Row label="العصر حسب المذهب الحنفي"><Toggle v={s.hanafi} on={() => up({ hanafi: !s.hanafi })} /></Row>
      </section>
      <section className="rounded-2xl border bg-card px-4">
        <Row label="إشعارات المتصفح">
          {perm === "granted" ? <span className="text-sm text-primary">مفعّلة ✓</span> : perm === "unsupported" ? <span className="text-xs text-muted-foreground">غير مدعومة</span> :
            <button onClick={async () => setPerm(await Notification.requestPermission())} className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground">تفعيل</button>}
        </Row>
        <Row label="تنبيه الأذان"><Toggle v={s.notifyPrayer} on={() => up({ notifyPrayer: !s.notifyPrayer })} /></Row>
        <Row label="تذكير قبل الصلاة"><select value={s.before} onChange={(e) => up({ before: +e.target.value })} className="rounded-lg border bg-background px-2 py-1 text-sm">{[0, 5, 10, 15, 30].map((m) => <option key={m} value={m}>{m ? `${m} دقيقة` : "بدون"}</option>)}</select></Row>
        <Row label="تذكير الأذكار (صباح/مساء/نوم)"><Toggle v={s.notifyAdhkar} on={() => up({ notifyAdhkar: !s.notifyAdhkar })} /></Row>
        <Row label="تجربة التنبيه"><button onClick={() => notify("تجربة", "هكذا سيظهر التنبيه", ADHAN_AUDIO)} className="rounded-lg border px-3 py-1 text-sm">🔔 تجربة</button></Row>
      </section>
      <section className="rounded-2xl border bg-card px-4">
        <Row label="التلاوات"><span className="max-w-48 text-left text-xs text-muted-foreground">صوت بشري مسجّل، والآيات بصوت الشيخ مشاري العفاسي</span></Row>
        <Row label="الوضع الليلي"><Toggle v={s.dark} on={() => up({ dark: !s.dark })} /></Row>
      </section>
      <p className="text-center text-xs text-muted-foreground">تعمل التنبيهات أثناء فتح التطبيق في المتصفح.</p>
    </div>
  );
}

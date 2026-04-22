import React from "react";
// ===== Comedy Bible Homework — hosted build =====
// Pre-compiled from JSX. Loads as a native ES module. No build step needed.
// localStorage shim for the window.storage API used throughout the app.
// Data persists in the browser, per-device, unless Drive sync is connected.
if (!window.storage) {
    window.storage = {
        async get(key) {
            try {
                const raw = localStorage.getItem("cbh_" + key);
                return raw ? { key, value: raw, shared: false } : null;
            }
            catch {
                return null;
            }
        },
        async set(key, value) {
            try {
                localStorage.setItem("cbh_" + key, value);
                return { key, value, shared: false };
            }
            catch {
                return null;
            }
        },
        async delete(key) {
            try {
                localStorage.removeItem("cbh_" + key);
                return { key, deleted: true, shared: false };
            }
            catch {
                return null;
            }
        },
    };
}
// React DOM for rendering
import ReactDOM from "react-dom/client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Mic, MicOff, Plus, ArrowRight, ArrowLeft, Check, X, Clock, Flame, BookOpen, Trash2, Edit3, ChevronDown, Calendar, Zap, FileText, Circle, CheckCircle2, Link2, Unlink, Network, List, Send, Tag, Archive, Sparkles, Cloud, CloudOff, RefreshCw, LogOut, Settings } from "lucide-react";
// ============ GOOGLE DRIVE CONFIG ============
// These are Kole's OAuth credentials for the "Comedy Bible Homework" GCP project.
// Safe to commit — Client ID is public by design. No client secret is used (browser flow).
const GOOGLE_CLIENT_ID = "347783412246-5jm4veje3bo0vq0qkcjsvdovq20pjut8.apps.googleusercontent.com";
const GOOGLE_API_KEY = ""; // Optional — not strictly needed with OAuth for Drive writes
const DRIVE_FILE_NAME = "comedy_bible_data.json";
const DRIVE_SCOPES = "https://www.googleapis.com/auth/drive.file";
const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
// ============ PIPELINE STAGES ============
const STAGES = [
    { id: "raw", label: "Raw", short: "Raw", color: "#888", description: "Just a thought. Unfiltered. Not trying to be funny yet." },
    { id: "topic", label: "Topic", short: "Topic", color: "#d97706", description: "What is this ABOUT? Childhood / love / job / special challenge / current event." },
    { id: "premise", label: "Premise", short: "Premise", color: "#c2410c", description: "Rewrite as: 'What's hard/weird/stupid/scary about X is Y.' No 'I' or 'me' or 'my'. Not funny yet — just TRUE." },
    { id: "authentic", label: "Authentic Check", short: "Check", color: "#b45309", description: "Is this really yours? Would a stranger relate? If no, kill it or dig deeper." },
    { id: "actout", label: "Act-Out", short: "Act-Out", color: "#a16207", description: "Find the funny. Who do you become? What voice, gesture, face? This is where the laugh lives." },
    { id: "mix", label: "Mix", short: "Mix", color: "#854d0e", description: "Take this character/situation and drop them somewhere unexpected." },
    { id: "rework", label: "Rework", short: "Rework", color: "#713f12", description: "Take Two. Strip filler. Present tense. ONE attitude. If it's not part of the joke, it's part of the problem." },
    { id: "hot", label: "Hot Check", short: "Hot", color: "#dc2626", description: "Does it still work? Or is it a clunker? Be ruthless. Kill your darlings." },
    { id: "set", label: "Set List", short: "SET", color: "#16a34a", description: "In the act. Has a position, an attitude word, and it EARNS its slot." },
];
const DAILY_PROMPTS = [
    { type: "Rant", prompt: "What's pissing you off today? Write uncensored. No filter. No trying to be funny. Just the rage." },
    { type: "Rave", prompt: "What did you LOVE today? A moment, a taste, a person, a thing. Describe it so someone else can see it." },
    { type: "Character", prompt: "Someone you saw today. Stranger, friend, anyone. Describe them like you're about to play them onstage. Voice. Posture. Tell." },
    { type: "Detail an Event", prompt: "Something that happened today, in micro-detail. Slow it down. What did the light look like? What did they say exactly?" },
    { type: "Stream of Consciousness", prompt: "15 minutes, no stopping. Don't edit. Don't correct. Let the weird stuff come out. Usually what scares you to write is what's gold." },
    { type: "Childhood", prompt: "A specific memory from before age 15. Not the whole story — a single image or line or moment." },
    { type: "Special Challenge", prompt: "Something about your life that's not like everyone else's. What's HARD about it? Not sad. Hard. Different question." },
    { type: "Love/Relationship", prompt: "Something weird about your current relationship status. Single, married, in-between. What do people not talk about out loud?" },
    { type: "Job/Past Job", prompt: "What's stupid about your work? Past or present. The thing coworkers actually say out loud that would sound insane to outsiders." },
    { type: "Current Event", prompt: "Something in the news that's pissing you off or baffling you. Your specific, weird take on it. Not the CNN take. YOUR take." },
];
// Play a little victory fanfare when the timer hits zero.
// Synthesized with Web Audio API so no assets needed.
function playVictorySound() {
    try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx)
            return;
        const ctx = new Ctx();
        // A major chord arpeggio going up, then a sparkle
        const notes = [
            { freq: 523.25, start: 0.00, dur: 0.18 }, // C5
            { freq: 659.25, start: 0.12, dur: 0.18 }, // E5
            { freq: 783.99, start: 0.24, dur: 0.18 }, // G5
            { freq: 1046.5, start: 0.36, dur: 0.45 }, // C6 (held)
            { freq: 1318.5, start: 0.55, dur: 0.40 }, // E6 sparkle
            { freq: 1568.0, start: 0.70, dur: 0.50 }, // G6 sparkle
        ];
        notes.forEach(({ freq, start, dur }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            // Envelope: quick attack, gentle release
            gain.gain.setValueAtTime(0, ctx.currentTime + start);
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + dur + 0.05);
        });
        // Close context after sound finishes to free resources
        setTimeout(() => { try {
            ctx.close();
        }
        catch { } }, 1800);
    }
    catch { }
}
const storage = {
    async get(key) { try {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : null;
    }
    catch {
        return null;
    } },
    async set(key, val) { try {
        await window.storage.set(key, JSON.stringify(val));
        return true;
    }
    catch {
        return false;
    } }
};
// ============ GOOGLE DRIVE SYNC ============
// Token cache kept in localStorage so sign-in persists across sessions.
const driveAuth = {
    token: null,
    expiresAt: 0,
    load() {
        try {
            const raw = localStorage.getItem("kole_drive_auth");
            if (!raw)
                return;
            const parsed = JSON.parse(raw);
            if (parsed.expiresAt && parsed.expiresAt > Date.now() + 30000) {
                this.token = parsed.token;
                this.expiresAt = parsed.expiresAt;
            }
        }
        catch { }
    },
    save() {
        try {
            localStorage.setItem("kole_drive_auth", JSON.stringify({ token: this.token, expiresAt: this.expiresAt }));
        }
        catch { }
    },
    clear() {
        this.token = null;
        this.expiresAt = 0;
        try {
            localStorage.removeItem("kole_drive_auth");
        }
        catch { }
        try {
            localStorage.removeItem("kole_drive_file_id");
        }
        catch { }
    },
    isValid() { return !!this.token && this.expiresAt > Date.now() + 30000; },
};
let googleClientPromise = null;
function loadGoogleIdentity() {
    if (googleClientPromise)
        return googleClientPromise;
    googleClientPromise = new Promise((resolve, reject) => {
        if (window.google?.accounts?.oauth2) {
            resolve(window.google);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(window.google);
        script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
        document.head.appendChild(script);
    });
    return googleClientPromise;
}
async function signInWithGoogle() {
    const google = await loadGoogleIdentity();
    return new Promise((resolve, reject) => {
        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: DRIVE_SCOPES,
                callback: (response) => {
                    if (response.error) {
                        reject(new Error(response.error));
                        return;
                    }
                    driveAuth.token = response.access_token;
                    // expires_in is seconds; default ~1 hour if missing
                    const ttl = (response.expires_in || 3600) * 1000;
                    driveAuth.expiresAt = Date.now() + ttl;
                    driveAuth.save();
                    resolve(response.access_token);
                },
                error_callback: (err) => reject(new Error(err.message || "Sign-in failed")),
            });
            client.requestAccessToken({ prompt: "" });
        }
        catch (err) {
            reject(err);
        }
    });
}
function signOutGoogle() {
    if (window.google?.accounts?.oauth2 && driveAuth.token) {
        try {
            window.google.accounts.oauth2.revoke(driveAuth.token, () => { });
        }
        catch { }
    }
    driveAuth.clear();
}
async function driveFetch(url, options = {}) {
    if (!driveAuth.isValid())
        throw new Error("NOT_SIGNED_IN");
    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${driveAuth.token}`,
    };
    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        driveAuth.clear();
        throw new Error("NOT_SIGNED_IN");
    }
    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Drive API ${response.status}: ${errText.slice(0, 200)}`);
    }
    return response;
}
async function findDriveFileId() {
    const cached = localStorage.getItem("kole_drive_file_id");
    if (cached)
        return cached;
    const query = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,modifiedTime)`);
    const data = await res.json();
    if (data.files && data.files.length > 0) {
        localStorage.setItem("kole_drive_file_id", data.files[0].id);
        return data.files[0].id;
    }
    return null;
}
async function downloadFromDrive() {
    const fileId = await findDriveFileId();
    if (!fileId)
        return null;
    const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
    const text = await res.text();
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
async function uploadToDrive(data) {
    const fileId = await findDriveFileId();
    const body = JSON.stringify({ ...data, _syncedAt: new Date().toISOString() });
    if (fileId) {
        // PATCH update
        await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body,
        });
        return fileId;
    }
    else {
        // Multipart create
        const boundary = "-------kole-sync-" + Date.now();
        const metadata = { name: DRIVE_FILE_NAME, mimeType: "application/json" };
        const multipartBody = `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            JSON.stringify(metadata) + `\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: application/json\r\n\r\n` +
            body + `\r\n` +
            `--${boundary}--`;
        const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id`, {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: multipartBody,
        });
        const result = await res.json();
        localStorage.setItem("kole_drive_file_id", result.id);
        return result.id;
    }
}
// Merge local + remote state: remote takes precedence for items with same id
// and newer `updated` timestamp. Local-only items are preserved.
function mergeData(local, remote) {
    if (!remote)
        return local;
    const mergeById = (localArr, remoteArr) => {
        const map = new Map();
        for (const item of (localArr || []))
            map.set(item.id, item);
        for (const item of (remoteArr || [])) {
            const existing = map.get(item.id);
            if (!existing)
                map.set(item.id, item);
            else {
                // Pick newer by updated (or created if no updated)
                const localTime = new Date(existing.updated || existing.created || 0).getTime();
                const remoteTime = new Date(item.updated || item.created || 0).getTime();
                map.set(item.id, remoteTime >= localTime ? item : existing);
            }
        }
        return Array.from(map.values());
    };
    const mergeLinks = (localArr, remoteArr) => {
        const map = new Map();
        for (const l of (localArr || []))
            map.set(l.id, l);
        for (const l of (remoteArr || []))
            map.set(l.id, l);
        return Array.from(map.values());
    };
    const mergeLogs = (localObj, remoteObj) => {
        const merged = { ...(remoteObj || {}) };
        // Local overrides remote for same date (user just wrote locally)
        for (const [date, entry] of Object.entries(localObj || {})) {
            const remoteEntry = merged[date];
            if (!remoteEntry)
                merged[date] = entry;
            else {
                const localTime = new Date(entry.at || 0).getTime();
                const remoteTime = new Date(remoteEntry.at || 0).getTime();
                merged[date] = localTime >= remoteTime ? entry : remoteEntry;
            }
        }
        return merged;
    };
    return {
        bits: mergeById(local.bits, remote.bits),
        notes: mergeById(local.notes, remote.notes),
        links: mergeLinks(local.links, remote.links),
        dailyLog: mergeLogs(local.dailyLog, remote.dailyLog),
        checkinLog: mergeLogs(local.checkinLog, remote.checkinLog),
    };
}
// ============ END DRIVE SYNC ============
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toISOString().slice(0, 10);
const prettyDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const itemPreview = (item) => {
    if (item.kind === "note")
        return item.text;
    return item.rework || item.actout || item.premise || item.topic || item.raw;
};
const itemTitle = (item) => {
    const t = itemPreview(item) || "";
    return t.slice(0, 40) + (t.length > 40 ? "…" : "");
};
function useSpeechRecognition(onResult) {
    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(true);
    const recognitionRef = useRef(null);
    const callbackRef = useRef(onResult);
    callbackRef.current = onResult;
    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setSupported(false);
            return;
        }
        const r = new SR();
        r.continuous = true;
        r.interimResults = true;
        r.lang = "en-US";
        r.onresult = (event) => {
            let finalText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal)
                    finalText += event.results[i][0].transcript;
            }
            if (finalText)
                callbackRef.current(finalText);
        };
        r.onend = () => setListening(false);
        r.onerror = () => setListening(false);
        recognitionRef.current = r;
        return () => { try {
            r.stop();
        }
        catch { } };
    }, []);
    const start = () => {
        if (!supported || !recognitionRef.current)
            return;
        try {
            recognitionRef.current.start();
            setListening(true);
        }
        catch { }
    };
    const stop = () => {
        if (!recognitionRef.current)
            return;
        try {
            recognitionRef.current.stop();
        }
        catch { }
        setListening(false);
    };
    return { listening, supported, start, stop };
}
// ============ MAIN APP ============
function App() {
    const [view, setView] = useState("capture");
    const [bits, setBits] = useState([]);
    const [notes, setNotes] = useState([]);
    const [links, setLinks] = useState([]);
    const [dailyLog, setDailyLog] = useState({});
    const [checkinLog, setCheckinLog] = useState({});
    const [activeItem, setActiveItem] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [showCheckin, setShowCheckin] = useState(false);
    // Drive sync state
    const [driveConnected, setDriveConnected] = useState(false);
    const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | error | unsynced
    const [syncError, setSyncError] = useState(null);
    const [lastSyncAt, setLastSyncAt] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const dirtyRef = useRef(false);
    const initialSyncDoneRef = useRef(false);
    // On mount: load local data + check for cached Drive auth
    useEffect(() => {
        (async () => {
            setBits(await storage.get("bits_v2") || []);
            setNotes(await storage.get("notes_v2") || []);
            setLinks(await storage.get("links_v2") || []);
            const dl = await storage.get("dailyLog_v2") || {};
            setDailyLog(dl);
            const ci = await storage.get("checkinLog_v2") || {};
            setCheckinLog(ci);
            driveAuth.load();
            if (driveAuth.isValid()) {
                setDriveConnected(true);
            }
            const lsa = localStorage.getItem("kole_last_sync_at");
            if (lsa)
                setLastSyncAt(lsa);
            setLoaded(true);
            const t = today();
            if (!ci[t] && !dl[t]) {
                setTimeout(() => setShowCheckin(true), 500);
            }
        })();
    }, []);
    // After load: if Drive is connected, pull remote and merge
    useEffect(() => {
        if (!loaded || !driveConnected || initialSyncDoneRef.current)
            return;
        initialSyncDoneRef.current = true;
        (async () => {
            setSyncStatus("syncing");
            try {
                const remote = await downloadFromDrive();
                if (remote) {
                    const merged = mergeData({ bits, notes, links, dailyLog, checkinLog }, remote);
                    setBits(merged.bits);
                    setNotes(merged.notes);
                    setLinks(merged.links);
                    setDailyLog(merged.dailyLog);
                    setCheckinLog(merged.checkinLog);
                }
                setSyncStatus("synced");
                setLastSyncAt(new Date().toISOString());
                localStorage.setItem("kole_last_sync_at", new Date().toISOString());
            }
            catch (err) {
                if (err.message === "NOT_SIGNED_IN") {
                    setDriveConnected(false);
                    setSyncStatus("idle");
                }
                else {
                    setSyncStatus("error");
                    setSyncError(err.message);
                }
            }
        })();
    }, [loaded, driveConnected]);
    useEffect(() => { if (loaded) {
        storage.set("bits_v2", bits);
        dirtyRef.current = true;
    } }, [bits, loaded]);
    useEffect(() => { if (loaded) {
        storage.set("notes_v2", notes);
        dirtyRef.current = true;
    } }, [notes, loaded]);
    useEffect(() => { if (loaded) {
        storage.set("links_v2", links);
        dirtyRef.current = true;
    } }, [links, loaded]);
    useEffect(() => { if (loaded) {
        storage.set("dailyLog_v2", dailyLog);
        dirtyRef.current = true;
    } }, [dailyLog, loaded]);
    useEffect(() => { if (loaded) {
        storage.set("checkinLog_v2", checkinLog);
        dirtyRef.current = true;
    } }, [checkinLog, loaded]);
    // Push to Drive if dirty
    const pushToDrive = async () => {
        if (!driveConnected || !driveAuth.isValid())
            return;
        setSyncStatus("syncing");
        try {
            await uploadToDrive({ bits, notes, links, dailyLog, checkinLog });
            dirtyRef.current = false;
            setSyncStatus("synced");
            const now = new Date().toISOString();
            setLastSyncAt(now);
            localStorage.setItem("kole_last_sync_at", now);
        }
        catch (err) {
            if (err.message === "NOT_SIGNED_IN") {
                setDriveConnected(false);
                setSyncStatus("idle");
            }
            else {
                setSyncStatus("error");
                setSyncError(err.message);
            }
        }
    };
    // Auto-sync every 2 minutes when dirty
    useEffect(() => {
        if (!driveConnected)
            return;
        const interval = setInterval(() => {
            if (dirtyRef.current)
                pushToDrive();
        }, SYNC_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [driveConnected, bits, notes, links, dailyLog, checkinLog]);
    // Sync on tab close / visibility change
    useEffect(() => {
        if (!driveConnected)
            return;
        const handler = () => { if (dirtyRef.current)
            pushToDrive(); };
        window.addEventListener("beforeunload", handler);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden" && dirtyRef.current)
                pushToDrive();
        });
        return () => {
            window.removeEventListener("beforeunload", handler);
        };
    }, [driveConnected, bits, notes, links, dailyLog, checkinLog]);
    // Mark unsynced if dirty
    useEffect(() => {
        if (loaded && driveConnected && dirtyRef.current && syncStatus === "synced") {
            setSyncStatus("unsynced");
        }
    }, [bits, notes, links, dailyLog, checkinLog]);
    const connectDrive = async () => {
        setSyncStatus("syncing");
        setSyncError(null);
        try {
            await signInWithGoogle();
            setDriveConnected(true);
            // Trigger initial sync
            initialSyncDoneRef.current = false;
        }
        catch (err) {
            setSyncStatus("error");
            setSyncError(err.message);
            setTimeout(() => setSyncStatus("idle"), 3000);
        }
    };
    const disconnectDrive = () => {
        signOutGoogle();
        setDriveConnected(false);
        setSyncStatus("idle");
        setLastSyncAt(null);
    };
    const manualSync = () => pushToDrive();
    const saveCheckin = (didWrite, note) => {
        setCheckinLog(cl => ({
            ...cl,
            [today()]: { didWrite, note: note || "", at: new Date().toISOString() }
        }));
        setShowCheckin(false);
    };
    const allItems = useMemo(() => [
        ...bits.map(b => ({ ...b, kind: "bit" })),
        ...notes.map(n => ({ ...n, kind: "note" }))
    ], [bits, notes]);
    const findItem = (id) => allItems.find(i => i.id === id);
    const addBit = (rawText) => {
        const newBit = {
            id: uid(), stage: "raw",
            created: new Date().toISOString(), updated: new Date().toISOString(),
            raw: rawText, topic: "", topicCategory: "",
            premise: "", authenticNotes: "", actout: "", mix: "",
            rework: "", hotNotes: "", setPosition: null, setAttitude: "",
            history: [{ at: new Date().toISOString(), note: "Captured" }],
        };
        setBits([newBit, ...bits]);
        return newBit;
    };
    const updateBit = (id, updates) => {
        setBits(bs => bs.map(b => b.id === id ? { ...b, ...updates, updated: new Date().toISOString() } : b));
    };
    const advanceBit = (id, newStage) => {
        setBits(bs => bs.map(b => {
            if (b.id !== id)
                return b;
            const stageInfo = STAGES.find(s => s.id === newStage);
            return { ...b, stage: newStage, updated: new Date().toISOString(),
                history: [...b.history, { at: new Date().toISOString(), note: `Moved to ${stageInfo.label}` }] };
        }));
    };
    const deleteBit = (id) => {
        setBits(bs => bs.filter(b => b.id !== id));
        setLinks(ls => ls.filter(l => l.a !== id && l.b !== id));
        if (activeItem?.id === id) {
            setActiveItem(null);
            setView("pipeline");
        }
    };
    const addNote = (text) => {
        const newNote = { id: uid(), text, tags: [], created: new Date().toISOString(), updated: new Date().toISOString() };
        setNotes([newNote, ...notes]);
        return newNote;
    };
    const updateNote = (id, updates) => {
        setNotes(ns => ns.map(n => n.id === id ? { ...n, ...updates, updated: new Date().toISOString() } : n));
    };
    const deleteNote = (id) => {
        setNotes(ns => ns.filter(n => n.id !== id));
        setLinks(ls => ls.filter(l => l.a !== id && l.b !== id));
        if (activeItem?.id === id) {
            setActiveItem(null);
            setView("lot");
        }
    };
    const promoteNote = (id) => {
        const note = notes.find(n => n.id === id);
        if (!note)
            return;
        const newBit = addBit(note.text);
        setLinks(ls => ls.map(l => {
            if (l.a === id)
                return { ...l, a: newBit.id };
            if (l.b === id)
                return { ...l, b: newBit.id };
            return l;
        }));
        setNotes(ns => ns.filter(n => n.id !== id));
        setActiveItem({ kind: "bit", id: newBit.id });
        setView("bit");
    };
    const toggleLink = (aId, bId) => {
        if (aId === bId)
            return;
        const existing = links.find(l => (l.a === aId && l.b === bId) || (l.a === bId && l.b === aId));
        if (existing)
            setLinks(ls => ls.filter(l => l.id !== existing.id));
        else
            setLinks(ls => [...ls, { id: uid(), a: aId, b: bId }]);
    };
    const linkedIds = (id) => links.filter(l => l.a === id || l.b === id).map(l => l.a === id ? l.b : l.a);
    const saveDaily = (entry) => setDailyLog(dl => ({ ...dl, [today()]: entry }));
    const streak = (() => {
        // A day counts if either: daily entry exists OR check-in says didWrite=true
        const dayCounts = (iso) => !!dailyLog[iso] || (checkinLog[iso] && checkinLog[iso].didWrite);
        const anyDates = [...Object.keys(dailyLog), ...Object.keys(checkinLog).filter(k => checkinLog[k].didWrite)];
        if (anyDates.length === 0)
            return 0;
        let count = 0;
        let cursor = new Date();
        for (let i = 0; i < 365; i++) {
            const iso = cursor.toISOString().slice(0, 10);
            if (dayCounts(iso))
                count++;
            else if (i > 0)
                break;
            cursor.setDate(cursor.getDate() - 1);
        }
        return count;
    })();
    const setListBits = bits.filter(b => b.stage === "set").sort((a, b) => (a.setPosition || 999) - (b.setPosition || 999));
    if (!loaded)
        return React.createElement("div", { className: "kole-loading" }, "Loading your material\u2026");
    const openItem = (item) => {
        const kind = item.kind || (item.stage ? "bit" : "note");
        setActiveItem({ kind, id: item.id });
        setView(kind === "bit" ? "bit" : "note");
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("style", null, KOLE_CSS),
        React.createElement("div", { className: "kole-app" },
            view === "capture" && React.createElement(CaptureView, { onCapturePipeline: (text) => { addBit(text); setView("pipeline"); }, onCaptureNote: (text) => { addNote(text); setView("lot"); }, bits: bits, notes: notes, streak: streak }),
            view === "pipeline" && React.createElement(PipelineView, { bits: bits, onOpenBit: openItem, links: links }),
            view === "lot" && React.createElement(LotView, { notes: notes, bits: bits, links: links, onOpenNote: openItem, onOpenBit: openItem, onAddNote: addNote, onPromote: promoteNote }),
            view === "setlist" && React.createElement(SetListView, { bits: setListBits, onOpenBit: openItem }),
            view === "daily" && React.createElement(DailyView, { log: dailyLog, checkinLog: checkinLog, onSave: saveDaily, streak: streak }),
            view === "bit" && activeItem?.kind === "bit" && (React.createElement(BitView, { bit: bits.find(b => b.id === activeItem.id), onUpdate: (u) => updateBit(activeItem.id, u), onAdvance: (s) => advanceBit(activeItem.id, s), onDelete: () => deleteBit(activeItem.id), onBack: () => setView("pipeline"), allItems: allItems, linkedIds: linkedIds(activeItem.id), onToggleLink: (o) => toggleLink(activeItem.id, o), findItem: findItem, onOpenLinked: openItem })),
            view === "note" && activeItem?.kind === "note" && (React.createElement(NoteView, { note: notes.find(n => n.id === activeItem.id), onUpdate: (u) => updateNote(activeItem.id, u), onDelete: () => deleteNote(activeItem.id), onPromote: () => promoteNote(activeItem.id), onBack: () => setView("lot"), allItems: allItems, linkedIds: linkedIds(activeItem.id), onToggleLink: (o) => toggleLink(activeItem.id, o), findItem: findItem, onOpenLinked: openItem })),
            showCheckin && (React.createElement(CheckinModal, { onSave: saveCheckin, onClose: () => setShowCheckin(false), streak: streak })),
            showSettings && (React.createElement(SettingsModal, { driveConnected: driveConnected, syncStatus: syncStatus, syncError: syncError, lastSyncAt: lastSyncAt, onConnect: connectDrive, onDisconnect: disconnectDrive, onManualSync: manualSync, onClose: () => setShowSettings(false) })),
            view !== "bit" && view !== "note" && (React.createElement(SyncIndicator, { driveConnected: driveConnected, syncStatus: syncStatus, onClick: () => setShowSettings(true) })),
            view !== "bit" && view !== "note" && (React.createElement("nav", { className: "kole-nav" },
                React.createElement("button", { className: view === "capture" ? "active" : "", onClick: () => setView("capture") },
                    React.createElement(Mic, { size: 18 }),
                    " ",
                    React.createElement("span", null, "Capture")),
                React.createElement("button", { className: view === "lot" ? "active" : "", onClick: () => setView("lot") },
                    React.createElement(Archive, { size: 18 }),
                    " ",
                    React.createElement("span", null, "Lot")),
                React.createElement("button", { className: view === "pipeline" ? "active" : "", onClick: () => setView("pipeline") },
                    React.createElement(Zap, { size: 18 }),
                    " ",
                    React.createElement("span", null, "Pipeline")),
                React.createElement("button", { className: view === "setlist" ? "active" : "", onClick: () => setView("setlist") },
                    React.createElement(FileText, { size: 18 }),
                    " ",
                    React.createElement("span", null, "Set")),
                React.createElement("button", { className: view === "daily" ? "active" : "", onClick: () => setView("daily") },
                    React.createElement(Calendar, { size: 18 }),
                    " ",
                    React.createElement("span", null, "Daily")))))));
}
// ============ CAPTURE ============
function CaptureView({ onCapturePipeline, onCaptureNote, bits, notes, streak }) {
    const [text, setText] = useState("");
    const [destination, setDestination] = useState("lot");
    const { listening, supported, start, stop } = useSpeechRecognition((newText) => {
        setText(prev => (prev ? prev + " " : "") + newText);
    });
    const handleCapture = () => {
        if (!text.trim())
            return;
        if (listening)
            stop();
        if (destination === "pipeline")
            onCapturePipeline(text.trim());
        else
            onCaptureNote(text.trim());
        setText("");
    };
    const recentRaw = bits.filter(b => b.stage === "raw").slice(0, 2);
    const recentNotes = notes.slice(0, 2);
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-header" },
            React.createElement("div", { className: "kole-logo" },
                React.createElement("div", { className: "kole-logo-mark" }, "C"),
                React.createElement("div", null,
                    React.createElement("div", { className: "kole-logo-title" }, "Comedy Bible"),
                    React.createElement("div", { className: "kole-logo-sub" }, "Homework, feral style"))),
            React.createElement("div", { className: "kole-streak" },
                React.createElement(Flame, { size: 14 }),
                React.createElement("span", null,
                    streak,
                    "d"))),
        React.createElement("div", { className: "kole-capture-main" },
            React.createElement("div", { className: "kole-capture-label" }, "Dump the idea"),
            React.createElement("textarea", { value: text, onChange: (e) => setText(e.target.value), placeholder: listening ? "Listening…" : "Tap mic or type. Don't edit. Raw is sacred.", className: "kole-capture-input", rows: 5 }),
            React.createElement("div", { className: "kole-capture-row" },
                React.createElement("button", { className: `kole-mic ${listening ? "listening" : ""}`, onClick: listening ? stop : start, disabled: !supported },
                    listening ? React.createElement(MicOff, { size: 22 }) : React.createElement(Mic, { size: 22 }),
                    listening && React.createElement("span", { className: "kole-mic-pulse" })),
                React.createElement("div", { className: "kole-dest-toggle" },
                    React.createElement("button", { className: destination === "lot" ? "active" : "", onClick: () => setDestination("lot") },
                        React.createElement(Archive, { size: 13 }),
                        " Parking Lot"),
                    React.createElement("button", { className: destination === "pipeline" ? "active" : "", onClick: () => setDestination("pipeline") },
                        React.createElement(Zap, { size: 13 }),
                        " Pipeline"))),
            React.createElement("button", { className: "kole-btn-primary", onClick: handleCapture, disabled: !text.trim() },
                React.createElement(Plus, { size: 16 }),
                " Save to ",
                destination === "lot" ? "Parking Lot" : "Pipeline"),
            React.createElement("div", { className: "kole-capture-hint" }, destination === "lot"
                ? "Parking Lot = crumbs, half-thoughts, things you heard. No pressure."
                : "Pipeline = ready to work it into a bit. Commits to the process."),
            !supported && (React.createElement("div", { className: "kole-warn" }, "Speech recognition isn't supported in this browser. Use your phone keyboard's mic key instead."))),
        (recentRaw.length > 0 || recentNotes.length > 0) && (React.createElement("div", { className: "kole-recent" },
            React.createElement("div", { className: "kole-recent-title" }, "Recent"),
            recentRaw.map(b => (React.createElement("div", { key: b.id, className: "kole-recent-item" },
                React.createElement("div", { className: "kole-recent-badge pipeline" }, "PIPE"),
                React.createElement("div", { className: "kole-recent-text" },
                    b.raw.slice(0, 80),
                    b.raw.length > 80 ? "…" : ""),
                React.createElement("div", { className: "kole-recent-meta" }, prettyDate(b.created))))),
            recentNotes.map(n => (React.createElement("div", { key: n.id, className: "kole-recent-item" },
                React.createElement("div", { className: "kole-recent-badge lot" }, "LOT"),
                React.createElement("div", { className: "kole-recent-text" },
                    n.text.slice(0, 80),
                    n.text.length > 80 ? "…" : ""),
                React.createElement("div", { className: "kole-recent-meta" }, prettyDate(n.created)))))))));
}
// ============ PARKING LOT ============
function LotView({ notes, bits, links, onOpenNote, onOpenBit, onAddNote, onPromote }) {
    const [mode, setMode] = useState("list");
    const [showAdd, setShowAdd] = useState(false);
    const [quickText, setQuickText] = useState("");
    const handleQuickAdd = () => {
        if (!quickText.trim())
            return;
        onAddNote(quickText.trim());
        setQuickText("");
        setShowAdd(false);
    };
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-header" },
            React.createElement("div", null,
                React.createElement("h1", { className: "kole-title" }, "Parking Lot"),
                React.createElement("div", { className: "kole-sub" },
                    notes.length,
                    " crumb",
                    notes.length === 1 ? "" : "s",
                    " waiting")),
            React.createElement("div", { className: "kole-mode-toggle" },
                React.createElement("button", { className: mode === "list" ? "active" : "", onClick: () => setMode("list"), title: "List" },
                    React.createElement(List, { size: 16 })),
                React.createElement("button", { className: mode === "cluster" ? "active" : "", onClick: () => setMode("cluster"), title: "Cluster" },
                    React.createElement(Network, { size: 16 })))),
        showAdd ? (React.createElement("div", { className: "kole-quickadd" },
            React.createElement("textarea", { value: quickText, onChange: e => setQuickText(e.target.value), placeholder: "Quick crumb\u2026", className: "kole-input", rows: 3, autoFocus: true }),
            React.createElement("div", { className: "kole-quickadd-actions" },
                React.createElement("button", { className: "kole-btn-ghost", onClick: () => { setShowAdd(false); setQuickText(""); } },
                    React.createElement(X, { size: 14 }),
                    " Cancel"),
                React.createElement("button", { className: "kole-btn-primary", onClick: handleQuickAdd, disabled: !quickText.trim() },
                    React.createElement(Plus, { size: 14 }),
                    " Add")))) : (React.createElement("button", { className: "kole-btn-add", onClick: () => setShowAdd(true) },
            React.createElement(Plus, { size: 16 }),
            " Quick add")),
        mode === "list"
            ? React.createElement(LotListView, { notes: notes, links: links, onOpenNote: onOpenNote, onPromote: onPromote })
            : React.createElement(ClusterView, { notes: notes, bits: bits, links: links, onOpenNote: onOpenNote, onOpenBit: onOpenBit })));
}
function LotListView({ notes, links, onOpenNote, onPromote }) {
    if (notes.length === 0) {
        return (React.createElement("div", { className: "kole-empty" },
            React.createElement("div", { className: "kole-empty-mark" }, "\u2205"),
            React.createElement("div", { className: "kole-empty-title" }, "Empty lot"),
            React.createElement("div", { className: "kole-empty-sub" }, "Capture a crumb to start")));
    }
    return (React.createElement("div", { className: "kole-notes" }, notes.map(n => {
        const linkCount = links.filter(l => l.a === n.id || l.b === n.id).length;
        return (React.createElement("div", { key: n.id, className: "kole-note-card" },
            React.createElement("button", { className: "kole-note-body", onClick: () => onOpenNote({ ...n, kind: "note" }) },
                React.createElement("div", { className: "kole-note-text" }, n.text),
                React.createElement("div", { className: "kole-note-meta" },
                    React.createElement("span", null, prettyDate(n.created)),
                    linkCount > 0 && React.createElement("span", { className: "kole-note-links" },
                        React.createElement(Link2, { size: 10 }),
                        " ",
                        linkCount))),
            React.createElement("button", { className: "kole-promote-btn", onClick: (e) => { e.stopPropagation(); onPromote(n.id); }, title: "Promote to pipeline" },
                React.createElement(Send, { size: 14 }))));
    })));
}
// ============ CLUSTER VIEW ============
function ClusterView({ notes, bits, links, onOpenNote, onOpenBit }) {
    const width = 360;
    const allItems = [
        ...notes.map(n => ({ ...n, kind: "note" })),
        ...bits.map(b => ({ ...b, kind: "bit" }))
    ];
    const itemMap = Object.fromEntries(allItems.map(i => [i.id, i]));
    const visited = new Set();
    const clusters = [];
    const adj = {};
    for (const item of allItems)
        adj[item.id] = [];
    for (const l of links) {
        if (adj[l.a] && adj[l.b]) {
            adj[l.a].push(l.b);
            adj[l.b].push(l.a);
        }
    }
    for (const item of allItems) {
        if (visited.has(item.id))
            continue;
        const cluster = [];
        const queue = [item.id];
        while (queue.length) {
            const current = queue.shift();
            if (visited.has(current))
                continue;
            visited.add(current);
            cluster.push(itemMap[current]);
            for (const n of (adj[current] || [])) {
                if (!visited.has(n))
                    queue.push(n);
            }
        }
        if (cluster.length > 1)
            clusters.push(cluster);
    }
    if (clusters.length === 0) {
        return (React.createElement("div", { className: "kole-empty" },
            React.createElement("div", { className: "kole-empty-mark" }, "\u2726"),
            React.createElement("div", { className: "kole-empty-title" }, "No clusters yet"),
            React.createElement("div", { className: "kole-empty-sub" }, "Link items together to see them thread here"),
            React.createElement("div", { className: "kole-empty-hint" }, "Open any note or bit, tap \"Connect to\u2026\" and pick related items.")));
    }
    return (React.createElement("div", { className: "kole-clusters" }, clusters.map((cluster, i) => (React.createElement(ClusterBubble, { key: i, items: cluster, links: links, width: width, height: Math.max(280, cluster.length * 55), onOpen: (item) => item.kind === "bit" ? onOpenBit(item) : onOpenNote(item) })))));
}
function ClusterBubble({ items, links, width, height, onOpen }) {
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) / 2 - 70;
    const positions = {};
    if (items.length === 1)
        positions[items[0].id] = { x: cx, y: cy };
    else if (items.length === 2) {
        positions[items[0].id] = { x: cx - 80, y: cy };
        positions[items[1].id] = { x: cx + 80, y: cy };
    }
    else {
        items.forEach((item, i) => {
            const angle = (i / items.length) * Math.PI * 2 - Math.PI / 2;
            positions[item.id] = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
        });
    }
    const clusterLinks = links.filter(l => items.some(i => i.id === l.a) && items.some(i => i.id === l.b));
    return (React.createElement("div", { className: "kole-cluster" },
        React.createElement("svg", { width: width, height: height, className: "kole-cluster-svg", viewBox: `0 0 ${width} ${height}` },
            clusterLinks.map(l => {
                const p1 = positions[l.a];
                const p2 = positions[l.b];
                if (!p1 || !p2)
                    return null;
                return React.createElement("line", { key: l.id, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, stroke: "#444", strokeWidth: "1.5", strokeDasharray: "3 3" });
            }),
            items.map(item => {
                const pos = positions[item.id];
                if (!pos)
                    return null;
                const isBit = item.kind === "bit";
                const stageInfo = isBit ? STAGES.find(s => s.id === item.stage) : null;
                const fill = isBit ? (stageInfo?.color || "#888") : "#1c1c1c";
                return (React.createElement("g", { key: item.id, onClick: () => onOpen(item), style: { cursor: "pointer" }, className: "kole-cluster-node" },
                    React.createElement("ellipse", { cx: pos.x, cy: pos.y, rx: "70", ry: "30", fill: fill, stroke: isBit ? fill : "#555", strokeWidth: "2", opacity: isBit ? 0.9 : 1 }),
                    React.createElement("foreignObject", { x: pos.x - 65, y: pos.y - 24, width: "130", height: "48" },
                        React.createElement("div", { className: "kole-cluster-label", style: { color: isBit ? "#111" : "#f5f0e8" } }, itemTitle(item))),
                    isBit && (React.createElement("text", { x: pos.x, y: pos.y + 46, textAnchor: "middle", fill: "#888", fontSize: "9", fontFamily: "monospace", style: { textTransform: "uppercase", letterSpacing: "0.05em" } }, stageInfo?.label || ""))));
            }))));
}
// ============ NOTE DETAIL ============
function NoteView({ note, onUpdate, onDelete, onPromote, onBack, allItems, linkedIds, onToggleLink, findItem, onOpenLinked }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [showLinker, setShowLinker] = useState(false);
    if (!note)
        return null;
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-bit-header" },
            React.createElement("button", { className: "kole-icon-btn", onClick: onBack },
                React.createElement(ArrowLeft, { size: 18 })),
            React.createElement("div", { className: "kole-bit-header-stage", style: { background: "#555" } }, "Parking Lot"),
            React.createElement("button", { className: "kole-icon-btn", onClick: () => setConfirmDelete(true) },
                React.createElement(Trash2, { size: 16 }))),
        confirmDelete && React.createElement(ConfirmModal, { title: "Throw it out?", sub: "This crumb will be gone.", onCancel: () => setConfirmDelete(false), onConfirm: onDelete }),
        React.createElement("div", { className: "kole-fields" },
            React.createElement(FieldBlock, { label: "Note", hint: "Edit freely. It's your parking lot." },
                React.createElement("textarea", { className: "kole-textarea", rows: 6, value: note.text, onChange: e => onUpdate({ text: e.target.value }) })),
            React.createElement(ConnectionsSection, { linkedIds: linkedIds, findItem: findItem, onOpenLinked: onOpenLinked, onOpenLinker: () => setShowLinker(true), onRemoveLink: (o) => onToggleLink(o) }),
            showLinker && React.createElement(LinkerModal, { allItems: allItems.filter(i => i.id !== note.id), linkedIds: linkedIds, onToggle: onToggleLink, onClose: () => setShowLinker(false) })),
        React.createElement("div", { className: "kole-advance" },
            React.createElement("button", { className: "kole-btn-primary", onClick: onPromote },
                React.createElement(Send, { size: 16 }),
                " Promote to Pipeline"),
            React.createElement("div", { className: "kole-capture-hint" }, "Ready to work this one into a bit? Promote it and it enters the Raw stage."))));
}
// ============ BIT DETAIL ============
function BitView({ bit, onUpdate, onAdvance, onDelete, onBack, allItems, linkedIds, onToggleLink, findItem, onOpenLinked }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [showLinker, setShowLinker] = useState(false);
    if (!bit)
        return null;
    const stageIdx = STAGES.findIndex(s => s.id === bit.stage);
    const currentStage = STAGES[stageIdx];
    const nextStage = STAGES[stageIdx + 1];
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-bit-header" },
            React.createElement("button", { className: "kole-icon-btn", onClick: onBack },
                React.createElement(ArrowLeft, { size: 18 })),
            React.createElement("div", { className: "kole-bit-header-stage", style: { background: currentStage.color } }, currentStage.label),
            React.createElement("button", { className: "kole-icon-btn", onClick: () => setConfirmDelete(true) },
                React.createElement(Trash2, { size: 16 }))),
        confirmDelete && React.createElement(ConfirmModal, { title: "Throw out this bit?", sub: "Judy says kill your clunkers. But you can't get it back.", onCancel: () => setConfirmDelete(false), onConfirm: onDelete }),
        React.createElement("div", { className: "kole-progress-track" }, STAGES.map((s, i) => (React.createElement("div", { key: s.id, className: `kole-progress-node ${i <= stageIdx ? "done" : ""}`, style: i === stageIdx ? { background: s.color } : {} })))),
        React.createElement("div", { className: "kole-stage-exp" },
            React.createElement("div", { className: "kole-stage-exp-label", style: { color: currentStage.color } }, currentStage.label),
            React.createElement("div", { className: "kole-stage-exp-desc" }, currentStage.description)),
        React.createElement("div", null,
            React.createElement(StageFields, { bit: bit, onUpdate: onUpdate }),
            React.createElement(ConnectionsSection, { linkedIds: linkedIds, findItem: findItem, onOpenLinked: onOpenLinked, onOpenLinker: () => setShowLinker(true), onRemoveLink: (o) => onToggleLink(o) }),
            showLinker && React.createElement(LinkerModal, { allItems: allItems.filter(i => i.id !== bit.id), linkedIds: linkedIds, onToggle: onToggleLink, onClose: () => setShowLinker(false) })),
        nextStage ? (React.createElement("div", { className: "kole-advance" },
            React.createElement("button", { className: "kole-btn-primary kole-btn-advance", onClick: () => onAdvance(nextStage.id) },
                "Advance to ",
                nextStage.label,
                " ",
                React.createElement(ArrowRight, { size: 16 })),
            stageIdx > 0 && (React.createElement("button", { className: "kole-btn-ghost", onClick: () => onAdvance(STAGES[stageIdx - 1].id) },
                React.createElement(ArrowLeft, { size: 12 }),
                " Back to ",
                STAGES[stageIdx - 1].label)))) : (React.createElement("div", { className: "kole-advance" },
            React.createElement("div", { className: "kole-final" }, "\uD83C\uDFA4 In your set list. Go perform it.")))));
}
// ============ CONNECTIONS ============
function ConnectionsSection({ linkedIds, findItem, onOpenLinked, onOpenLinker, onRemoveLink }) {
    const linked = linkedIds.map(findItem).filter(Boolean);
    return (React.createElement("div", { className: "kole-field kole-connections" },
        React.createElement("div", { className: "kole-field-label" }, "Connections"),
        React.createElement("div", { className: "kole-field-hint" }, "Link to other notes, bits, or set pieces that share a theme, character, or joke."),
        React.createElement("div", { className: "kole-connection-list" },
            linked.length === 0 && React.createElement("div", { className: "kole-no-connections" }, "Nothing connected yet."),
            linked.map(item => {
                const isBit = item.kind === "bit";
                const stageInfo = isBit ? STAGES.find(s => s.id === item.stage) : null;
                return (React.createElement("div", { key: item.id, className: "kole-connection-item" },
                    React.createElement("button", { className: "kole-connection-body", onClick: () => onOpenLinked(item) },
                        React.createElement("div", { className: "kole-connection-badge", style: { background: isBit ? stageInfo?.color : "#555" } }, isBit ? stageInfo?.short || "BIT" : "LOT"),
                        React.createElement("div", { className: "kole-connection-text" }, itemTitle(item))),
                    React.createElement("button", { className: "kole-icon-btn-sm", onClick: () => onRemoveLink(item.id), title: "Unlink" },
                        React.createElement(Unlink, { size: 13 }))));
            })),
        React.createElement("button", { className: "kole-btn-ghost kole-btn-connect", onClick: onOpenLinker },
            React.createElement(Link2, { size: 14 }),
            " Connect to\u2026")));
}
function LinkerModal({ allItems, linkedIds, onToggle, onClose }) {
    const [search, setSearch] = useState("");
    const filtered = allItems.filter(i => itemPreview(i).toLowerCase().includes(search.toLowerCase()));
    return (React.createElement("div", { className: "kole-modal-backdrop", onClick: onClose },
        React.createElement("div", { className: "kole-modal kole-modal-linker", onClick: e => e.stopPropagation() },
            React.createElement("div", { className: "kole-modal-title" }, "Connect to\u2026"),
            React.createElement("input", { className: "kole-input", placeholder: "Search your material", value: search, onChange: e => setSearch(e.target.value), style: { marginBottom: 12 }, autoFocus: true }),
            React.createElement("div", { className: "kole-linker-list" },
                filtered.length === 0 && (React.createElement("div", { className: "kole-no-connections", style: { textAlign: "center", padding: 30 } }, allItems.length === 0 ? "Nothing else to connect to yet." : "No matches.")),
                filtered.map(item => {
                    const isLinked = linkedIds.includes(item.id);
                    const isBit = item.kind === "bit";
                    const stageInfo = isBit ? STAGES.find(s => s.id === item.stage) : null;
                    return (React.createElement("button", { key: item.id, className: `kole-linker-item ${isLinked ? "linked" : ""}`, onClick: () => onToggle(item.id) },
                        React.createElement("div", { className: "kole-connection-badge", style: { background: isBit ? stageInfo?.color : "#555" } }, isBit ? stageInfo?.short || "BIT" : "LOT"),
                        React.createElement("div", { className: "kole-linker-text" }, itemTitle(item)),
                        isLinked ? React.createElement(Check, { size: 16, color: "#4ade80" }) : React.createElement(Plus, { size: 14, color: "#888" })));
                })),
            React.createElement("div", { className: "kole-modal-actions" },
                React.createElement("button", { className: "kole-btn-primary", onClick: onClose, style: { width: "auto", flex: 1 } }, "Done")))));
}
function ConfirmModal({ title, sub, onCancel, onConfirm }) {
    return (React.createElement("div", { className: "kole-modal-backdrop", onClick: onCancel },
        React.createElement("div", { className: "kole-modal", onClick: e => e.stopPropagation() },
            React.createElement("div", { className: "kole-modal-title" }, title),
            React.createElement("div", { className: "kole-modal-sub" }, sub),
            React.createElement("div", { className: "kole-modal-actions" },
                React.createElement("button", { className: "kole-btn-ghost", onClick: onCancel }, "Keep it"),
                React.createElement("button", { className: "kole-btn-danger", onClick: onConfirm }, "Throw out")))));
}
function CheckinModal({ onSave, onClose, streak }) {
    const [step, setStep] = useState("ask"); // ask | yesNote
    const [note, setNote] = useState("");
    const { listening, supported, start, stop } = useSpeechRecognition((newText) => {
        setNote(prev => (prev ? prev + " " : "") + newText);
    });
    const handleYes = () => setStep("yesNote");
    const handleNo = () => onSave(false, "");
    const handleSaveNote = () => {
        if (listening)
            stop();
        onSave(true, note.trim());
    };
    return (React.createElement("div", { className: "kole-modal-backdrop" },
        React.createElement("div", { className: "kole-modal kole-checkin-modal", onClick: e => e.stopPropagation() }, step === "ask" ? (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "kole-checkin-flame" },
                React.createElement(Flame, { size: 28 })),
            React.createElement("div", { className: "kole-modal-title", style: { textAlign: "center", fontSize: 28 } }, "Did you write today?"),
            React.createElement("div", { className: "kole-modal-sub", style: { textAlign: "center" } }, streak > 0
                ? React.createElement(React.Fragment, null,
                    "You're on a ",
                    React.createElement("b", { style: { color: "var(--accent)" } },
                        streak,
                        "-day"),
                    " streak. Keep the flame.")
                : React.createElement(React.Fragment, null, "Day one starts now. Or tomorrow. Your call.")),
            React.createElement("div", { className: "kole-checkin-actions" },
                React.createElement("button", { className: "kole-checkin-btn no", onClick: handleNo },
                    React.createElement(X, { size: 18 }),
                    " Not today"),
                React.createElement("button", { className: "kole-checkin-btn yes", onClick: handleYes },
                    React.createElement(Check, { size: 18 }),
                    " Yes I wrote")),
            React.createElement("button", { className: "kole-checkin-skip", onClick: onClose }, "Ask me later"))) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "kole-modal-title", style: { fontSize: 24 } }, "Nice. What'd you write?"),
            React.createElement("div", { className: "kole-modal-sub" }, "One line is fine. Or skip it. The streak counts either way."),
            React.createElement("div", { className: "kole-daily-input-wrap", style: { margin: "4px 0 14px" } },
                React.createElement("textarea", { className: "kole-textarea", rows: 3, value: note, onChange: e => setNote(e.target.value), placeholder: listening ? "Listening…" : "e.g. 'Substack draft about the weird cat lady downstairs'", autoFocus: true }),
                supported && (React.createElement("button", { className: `kole-mic-inline ${listening ? "listening" : ""}`, onClick: listening ? stop : start, style: { top: 8, right: 8 } }, listening ? React.createElement(MicOff, { size: 16 }) : React.createElement(Mic, { size: 16 })))),
            React.createElement("div", { className: "kole-modal-actions" },
                React.createElement("button", { className: "kole-btn-ghost", onClick: () => onSave(true, "") }, "Skip note"),
                React.createElement("button", { className: "kole-btn-primary", onClick: handleSaveNote, style: { width: "auto", flex: 1 } },
                    React.createElement(Check, { size: 16 }),
                    " Log it")))))));
}
// ============ SYNC INDICATOR ============
function SyncIndicator({ driveConnected, syncStatus, onClick }) {
    let icon, label, className;
    if (!driveConnected) {
        icon = React.createElement(CloudOff, { size: 13 });
        label = "Local only";
        className = "offline";
    }
    else if (syncStatus === "syncing") {
        icon = React.createElement(RefreshCw, { size: 13, className: "kole-spin" });
        label = "Syncing";
        className = "syncing";
    }
    else if (syncStatus === "synced") {
        icon = React.createElement(Cloud, { size: 13 });
        label = "Synced";
        className = "synced";
    }
    else if (syncStatus === "unsynced") {
        icon = React.createElement(Cloud, { size: 13 });
        label = "Unsynced";
        className = "unsynced";
    }
    else if (syncStatus === "error") {
        icon = React.createElement(CloudOff, { size: 13 });
        label = "Sync error";
        className = "error";
    }
    else {
        icon = React.createElement(Cloud, { size: 13 });
        label = "Idle";
        className = "";
    }
    return (React.createElement("button", { className: `kole-sync-indicator ${className}`, onClick: onClick, title: "Sync settings" },
        icon,
        React.createElement("span", null, label)));
}
// ============ SETTINGS MODAL ============
function SettingsModal({ driveConnected, syncStatus, syncError, lastSyncAt, onConnect, onDisconnect, onManualSync, onClose }) {
    const [confirming, setConfirming] = useState(false);
    const relativeTime = (iso) => {
        if (!iso)
            return "Never";
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60000)
            return "Just now";
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000)
            return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };
    return (React.createElement("div", { className: "kole-modal-backdrop", onClick: onClose },
        React.createElement("div", { className: "kole-modal kole-settings-modal", onClick: e => e.stopPropagation() },
            React.createElement("div", { className: "kole-settings-header" },
                React.createElement("div", { className: "kole-modal-title", style: { margin: 0 } }, "Settings"),
                React.createElement("button", { className: "kole-icon-btn", onClick: onClose },
                    React.createElement(X, { size: 16 }))),
            React.createElement("div", { className: "kole-settings-section" },
                React.createElement("div", { className: "kole-settings-label" }, "Cloud sync"),
                !driveConnected ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "kole-settings-desc" },
                        "Connect Google Drive to back up your material and sync across devices. One file: ",
                        React.createElement("code", null, DRIVE_FILE_NAME),
                        "."),
                    React.createElement("button", { className: "kole-btn-primary", onClick: onConnect, disabled: syncStatus === "syncing" },
                        React.createElement(Cloud, { size: 16 }),
                        " ",
                        syncStatus === "syncing" ? "Connecting…" : "Connect Google Drive"),
                    syncStatus === "error" && syncError && (React.createElement("div", { className: "kole-warn", style: { marginTop: 10 } }, syncError)))) : (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "kole-settings-status" },
                        React.createElement("div", { className: "kole-settings-status-row" },
                            React.createElement("span", { className: "kole-settings-status-label" }, "Status"),
                            React.createElement("span", { className: `kole-settings-status-value ${syncStatus}` },
                                syncStatus === "syncing" && "Syncing…",
                                syncStatus === "synced" && "✓ Up to date",
                                syncStatus === "unsynced" && "● Unsynced changes",
                                syncStatus === "error" && "✗ Error",
                                (syncStatus === "idle" || !syncStatus) && "Ready")),
                        React.createElement("div", { className: "kole-settings-status-row" },
                            React.createElement("span", { className: "kole-settings-status-label" }, "Last sync"),
                            React.createElement("span", { className: "kole-settings-status-value" }, relativeTime(lastSyncAt))),
                        React.createElement("div", { className: "kole-settings-status-row" },
                            React.createElement("span", { className: "kole-settings-status-label" }, "Schedule"),
                            React.createElement("span", { className: "kole-settings-status-value" }, "Every 2 min when changes exist"))),
                    syncError && syncStatus === "error" && (React.createElement("div", { className: "kole-warn", style: { marginTop: 10, marginBottom: 10 } }, syncError)),
                    React.createElement("button", { className: "kole-btn-primary", onClick: onManualSync, disabled: syncStatus === "syncing", style: { marginBottom: 10 } },
                        React.createElement(RefreshCw, { size: 14, className: syncStatus === "syncing" ? "kole-spin" : "" }),
                        syncStatus === "syncing" ? "Syncing…" : "Sync now"),
                    !confirming ? (React.createElement("button", { className: "kole-btn-ghost", onClick: () => setConfirming(true), style: { width: "100%", justifyContent: "center" } },
                        React.createElement(LogOut, { size: 14 }),
                        " Disconnect Drive")) : (React.createElement("div", { className: "kole-settings-confirm" },
                        React.createElement("div", { className: "kole-settings-desc", style: { color: "#fbbf24" } }, "Disconnect? Your data stays on Drive and on this device. You just stop auto-syncing until you reconnect."),
                        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
                            React.createElement("button", { className: "kole-btn-ghost", onClick: () => setConfirming(false), style: { flex: 1, justifyContent: "center" } }, "Cancel"),
                            React.createElement("button", { className: "kole-btn-danger", onClick: () => { onDisconnect(); setConfirming(false); }, style: { flex: 1 } }, "Disconnect"))))))),
            React.createElement("div", { className: "kole-settings-section" },
                React.createElement("div", { className: "kole-settings-label" }, "About"),
                React.createElement("div", { className: "kole-settings-desc", style: { fontStyle: "italic" } }, "Comedy Bible Homework \u2014 feral style. Based on Judy Carter's method. Written for one person, not the masses.")))));
}
// ============ PIPELINE ============
function PipelineView({ bits, onOpenBit, links }) {
    const [collapsed, setCollapsed] = useState({});
    const byStage = STAGES.map(s => ({ ...s, bits: bits.filter(b => b.stage === s.id) }));
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-header" },
            React.createElement("div", null,
                React.createElement("h1", { className: "kole-title" }, "Pipeline"),
                React.createElement("div", { className: "kole-sub" },
                    bits.length,
                    " ",
                    bits.length === 1 ? "bit" : "bits",
                    " in progress"))),
        bits.length === 0 && (React.createElement("div", { className: "kole-empty" },
            React.createElement("div", { className: "kole-empty-mark" }, "\u2205"),
            React.createElement("div", { className: "kole-empty-title" }, "Nothing in the pipeline yet"),
            React.createElement("div", { className: "kole-empty-sub" }, "Capture a raw idea to start"))),
        React.createElement("div", { className: "kole-stages" }, byStage.map(stage => {
            if (stage.bits.length === 0)
                return null;
            const isCollapsed = collapsed[stage.id];
            return (React.createElement("div", { key: stage.id, className: "kole-stage" },
                React.createElement("div", { className: "kole-stage-header", onClick: () => setCollapsed(c => ({ ...c, [stage.id]: !c[stage.id] })) },
                    React.createElement("div", { className: "kole-stage-dot", style: { background: stage.color } }),
                    React.createElement("div", { className: "kole-stage-label" }, stage.label),
                    React.createElement("div", { className: "kole-stage-count" }, stage.bits.length),
                    React.createElement(ChevronDown, { size: 14, className: `kole-chevron ${isCollapsed ? "collapsed" : ""}` })),
                !isCollapsed && (React.createElement("div", { className: "kole-stage-bits" }, stage.bits.map(b => {
                    const linkCount = links.filter(l => l.a === b.id || l.b === b.id).length;
                    return (React.createElement("button", { key: b.id, className: "kole-bit-card", onClick: () => onOpenBit({ ...b, kind: "bit" }) },
                        React.createElement("div", { className: "kole-bit-text" }, b.rework || b.actout || b.premise || b.topic || b.raw),
                        React.createElement("div", { className: "kole-bit-meta" },
                            React.createElement("span", null, prettyDate(b.updated)),
                            React.createElement("div", { className: "kole-bit-meta-right" },
                                linkCount > 0 && React.createElement("span", { className: "kole-bit-links" },
                                    React.createElement(Link2, { size: 10 }),
                                    " ",
                                    linkCount),
                                React.createElement(ArrowRight, { size: 12 })))));
                })))));
        }))));
}
// ============ STAGE FIELDS ============
function StageFields({ bit, onUpdate }) {
    const TOPIC_CATEGORIES = ["Childhood", "Love/Relationship", "Job", "Special Challenge", "Current Event", "Other"];
    const ATTITUDES = ["Hard", "Weird", "Stupid", "Scary"];
    return (React.createElement("div", { className: "kole-fields" },
        React.createElement(FieldBlock, { label: "Raw thought", locked: true },
            React.createElement("div", { className: "kole-raw-display" }, bit.raw)),
        ["topic", "premise", "authentic", "actout", "mix", "rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Topic", hint: "What's this ABOUT in one short phrase \u2014 no 'I/me/my'" },
            React.createElement("input", { className: "kole-input", value: bit.topic, onChange: e => onUpdate({ topic: e.target.value }), placeholder: "e.g., 'growing up with an alcoholic mom'" }),
            React.createElement("div", { className: "kole-chips" }, TOPIC_CATEGORIES.map(cat => (React.createElement("button", { key: cat, className: `kole-chip ${bit.topicCategory === cat ? "active" : ""}`, onClick: () => onUpdate({ topicCategory: bit.topicCategory === cat ? "" : cat }) }, cat)))))),
        ["premise", "authentic", "actout", "mix", "rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Premise", hint: "'What's hard/weird/stupid/scary about X is Y.' No I, me, or my. TRUE, not funny yet." },
            React.createElement("textarea", { className: "kole-textarea", rows: 3, value: bit.premise, onChange: e => onUpdate({ premise: e.target.value }), placeholder: "What's weird about growing up with an alcoholic mother is that you think everyone's mother is like yours." }))),
        ["authentic", "actout", "mix", "rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Authentic check", hint: "Is this really yours? Would a stranger relate?" },
            React.createElement("textarea", { className: "kole-textarea", rows: 2, value: bit.authenticNotes, onChange: e => onUpdate({ authenticNotes: e.target.value }), placeholder: "This is mine because\u2026 / A stranger would get it because\u2026" }))),
        ["actout", "mix", "rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Act-out", hint: "The funny part. Who do you BECOME? Voice, posture, face." },
            React.createElement("textarea", { className: "kole-textarea", rows: 3, value: bit.actout, onChange: e => onUpdate({ actout: e.target.value }), placeholder: "[acts out drunk mom slurring] 'Oh honey, your homework is just\u2026 just do your best\u2026'" }))),
        ["mix", "rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Mix", hint: "Take this character/situation somewhere unexpected." },
            React.createElement("textarea", { className: "kole-textarea", rows: 3, value: bit.mix, onChange: e => onUpdate({ mix: e.target.value }), placeholder: "Can you imagine my alcoholic mom as a kindergarten teacher?" }))),
        ["rework", "hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Rework (Take Two)", hint: "Strip filler. Present tense. ONE attitude." },
            React.createElement("textarea", { className: "kole-textarea", rows: 4, value: bit.rework, onChange: e => onUpdate({ rework: e.target.value }), placeholder: "The final, tight version. Read it out loud." }))),
        ["hot", "set"].includes(bit.stage) && (React.createElement(FieldBlock, { label: "Hot check", hint: "Does it still work? Audience tested?" },
            React.createElement("textarea", { className: "kole-textarea", rows: 2, value: bit.hotNotes, onChange: e => onUpdate({ hotNotes: e.target.value }), placeholder: "Worked at the open mic on the 15th. / Didn't land \u2014 rework." }))),
        bit.stage === "set" && (React.createElement(React.Fragment, null,
            React.createElement(FieldBlock, { label: "Set list position", hint: "What order does it go in the set? 1 = opener." },
                React.createElement("input", { className: "kole-input", type: "number", value: bit.setPosition || "", onChange: e => onUpdate({ setPosition: parseInt(e.target.value) || null }), placeholder: "1, 2, 3\u2026" })),
            React.createElement(FieldBlock, { label: "Attitude word", hint: "The emotional plug-in. Pick one." },
                React.createElement("div", { className: "kole-chips" }, ATTITUDES.map(a => (React.createElement("button", { key: a, className: `kole-chip ${bit.setAttitude === a ? "active" : ""}`, onClick: () => onUpdate({ setAttitude: bit.setAttitude === a ? "" : a }) }, a)))))))));
}
function FieldBlock({ label, hint, children, locked }) {
    return (React.createElement("div", { className: `kole-field ${locked ? "locked" : ""}` },
        React.createElement("div", { className: "kole-field-label" }, label),
        hint && React.createElement("div", { className: "kole-field-hint" }, hint),
        React.createElement("div", null, children)));
}
// ============ SET LIST ============
function SetListView({ bits, onOpenBit }) {
    return (React.createElement("div", { className: "kole-view" },
        React.createElement("header", { className: "kole-header" },
            React.createElement("div", null,
                React.createElement("h1", { className: "kole-title" }, "Set List"),
                React.createElement("div", { className: "kole-sub" },
                    bits.length,
                    " bits ready to run"))),
        bits.length === 0 ? (React.createElement("div", { className: "kole-empty" },
            React.createElement("div", { className: "kole-empty-mark" }, "\uD83C\uDFA4"),
            React.createElement("div", { className: "kole-empty-title" }, "No bits in the set yet"),
            React.createElement("div", { className: "kole-empty-sub" }, "Move bits through the pipeline to get here"))) : (React.createElement("div", { className: "kole-setlist-items" }, bits.map((b, i) => (React.createElement("div", { key: b.id, className: "kole-set-item" },
            React.createElement("div", { className: "kole-set-number" }, b.setPosition || i + 1),
            React.createElement("button", { className: "kole-set-content", onClick: () => onOpenBit({ ...b, kind: "bit" }) },
                React.createElement("div", { className: "kole-set-topic" },
                    b.setAttitude && React.createElement("span", { className: "kole-set-attitude" }, b.setAttitude),
                    b.topic || "(no topic)"),
                React.createElement("div", { className: "kole-set-preview" }, b.rework || b.actout || b.premise || b.raw)))))))));
}
// ============ DAILY ============
function DailyView({ log, checkinLog = {}, onSave, streak }) {
    const todayEntry = log[today()];
    const [text, setText] = useState(todayEntry?.text || "");
    const [promptIdx, setPromptIdx] = useState(0);
    const [timerSec, setTimerSec] = useState(20 * 60);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(!!todayEntry);
    const [celebrating, setCelebrating] = useState(false);
    const timerRef = useRef(null);
    const { listening, supported, start, stop } = useSpeechRecognition((newText) => {
        setText(prev => (prev ? prev + " " : "") + newText);
    });
    useEffect(() => {
        if (running && timerSec > 0)
            timerRef.current = setTimeout(() => setTimerSec(s => s - 1), 1000);
        if (timerSec === 0 && running) {
            setRunning(false);
            playVictorySound();
            setCelebrating(true);
            setTimeout(() => setCelebrating(false), 4500);
        }
        return () => clearTimeout(timerRef.current);
    }, [running, timerSec]);
    const currentPrompt = DAILY_PROMPTS[promptIdx];
    const minutes = Math.floor(timerSec / 60);
    const seconds = timerSec % 60;
    const handleSave = () => {
        if (!text.trim())
            return;
        if (listening)
            stop();
        onSave({ prompt: currentPrompt.type, text: text.trim(), minutes: 20 - minutes, at: new Date().toISOString() });
        setDone(true);
    };
    const mergedEntries = (() => {
        const all = {};
        // Daily entries take priority
        for (const [date, entry] of Object.entries(log)) {
            all[date] = { kind: "daily", ...entry };
        }
        // Add check-ins if no daily entry for that date
        for (const [date, entry] of Object.entries(checkinLog)) {
            if (!all[date])
                all[date] = { kind: "checkin", ...entry };
        }
        return Object.entries(all).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
    })();
    return (React.createElement("div", { className: "kole-view" },
        celebrating && (React.createElement("div", { className: "kole-celebration", onClick: () => setCelebrating(false) },
            React.createElement("div", { className: "kole-celebration-inner" },
                React.createElement("div", { className: "kole-celebration-confetti" }, Array.from({ length: 40 }).map((_, i) => (React.createElement("span", { key: i, className: "kole-confetti-piece", style: {
                        left: `${Math.random() * 100}%`,
                        animationDelay: `${Math.random() * 0.6}s`,
                        animationDuration: `${2 + Math.random() * 1.5}s`,
                        background: ["#f97316", "#4ade80", "#fbbf24", "#f5f0e8", "#ec4899"][i % 5],
                    } })))),
                React.createElement("div", { className: "kole-celebration-emoji" }, "\uD83C\uDF89"),
                React.createElement("div", { className: "kole-celebration-title" }, "You did it"),
                React.createElement("div", { className: "kole-celebration-sub" }, "20 minutes of writing. That's the whole job."),
                React.createElement("button", { className: "kole-btn-ghost", onClick: () => setCelebrating(false) }, "Keep the glow \u2192")))),
        React.createElement("header", { className: "kole-header" },
            React.createElement("div", null,
                React.createElement("h1", { className: "kole-title" }, "Daily"),
                React.createElement("div", { className: "kole-sub" }, "Judy says write every day. 20 minutes. No excuses.")),
            React.createElement("div", { className: "kole-streak big" },
                React.createElement(Flame, { size: 18 }),
                React.createElement("span", null, streak),
                React.createElement("span", { className: "kole-streak-label" }, "day streak"))),
        done ? (React.createElement("div", { className: "kole-daily-done" },
            React.createElement(CheckCircle2, { size: 32 }),
            React.createElement("div", { className: "kole-done-title" }, "Done for today"),
            React.createElement("div", { className: "kole-done-sub" }, "You wrote. That's the whole job."),
            React.createElement("button", { className: "kole-btn-ghost", onClick: () => { setDone(false); setText(""); } }, "Write more \u2192"))) : (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "kole-prompt-card" },
                React.createElement("div", { className: "kole-prompt-type" }, currentPrompt.type),
                React.createElement("div", { className: "kole-prompt-text" }, currentPrompt.prompt),
                React.createElement("button", { className: "kole-prompt-shuffle", onClick: () => setPromptIdx((promptIdx + 1) % DAILY_PROMPTS.length) }, "Different prompt \u2192")),
            React.createElement("div", { className: "kole-timer" },
                React.createElement("div", { className: "kole-timer-display" },
                    String(minutes).padStart(2, "0"),
                    ":",
                    String(seconds).padStart(2, "0")),
                React.createElement("button", { className: "kole-btn-ghost", onClick: () => setRunning(!running) }, running ? "Pause" : "Start timer"),
                timerSec !== 20 * 60 && (React.createElement("button", { className: "kole-btn-ghost", onClick: () => { setTimerSec(20 * 60); setRunning(false); } }, "Reset"))),
            React.createElement("div", { className: "kole-daily-input-wrap" },
                React.createElement("textarea", { className: "kole-daily-input", value: text, onChange: e => setText(e.target.value), placeholder: listening ? "Listening…" : "Just write. Don't edit.", rows: 10 }),
                supported && (React.createElement("button", { className: `kole-mic-inline ${listening ? "listening" : ""}`, onClick: listening ? stop : start }, listening ? React.createElement(MicOff, { size: 16 }) : React.createElement(Mic, { size: 16 })))),
            React.createElement("button", { className: "kole-btn-primary", onClick: handleSave, disabled: !text.trim() },
                React.createElement(Check, { size: 16 }),
                " Save today's writing"))),
        mergedEntries.length > 0 && (React.createElement("div", { className: "kole-log" },
            React.createElement("div", { className: "kole-log-title" }, "Recent"),
            mergedEntries.map(([date, entry]) => (React.createElement("div", { key: date, className: "kole-log-entry" },
                React.createElement("div", { className: "kole-log-date" }, prettyDate(date)),
                entry.kind === "daily" ? (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "kole-log-type" }, entry.prompt),
                    React.createElement("div", { className: "kole-log-preview" },
                        entry.text.slice(0, 100),
                        entry.text.length > 100 ? "…" : ""))) : (React.createElement(React.Fragment, null,
                    React.createElement("div", { className: "kole-log-type", style: { color: entry.didWrite ? "#4ade80" : "var(--text-faint)", fontSize: 14 } }, entry.didWrite ? "✓ Wrote today" : "— Didn't write"),
                    entry.note && (React.createElement("div", { className: "kole-log-preview" },
                        entry.note.slice(0, 100),
                        entry.note.length > 100 ? "…" : "")))))))))));
}
// ============ STYLES ============
const KOLE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Figtree:wght@400;500;600;700&display=swap');

.kole-app {
  --bg: #0a0a0a; --surface: #141414; --surface-2: #1c1c1c;
  --border: #2a2a2a; --text: #f5f0e8; --text-dim: #8a8278; --text-faint: #5a5550;
  --accent: #f97316; --accent-dim: #c2410c;
  --serif: 'Instrument Serif', Georgia, serif;
  --sans: 'Figtree', -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;
  font-family: var(--sans); background: var(--bg); color: var(--text);
  min-height: 100vh; max-width: 500px; margin: 0 auto; padding-bottom: 90px;
  position: relative; line-height: 1.5;
}

.kole-loading { font-family: var(--serif); font-size: 24px; color: #888; padding: 60px 20px; text-align: center; font-style: italic; }
.kole-view { padding: 42px 20px 40px; }
.kole-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; gap: 16px; }
.kole-logo { display: flex; align-items: center; gap: 12px; }
.kole-logo-mark { width: 40px; height: 40px; border-radius: 8px; background: var(--accent); color: #111; display: grid; place-items: center; font-family: var(--serif); font-size: 24px; font-style: italic; }
.kole-logo-title { font-family: var(--serif); font-size: 22px; font-style: italic; line-height: 1; }
.kole-logo-sub { font-size: 11px; color: var(--text-dim); letter-spacing: 0.05em; text-transform: uppercase; margin-top: 4px; }
.kole-title { font-family: var(--serif); font-size: 44px; font-weight: 400; font-style: italic; line-height: 1; margin: 0 0 6px; }
.kole-sub { font-size: 13px; color: var(--text-dim); }
.kole-streak { display: flex; align-items: center; gap: 4px; font-family: var(--mono); font-size: 13px; color: var(--accent); background: rgba(249, 115, 22, 0.1); padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(249, 115, 22, 0.3); }
.kole-streak.big { font-size: 15px; padding: 10px 14px; }
.kole-streak-label { color: var(--text-dim); font-size: 10px; margin-left: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

.kole-capture-main { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 20px; margin-bottom: 24px; }
.kole-capture-label { font-family: var(--serif); font-size: 22px; font-style: italic; margin-bottom: 12px; }
.kole-capture-input { width: 100%; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px; color: var(--text); font-family: var(--sans); font-size: 16px; line-height: 1.5; resize: vertical; margin-bottom: 12px; box-sizing: border-box; }
.kole-capture-input:focus { outline: none; border-color: var(--accent); }
.kole-capture-input::placeholder { color: var(--text-faint); font-style: italic; }

.kole-capture-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.kole-mic { width: 52px; height: 52px; border-radius: 50%; background: var(--surface-2); border: 2px solid var(--border); color: var(--text); cursor: pointer; display: grid; place-items: center; transition: all 0.15s; position: relative; flex-shrink: 0; }
.kole-mic:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.kole-mic.listening { background: var(--accent); border-color: var(--accent); color: #111; }
.kole-mic:disabled { opacity: 0.4; cursor: not-allowed; }
.kole-mic-pulse { position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--accent); animation: micPulse 1.5s ease-out infinite; }
@keyframes micPulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }

.kole-dest-toggle { display: flex; gap: 6px; flex: 1; min-width: 200px; }
.kole-dest-toggle button { flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; color: var(--text-dim); font-family: var(--sans); font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; }
.kole-dest-toggle button.active { background: var(--accent); color: #111; border-color: var(--accent); }

.kole-btn-primary { background: var(--accent); color: #111; border: none; border-radius: 10px; padding: 14px 20px; font-family: var(--sans); font-weight: 600; font-size: 14px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.15s; width: 100%; justify-content: center; }
.kole-btn-primary:hover:not(:disabled) { background: #ffa500; transform: translateY(-1px); }
.kole-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.kole-btn-ghost { background: transparent; color: var(--text-dim); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; font-family: var(--sans); font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
.kole-btn-ghost:hover { color: var(--text); border-color: var(--text-dim); }

.kole-btn-danger { background: #dc2626; color: white; border: none; border-radius: 10px; padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer; }

.kole-btn-add { background: transparent; color: var(--text-dim); border: 1.5px dashed var(--border); border-radius: 12px; padding: 12px 16px; font-family: var(--sans); font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-bottom: 16px; transition: all 0.15s; }
.kole-btn-add:hover { color: var(--accent); border-color: var(--accent); }

.kole-capture-hint { font-size: 12px; color: var(--text-dim); margin-top: 12px; line-height: 1.5; font-style: italic; }
.kole-warn { font-size: 12px; color: #fbbf24; background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); padding: 10px 12px; border-radius: 8px; margin-top: 12px; }

.kole-recent { margin-top: 20px; }
.kole-recent-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 12px; }
.kole-recent-item { padding: 12px 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; display: flex; align-items: center; gap: 10px; }
.kole-recent-badge { font-family: var(--mono); font-size: 9px; padding: 3px 7px; border-radius: 4px; font-weight: 600; letter-spacing: 0.05em; color: #111; flex-shrink: 0; }
.kole-recent-badge.pipeline { background: var(--accent); }
.kole-recent-badge.lot { background: #6b7280; color: white; }
.kole-recent-text { font-size: 14px; color: var(--text); flex: 1; line-height: 1.4; }
.kole-recent-meta { font-size: 11px; color: var(--text-faint); font-family: var(--mono); white-space: nowrap; }

.kole-mode-toggle { display: flex; gap: 2px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 3px; }
.kole-mode-toggle button { background: transparent; border: none; color: var(--text-dim); padding: 8px 12px; cursor: pointer; border-radius: 7px; transition: all 0.15s; }
.kole-mode-toggle button.active { background: var(--accent); color: #111; }

.kole-quickadd { background: var(--surface); border: 1px solid var(--accent); border-radius: 12px; padding: 14px; margin-bottom: 16px; }
.kole-quickadd-actions { display: flex; gap: 8px; margin-top: 10px; }
.kole-quickadd-actions button { flex: 1; }

.kole-notes { display: flex; flex-direction: column; gap: 8px; }
.kole-note-card { display: flex; align-items: stretch; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; transition: border-color 0.15s; }
.kole-note-card:hover { border-color: var(--text-dim); }
.kole-note-body { flex: 1; padding: 14px 16px; background: transparent; border: none; text-align: left; cursor: pointer; color: var(--text); font-family: var(--sans); }
.kole-note-text { font-size: 14px; line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.kole-note-meta { display: flex; gap: 12px; font-size: 11px; color: var(--text-faint); font-family: var(--mono); }
.kole-note-links { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); }
.kole-promote-btn { background: var(--surface-2); border: none; border-left: 1px solid var(--border); color: var(--text-dim); width: 48px; cursor: pointer; display: grid; place-items: center; transition: all 0.15s; }
.kole-promote-btn:hover { background: var(--accent); color: #111; }

.kole-clusters { display: flex; flex-direction: column; gap: 24px; }
.kole-cluster { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
.kole-cluster-svg { display: block; max-width: 100%; }
.kole-cluster-node:hover ellipse { stroke-width: 3; }
.kole-cluster-label { font-family: "Figtree", sans-serif; font-size: 11px; font-weight: 600; text-align: center; line-height: 1.2; padding: 4px; display: flex; align-items: center; justify-content: center; height: 48px; overflow: hidden; word-break: break-word; }
.kole-empty-hint { font-size: 12px; color: var(--text-faint); font-style: italic; max-width: 280px; margin: 12px auto 0; line-height: 1.5; }

.kole-empty { text-align: center; padding: 60px 20px; }
.kole-empty-mark { font-family: var(--serif); font-size: 64px; font-style: italic; color: var(--text-faint); margin-bottom: 16px; line-height: 1; }
.kole-empty-title { font-family: var(--serif); font-size: 22px; font-style: italic; color: var(--text); margin-bottom: 6px; }
.kole-empty-sub { font-size: 13px; color: var(--text-dim); }

.kole-stages { display: flex; flex-direction: column; gap: 16px; }
.kole-stage { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
.kole-stage-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; cursor: pointer; }
.kole-stage-header:hover { background: var(--surface-2); }
.kole-stage-dot { width: 10px; height: 10px; border-radius: 50%; }
.kole-stage-label { font-size: 14px; font-weight: 600; flex: 1; }
.kole-stage-count { font-family: var(--mono); font-size: 12px; color: var(--text-dim); background: var(--bg); padding: 2px 8px; border-radius: 6px; }
.kole-chevron { color: var(--text-dim); transition: transform 0.2s; }
.kole-chevron.collapsed { transform: rotate(-90deg); }
.kole-stage-bits { padding: 0 8px 8px; display: flex; flex-direction: column; gap: 6px; }
.kole-bit-card { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; text-align: left; cursor: pointer; width: 100%; color: var(--text); font-family: var(--sans); transition: all 0.15s; }
.kole-bit-card:hover { border-color: var(--accent); background: var(--surface-2); }
.kole-bit-text { font-size: 14px; line-height: 1.4; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.kole-bit-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--text-faint); font-family: var(--mono); }
.kole-bit-meta-right { display: flex; align-items: center; gap: 8px; }
.kole-bit-links { display: inline-flex; align-items: center; gap: 3px; color: var(--accent); }

.kole-bit-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.kole-icon-btn { width: 36px; height: 36px; border-radius: 8px; background: var(--surface); border: 1px solid var(--border); color: var(--text); cursor: pointer; display: grid; place-items: center; transition: all 0.15s; }
.kole-icon-btn:hover { background: var(--surface-2); border-color: var(--text-dim); }
.kole-icon-btn-sm { width: 28px; height: 28px; border-radius: 6px; background: transparent; border: none; color: var(--text-faint); cursor: pointer; display: grid; place-items: center; }
.kole-icon-btn-sm:hover { color: var(--accent); }
.kole-bit-header-stage { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600; color: #111; text-transform: uppercase; letter-spacing: 0.05em; }

.kole-progress-track { display: flex; gap: 2px; margin-bottom: 20px; }
.kole-progress-node { flex: 1; height: 6px; border-radius: 3px; background: var(--border); transition: all 0.3s; }
.kole-progress-node.done { background: var(--accent); }

.kole-stage-exp { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; }
.kole-stage-exp-label { font-family: var(--serif); font-size: 22px; font-style: italic; margin-bottom: 6px; }
.kole-stage-exp-desc { font-size: 13px; color: var(--text-dim); line-height: 1.6; }

.kole-fields { display: flex; flex-direction: column; gap: 18px; margin-bottom: 24px; }
.kole-field-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 4px; font-weight: 600; }
.kole-field-hint { font-size: 12px; color: var(--text-faint); font-style: italic; margin-bottom: 8px; line-height: 1.5; }
.kole-raw-display { background: var(--surface-2); border-left: 3px solid var(--text-faint); padding: 12px 14px; border-radius: 6px; font-style: italic; color: var(--text-dim); font-size: 14px; line-height: 1.5; }
.kole-field.locked .kole-field-label { color: var(--text-faint); }

.kole-input, .kole-textarea { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.5; box-sizing: border-box; }
.kole-textarea { resize: vertical; }
.kole-input:focus, .kole-textarea:focus { outline: none; border-color: var(--accent); }
.kole-input::placeholder, .kole-textarea::placeholder { color: var(--text-faint); font-style: italic; }

.kole-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.kole-chip { background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); padding: 6px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; transition: all 0.15s; font-family: var(--sans); }
.kole-chip:hover { border-color: var(--text-dim); color: var(--text); }
.kole-chip.active { background: var(--accent); color: #111; border-color: var(--accent); font-weight: 600; }

.kole-connections { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
.kole-connection-list { display: flex; flex-direction: column; gap: 6px; margin: 10px 0; }
.kole-no-connections { font-size: 12px; color: var(--text-faint); font-style: italic; padding: 8px 2px; }
.kole-connection-item { display: flex; align-items: stretch; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
.kole-connection-body { flex: 1; background: transparent; border: none; display: flex; align-items: center; gap: 10px; padding: 10px 12px; cursor: pointer; color: var(--text); font-family: var(--sans); text-align: left; }
.kole-connection-body:hover { background: var(--surface-2); }
.kole-connection-badge { font-family: var(--mono); font-size: 9px; padding: 3px 7px; border-radius: 4px; font-weight: 700; letter-spacing: 0.05em; color: #111; flex-shrink: 0; }
.kole-connection-text { font-size: 13px; flex: 1; line-height: 1.4; }
.kole-btn-connect { width: 100%; justify-content: center; }

.kole-advance { display: flex; flex-direction: column; gap: 10px; padding-top: 20px; }
.kole-btn-advance { font-size: 15px; padding: 16px 20px; }
.kole-final { text-align: center; padding: 20px; background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 10px; font-family: var(--serif); font-size: 20px; font-style: italic; color: #4ade80; }

.kole-setlist-items { display: flex; flex-direction: column; gap: 10px; }
.kole-set-item { display: flex; align-items: stretch; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
.kole-set-number { background: var(--accent); color: #111; width: 48px; display: grid; place-items: center; font-family: var(--serif); font-size: 28px; font-style: italic; }
.kole-set-content { flex: 1; padding: 14px 16px; background: transparent; border: none; text-align: left; cursor: pointer; color: var(--text); font-family: var(--sans); }
.kole-set-topic { font-size: 14px; font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
.kole-set-attitude { font-size: 10px; background: var(--bg); color: var(--accent); padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid rgba(249, 115, 22, 0.3); }
.kole-set-preview { font-size: 13px; color: var(--text-dim); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.kole-prompt-card { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 20px; margin-bottom: 20px; }
.kole-prompt-type { font-family: var(--mono); font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px; }
.kole-prompt-text { font-family: var(--serif); font-size: 22px; font-style: italic; line-height: 1.4; margin-bottom: 16px; }
.kole-prompt-shuffle { background: transparent; border: none; color: var(--text-dim); font-size: 12px; cursor: pointer; padding: 0; font-family: var(--sans); }
.kole-prompt-shuffle:hover { color: var(--accent); }

.kole-timer { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; flex-wrap: wrap; }
.kole-timer-display { font-family: var(--mono); font-size: 24px; color: var(--accent); font-weight: 500; }

.kole-daily-input-wrap { position: relative; margin-bottom: 14px; }
.kole-daily-input { width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; padding-right: 48px; color: var(--text); font-family: var(--sans); font-size: 15px; line-height: 1.6; resize: vertical; min-height: 260px; box-sizing: border-box; }
.kole-daily-input:focus { outline: none; border-color: var(--accent); }
.kole-daily-input::placeholder { color: var(--text-faint); font-style: italic; }
.kole-mic-inline { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; border-radius: 50%; background: var(--surface-2); border: 1px solid var(--border); color: var(--text-dim); cursor: pointer; display: grid; place-items: center; transition: all 0.15s; }
.kole-mic-inline:hover { color: var(--accent); border-color: var(--accent); }
.kole-mic-inline.listening { background: var(--accent); color: #111; border-color: var(--accent); }

.kole-daily-done { text-align: center; padding: 40px 20px; color: #4ade80; }
.kole-done-title { font-family: var(--serif); font-size: 28px; font-style: italic; margin: 16px 0 4px; color: var(--text); }
.kole-done-sub { color: var(--text-dim); margin-bottom: 20px; }

.kole-log { margin-top: 32px; }
.kole-log-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 12px; }
.kole-log-entry { padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 8px; }
.kole-log-date { font-family: var(--mono); font-size: 11px; color: var(--text-faint); }
.kole-log-type { font-family: var(--serif); font-style: italic; font-size: 16px; color: var(--accent); margin: 4px 0 6px; }
.kole-log-preview { font-size: 13px; color: var(--text-dim); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

.kole-modal-backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); display: grid; place-items: center; z-index: 1000; padding: 20px; }
.kole-modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 24px; max-width: 420px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; }
.kole-modal-title { font-family: var(--serif); font-size: 24px; font-style: italic; margin-bottom: 8px; }
.kole-modal-sub { font-size: 14px; color: var(--text-dim); margin-bottom: 20px; line-height: 1.5; }
.kole-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.kole-linker-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; max-height: 50vh; padding: 2px; }
.kole-linker-item { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer; color: var(--text); font-family: var(--sans); transition: all 0.15s; }
.kole-linker-item:hover { border-color: var(--text-dim); }
.kole-linker-item.linked { border-color: #4ade80; background: rgba(74, 222, 128, 0.08); }
.kole-linker-text { flex: 1; font-size: 13px; line-height: 1.4; }

.kole-checkin-modal { max-width: 380px; padding: 28px 24px; }
.kole-checkin-flame { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 50%; background: rgba(249, 115, 22, 0.15); border: 1px solid rgba(249, 115, 22, 0.4); color: var(--accent); margin: 0 auto 16px; }
.kole-checkin-actions { display: flex; gap: 10px; margin: 20px 0 12px; }
.kole-checkin-btn { flex: 1; padding: 16px 12px; border-radius: 12px; font-family: var(--sans); font-size: 14px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.15s; border: 1px solid; }
.kole-checkin-btn.no { background: var(--bg); border-color: var(--border); color: var(--text-dim); }
.kole-checkin-btn.no:hover { border-color: var(--text-dim); color: var(--text); }
.kole-checkin-btn.yes { background: var(--accent); border-color: var(--accent); color: #111; }
.kole-checkin-btn.yes:hover { background: #ffa500; transform: translateY(-1px); }
.kole-checkin-skip { background: transparent; border: none; color: var(--text-faint); font-size: 12px; cursor: pointer; padding: 8px; display: block; margin: 0 auto; font-family: var(--sans); }
.kole-checkin-skip:hover { color: var(--text-dim); }

.kole-celebration { position: fixed; inset: 0; background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(8px); display: grid; place-items: center; z-index: 2000; cursor: pointer; animation: celebFadeIn 0.3s ease-out; }
@keyframes celebFadeIn { from { opacity: 0; } to { opacity: 1; } }
.kole-celebration-inner { text-align: center; padding: 40px 24px; position: relative; max-width: 340px; }
.kole-celebration-emoji { font-size: 80px; animation: celebBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); margin-bottom: 8px; }
@keyframes celebBounce { 0% { transform: scale(0) rotate(-180deg); } 60% { transform: scale(1.2) rotate(10deg); } 100% { transform: scale(1) rotate(0); } }
.kole-celebration-title { font-family: var(--serif); font-style: italic; font-size: 44px; color: var(--accent); margin-bottom: 8px; animation: celebSlideUp 0.5s 0.2s ease-out both; }
.kole-celebration-sub { font-size: 15px; color: var(--text); margin-bottom: 24px; line-height: 1.5; animation: celebSlideUp 0.5s 0.35s ease-out both; }
@keyframes celebSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.kole-celebration-confetti { position: absolute; inset: -40px; pointer-events: none; overflow: hidden; }
.kole-confetti-piece { position: absolute; top: -20px; width: 10px; height: 14px; border-radius: 2px; animation: confettiFall linear forwards; transform-origin: center; }
@keyframes confettiFall {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(500px) rotate(720deg); opacity: 0.2; }
}

/* Sync indicator */
.kole-sync-indicator { position: fixed; top: 12px; right: 12px; background: var(--surface); border: 1px solid var(--border); color: var(--text-dim); font-family: var(--mono); font-size: 10px; padding: 5px 9px; border-radius: 999px; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; z-index: 50; text-transform: uppercase; letter-spacing: 0.05em; transition: all 0.15s; }
.kole-sync-indicator:hover { border-color: var(--text-dim); color: var(--text); }
.kole-sync-indicator.offline { color: var(--text-faint); }
.kole-sync-indicator.syncing { color: var(--accent); border-color: rgba(249, 115, 22, 0.3); }
.kole-sync-indicator.synced { color: #4ade80; border-color: rgba(74, 222, 128, 0.3); }
.kole-sync-indicator.unsynced { color: #fbbf24; border-color: rgba(251, 191, 36, 0.3); }
.kole-sync-indicator.error { color: #f87171; border-color: rgba(248, 113, 113, 0.3); }

@keyframes koleSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.kole-spin { animation: koleSpin 1s linear infinite; }

/* Settings modal */
.kole-settings-modal { max-width: 440px; }
.kole-settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.kole-settings-section { padding: 16px 0; border-top: 1px solid var(--border); }
.kole-settings-section:first-of-type { border-top: none; padding-top: 0; }
.kole-settings-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-dim); margin-bottom: 10px; font-weight: 600; }
.kole-settings-desc { font-size: 13px; color: var(--text-dim); line-height: 1.55; margin-bottom: 14px; }
.kole-settings-desc code { background: var(--bg); padding: 2px 6px; border-radius: 4px; font-family: var(--mono); font-size: 11px; color: var(--accent); }
.kole-settings-status { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; }
.kole-settings-status-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 13px; }
.kole-settings-status-row + .kole-settings-status-row { border-top: 1px solid var(--border); }
.kole-settings-status-label { color: var(--text-dim); font-size: 12px; }
.kole-settings-status-value { color: var(--text); font-family: var(--mono); font-size: 12px; }
.kole-settings-status-value.syncing { color: var(--accent); }
.kole-settings-status-value.synced { color: #4ade80; }
.kole-settings-status-value.unsynced { color: #fbbf24; }
.kole-settings-status-value.error { color: #f87171; }
.kole-settings-confirm { background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 10px; padding: 12px; margin-top: 10px; }

.kole-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 500px; background: rgba(10, 10, 10, 0.95); backdrop-filter: blur(12px); border-top: 1px solid var(--border); display: grid; grid-template-columns: repeat(5, 1fr); padding: 10px 0 calc(10px + env(safe-area-inset-bottom)); z-index: 100; }
.kole-nav button { background: transparent; border: none; color: var(--text-faint); font-family: var(--sans); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; transition: color 0.15s; }
.kole-nav button.active { color: var(--accent); }
.kole-nav button:hover { color: var(--text); }

@media (max-width: 380px) {
  .kole-view { padding: 20px 16px 40px; }
  .kole-title { font-size: 36px; }
}
`;
// ===== Bootstrap =====
const rootEl = document.getElementById("root");
rootEl.innerHTML = "";
const root = ReactDOM.createRoot(rootEl);
root.render(React.createElement(App, null));

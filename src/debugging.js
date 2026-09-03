import { getVar } from "./gameInterface.js";

let debugContext = null;
const recentErrors = new Map();
let reportWindowStarted = 0;
let reportsInWindow = 0;
const DUPLICATE_COOLDOWN = 30_000;
const MAX_REPORTS_PER_MINUTE = 5;

export function reportError(e, message) {
    function tryGetVar(name) {
        try { return getVar(name) }
        catch (error) { return error.toString(); }
    }
    message = e.filename + " " + e.lineno + " " + e.colno + " " + e.message + "\n" + message;
    const now = Date.now();
    const fingerprint = e.filename + ":" + e.lineno + ":" + e.colno + ":" + e.message;
    if (now - (recentErrors.get(fingerprint) || 0) < DUPLICATE_COOLDOWN) return false;
    recentErrors.set(fingerprint, now);
    if (now - reportWindowStarted >= 60_000) {
        reportWindowStarted = now;
        reportsInWindow = 0;
    }
    if (reportsInWindow >= MAX_REPORTS_PER_MINUTE) return false;
    reportsInWindow++;
    fetch("https://fx.peshomir.workers.dev/stats/errors", {
        body: JSON.stringify({
            message,
            context: {
                debug: debugContext,
                gameState: tryGetVar("gameState"),
                singleplayer: tryGetVar("gIsSingleplayer"),
                swState: navigator.serviceWorker?.controller?.state,
                location: window.location.toString(),
                userAgent: navigator.userAgent,
                dictionary: JSON.stringify(dictionary),
                buildTimestamp,
                scripts: Array.from(document.scripts).map(s => s.src)
            }
        }),
        method: "POST",
        keepalive: true
    }).catch(error => console.warn("Failed to report error:", error));
    return true;
}

export function debugWithContext(callback, context) {
    try {
        return callback();
    } catch (error) {
        debugContext = context;
        setTimeout(() => {
            if (debugContext !== null) debugContext = null;
        });
        throw error;
    }
}

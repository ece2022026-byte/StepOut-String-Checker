/*
 * Core state, constants, shared helpers, and theme utilities
 */

let charts = {};
let latestAlignmentRows = [];
let latestMismatchRows = [];
let latestEvaluationData = null;
let hasEvaluationRun = false;
let activeView = "home";
let mismatchRenderToken = 0;
let auditRenderToken = 0;
let keyActionErrorStore = {};
let attributeNoteBreakdown = {};
let attributeTeamBreakdown = {};
let attributeTeamNoteBreakdown = {};
let attributeStringLibrary = {};
let selectedAttributeExplorerCode = "";
let traineeDirectory = [];
let selectedTraineeId = "";
let latestProgressReport = null;
const HAS_ANIME = typeof window !== "undefined" && typeof window.anime === "function";
const PREFERS_REDUCED_MOTION =
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const MOTION_ENABLED = HAS_ANIME && !PREFERS_REDUCED_MOTION;
const ATTRIBUTE_FULL_NAMES = {
    SP: "Short Pass",
    LP: "Long Pass",
    TB: "Through Ball",
    C: "Cross",
    LS: "Long Shot",
    CS: "Close Shot",
    H: "Header",
    PC: "Ball Carry",
    DC: "Ball Control",
    DR: "Dribble",
    ST: "Standing Tackle",
    SL: "Sliding Tackle",
    IN: "Interception",
    CL: "Clearance",
    PR: "Press",
    GD: "Ground Duel",
    AD: "Aerial Duel",
    GS: "Goalkeeper Save",
    GH: "Goalkeeper Handling",
    GT: "Goalkeeper Throw",
    CN: "Corner",
    OG: "Own Goal",
    OFF: "Offside",
    F: "Foul",
    YC: "Yellow Card",
    RC: "Red Card",
    PK: "Penalty Kick",
    FK: "Free Kick",
    HB: "Hand Ball",
    GK: "Goal Kick",
    THW: "Throw In",
    XSP: "Received Short Pass",
    XLP: "Received Long Pass",
    XTB: "Received Through Ball",
    XC: "Received Cross",
    XDR: "Received Dribble",
    XIN: "Received Interception",
    XST: "Received Standing Tackle",
    XSL: "Received Sliding Tackle",
    XAD: "Received Aerial Duel",
    XGD: "Received Ground Duel",
    XPR: "Received Press",
    XGT: "Received Goalkeeper Throw",
    XTHW: "Received Throw In"
};
let attributeDisplayNames = { ...ATTRIBUTE_FULL_NAMES };
const STORAGE_KEYS = {
    gold: "stepout_gold_text",
    trainee: "stepout_trainee_text",
    analystName: "stepout_analyst_name",
    traineeId: "stepout_trainee_id",
    localTrainees: "stepout_local_trainees",
    theme: "stepout_theme"
};
const SPECIAL_PRESENCE_ACTIONS = new Set(["FK", "OG", "CN", "GK", "F", "YC", "RC", "OFF", "HB", "PK"]);
const SPECIAL_NOTE_KEY = "__PRESENCE__";
const EXPLORER_TEAM_ORDER = ["A", "B", "OTHER"];
const MAX_ANIMATED_ELEMENTS = 18;
const ROW_RENDER_CHUNK_SIZE = 60;
const RESULTS_PAGE_SIZE = 50;
let mismatchPage = 1;
let auditPage = 1;
let lastMismatchQuery = "";
let lastAuditQuery = "";

function motionRun(config) {
    if (!MOTION_ENABLED) return;
    if (!config || !config.targets) return;
    window.anime.remove(config.targets);
    window.anime(config);
}

function formatAnimatedNumber(value, decimals = 0) {
    const safe = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (decimals > 0) {
        return safe.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    }
    return Math.round(safe).toLocaleString();
}

function animateCountUp(node, endValue, suffix = "", decimals = 0, duration = 920) {
    if (!node) return;
    const safeEnd = Number.isFinite(Number(endValue)) ? Number(endValue) : 0;

    if (!MOTION_ENABLED) {
        node.textContent = `${formatAnimatedNumber(safeEnd, decimals)}${suffix}`;
        return;
    }

    const ticker = { value: 0 };
    motionRun({
        targets: ticker,
        value: safeEnd,
        duration,
        easing: "easeOutExpo",
        update: () => {
            node.textContent = `${formatAnimatedNumber(ticker.value, decimals)}${suffix}`;
        }
    });
}

function animateTapFeedback(target, scaleTo = 0.975) {
    if (!MOTION_ENABLED || !target) return;
    motionRun({
        targets: target,
        scale: [1, scaleTo, 1],
        duration: 260,
        easing: "easeOutQuad"
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSearchTerms(query) {
    return Array.from(new Set(
        String(query ?? '')
            .trim()
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean)
    ));
}

function highlightText(value, terms) {
    const text = String(value ?? '');
    if (!terms.length || !text) return escapeHtml(text);

    const pattern = new RegExp(terms.map(escapeRegExp).sort((a, b) => b.length - a.length).join('|'), 'gi');
    let result = '';
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        result += escapeHtml(text.slice(lastIndex, start));
        result += `<mark class="search-highlight">${escapeHtml(match[0])}</mark>`;
        lastIndex = end;
    }

    result += escapeHtml(text.slice(lastIndex));
    return result;
}

function debounce(fn, delay = 160) {
    let timeoutId = null;
    return (...args) => {
        window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => fn(...args), delay);
    };
}

function rowMatchesQuery(parts, terms) {
    if (!terms.length) return true;
    const haystack = parts
        .map((part) => String(part ?? ''))
        .join(' ')
        .toLowerCase();
    return terms.every((term) => haystack.includes(term));
}

function sparklineSvg(values, stroke) {
    const width = 160;
    const height = 42;
    const padding = 4;
    const series = Array.isArray(values) && values.length ? values : [0, 0, 0, 0, 0, 0, 0, 0];
    const max = Math.max(...series, 1);
    const stepX = (width - padding * 2) / (series.length - 1 || 1);
    const points = series.map((v, i) => {
        const x = padding + i * stepX;
        const y = height - padding - ((v / max) * (height - padding * 2));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `
        <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
            <polyline fill="none" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
        </svg>
    `;
}

function attributeLabel(code) {
    const full = attributeDisplayNames[code] || ATTRIBUTE_FULL_NAMES[code];
    return full ? `${full} (${code})` : code;
}

function teamLabel(teamCode) {
    if (teamCode === "A") return "Team A";
    if (teamCode === "B") return "Team B";
    return "Other";
}

function formatDateTimeLabel(value) {
    if (!value) return "N/A";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

async function parseApiResponse(response, fallbackMessage) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

    if (!response.ok) {
        throw new Error(payload.error || fallbackMessage || `Request failed with status ${response.status}.`);
    }
    return payload;
}

function sanitizeFilenameSegment(value) {
    const cleaned = String(value ?? "")
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return cleaned.slice(0, 64);
}

function buildExportFilename(analystName) {
    const safeName = sanitizeFilenameSegment(analystName);
    return safeName ? `${safeName}_StepOut_Evaluation.pdf` : "StepOut_Evaluation.pdf";
}

function getStoredTheme() {
    try {
        const storedTheme = localStorage.getItem(STORAGE_KEYS.theme);
        return storedTheme === "light" ? "light" : "dark";
    } catch (err) {
        return "dark";
    }
}

function getCssVar(name, fallback = "") {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
}

function syncBrandLogo(theme) {
    const brandLogo = document.getElementById("brandLogo");
    if (!brandLogo) return;
    const darkSrc = brandLogo.getAttribute("data-dark-src") || brandLogo.getAttribute("src");
    const lightSrc = brandLogo.getAttribute("data-light-src") || darkSrc;
    brandLogo.setAttribute("src", theme === "light" ? lightSrc : darkSrc);
}

function updateThemeToggleUi(theme) {
    const themeToggle = document.getElementById("themeToggle");
    const themeToggleText = document.getElementById("themeToggleText");
    if (!themeToggle || !themeToggleText) return;

    const nextMode = theme === "light" ? "Dark Mode" : "Light Mode";
    themeToggleText.textContent = nextMode;
    themeToggle.setAttribute("aria-label", `Switch to ${nextMode.toLowerCase()}`);
    themeToggle.setAttribute("data-theme", theme);
}

function applyTheme(theme, options = {}) {
    const { persist = true, rerenderCharts = true } = options;
    const safeTheme = theme === "light" ? "light" : "dark";
    document.body.setAttribute("data-theme", safeTheme);
    document.documentElement.style.colorScheme = safeTheme;
    syncBrandLogo(safeTheme);
    updateThemeToggleUi(safeTheme);

    if (persist) {
        try {
            localStorage.setItem(STORAGE_KEYS.theme, safeTheme);
        } catch (err) {
            // Ignore storage access errors silently.
        }
    }

    if (rerenderCharts && latestEvaluationData) {
        renderCharts(latestEvaluationData);
    }
    if (rerenderCharts && latestProgressReport) {
        renderProgressReportSection();
    }
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute("data-theme") === "light" ? "light" : "dark";
    applyTheme(currentTheme === "light" ? "dark" : "light");
}

function getChartTheme() {
    const isLightTheme = document.body.getAttribute("data-theme") === "light";
    return {
        isLightTheme,
        mutedColor: getCssVar("--chart-muted", isLightTheme ? "#60748e" : "#7a96bb"),
        gridLine: getCssVar("--chart-grid", isLightTheme ? "rgba(120, 142, 172, 0.2)" : "rgba(120, 160, 210, 0.12)"),
        axisLineColor: getCssVar("--chart-axis", isLightTheme ? "#c9d8e7" : "#2a4060"),
        tooltip: {
            backgroundColor: getCssVar("--chart-tooltip-bg", isLightTheme ? "#ffffff" : "#0f1c2e"),
            borderColor: getCssVar("--chart-tooltip-border", isLightTheme ? "#cbdcec" : "#2a4060"),
            textStyle: { color: getCssVar("--chart-tooltip-text", isLightTheme ? "#17304c" : "#dceeff"), fontSize: 13 }
        },
        legend: {
            textStyle: { color: getCssVar("--chart-legend", isLightTheme ? "#556b87" : "#a8c0dc"), fontSize: 12 }
        },
        strongAxisLabel: isLightTheme ? "#35516f" : "#a8c8f0",
        valueLabel: isLightTheme ? "#7a3b52" : "#ffb3c2",
        timelineValueLabel: isLightTheme ? "#1b7aa4" : "#7dd3fc",
        miniValueLabel: isLightTheme ? "#304863" : "#dbeeff",
        pieShadow: isLightTheme ? "rgba(28, 52, 87, 0.18)" : "rgba(0, 0, 0, 0.5)",
        timelineShadow: isLightTheme ? "rgba(14, 165, 233, 0.24)" : "rgba(14,165,233,0.4)"
    };
}

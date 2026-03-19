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
    theme: "stepout_theme"
};
const SPECIAL_PRESENCE_ACTIONS = new Set(["FK", "OG", "CN", "GK", "F", "YC", "RC", "OFF", "HB", "PK"]);
const SPECIAL_NOTE_KEY = "__PRESENCE__";
const EXPLORER_TEAM_ORDER = ["A", "B", "OTHER"];
const MAX_ANIMATED_ELEMENTS = 18;
const ROW_RENDER_CHUNK_SIZE = 60;

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

function hideAttributeCountModal() {
    const modal = document.getElementById("attributeCountModal");
    if (!modal) return;

    const finalizeHide = () => {
        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        modal.style.opacity = "";
        const card = modal.querySelector(".attribute-count-modal-card");
        if (card) {
            card.style.opacity = "";
            card.style.transform = "";
        }
    };

    if (!MOTION_ENABLED || !modal.classList.contains("show")) {
        finalizeHide();
        return;
    }

    const card = modal.querySelector(".attribute-count-modal-card");
    motionRun({
        targets: modal,
        opacity: [1, 0],
        duration: 170,
        easing: "easeInOutQuad"
    });
    motionRun({
        targets: card,
        opacity: [1, 0],
        translateY: [0, 12],
        scale: [1, 0.96],
        duration: 190,
        easing: "easeInOutQuad",
        complete: finalizeHide
    });
}

function showAttributeCountModal(attributeCode, goldCount, traineeCount) {
    const modal = document.getElementById("attributeCountModal");
    const title = document.getElementById("attributeCountModalTitle");
    const goldNode = document.getElementById("attributeCountGold");
    const traineeNode = document.getElementById("attributeCountTrainee");
    const deltaNode = document.getElementById("attributeCountDelta");
    const teamsNode = document.getElementById("attributeCountTeams");
    const notesNode = document.getElementById("attributeCountNotes");
    if (!modal || !title || !goldNode || !traineeNode || !deltaNode || !teamsNode || !notesNode) return;

    const breakdown = (attributeNoteBreakdown && typeof attributeNoteBreakdown === "object")
        ? (attributeNoteBreakdown[attributeCode] || {})
        : {};
    const teamBreakdown = (attributeTeamBreakdown && typeof attributeTeamBreakdown === "object")
        ? (attributeTeamBreakdown[attributeCode] || {})
        : {};
    const teamNoteBreakdown = (attributeTeamNoteBreakdown && typeof attributeTeamNoteBreakdown === "object")
        ? (attributeTeamNoteBreakdown[attributeCode] || {})
        : {};
    const goldNotes = breakdown.gold || {};
    const traineeNotes = breakdown.trainee || {};
    const goldTeams = teamBreakdown.gold || {};
    const traineeTeams = teamBreakdown.trainee || {};
    const goldTeamNotes = teamNoteBreakdown.gold || {};
    const traineeTeamNotes = teamNoteBreakdown.trainee || {};
    const noteKeys = Array.from(new Set([...Object.keys(goldNotes), ...Object.keys(traineeNotes)]))
        .sort((a, b) => {
            const aNum = /^\d+$/.test(String(a));
            const bNum = /^\d+$/.test(String(b));
            if (aNum && bNum) return Number(a) - Number(b);
            return String(a).localeCompare(String(b));
        });
    const isPresenceAction = SPECIAL_PRESENCE_ACTIONS.has(attributeCode);

    const sumCounts = (obj) => Object.values(obj).reduce((sum, n) => sum + Number(n || 0), 0);
    const gold = noteKeys.length ? sumCounts(goldNotes) : Number(goldCount || 0);
    const trainee = noteKeys.length ? sumCounts(traineeNotes) : Number(traineeCount || 0);
    const diff = trainee - gold;

    title.textContent = attributeLabel(attributeCode);
    goldNode.textContent = gold.toLocaleString();
    traineeNode.textContent = trainee.toLocaleString();

    deltaNode.classList.remove("is-positive", "is-negative", "is-neutral");
    if (diff > 0) {
        deltaNode.classList.add("is-positive");
        deltaNode.textContent = `Trainee is +${diff.toLocaleString()} vs Gold`;
    } else if (diff < 0) {
        deltaNode.classList.add("is-negative");
        deltaNode.textContent = `Trainee is ${diff.toLocaleString()} vs Gold`;
    } else {
        deltaNode.classList.add("is-neutral");
        deltaNode.textContent = "Gold and Trainee counts are equal";
    }

    const preferredTeams = ["A", "B"];
    const optionalTeams = Array.from(new Set([...Object.keys(goldTeams), ...Object.keys(traineeTeams)]))
        .filter((team) => !preferredTeams.includes(team) && ((Number(goldTeams[team] || 0) > 0) || (Number(traineeTeams[team] || 0) > 0)));
    const teamKeys = [...preferredTeams, ...optionalTeams];
    teamsNode.innerHTML = teamKeys.map((team) => {
        const goldTeamCount = Number(goldTeams[team] || 0);
        const traineeTeamCount = Number(traineeTeams[team] || 0);
        const goldShare = gold > 0 ? (goldTeamCount / gold) * 100 : 0;
        const traineeShare = trainee > 0 ? (traineeTeamCount / trainee) * 100 : 0;
        const delta = traineeTeamCount - goldTeamCount;
        const deltaLabel = delta === 0
            ? "Aligned with gold"
            : (delta > 0
                ? `Trainee +${delta.toLocaleString()}`
                : `Trainee ${delta.toLocaleString()}`);

        return `
            <article class="attribute-team-card team-${escapeHtml(team.toLowerCase())}">
                <div class="attribute-team-top">
                    <div>
                        <div class="attribute-team-name">${escapeHtml(teamLabel(team))}</div>
                        <div class="attribute-team-sub">${escapeHtml(deltaLabel)}</div>
                    </div>
                    <span class="attribute-team-tag">${(goldTeamCount + traineeTeamCount).toLocaleString()} tagged</span>
                </div>
                <div class="attribute-team-stats">
                    <div class="attribute-team-stat is-gold">
                        <span>Gold</span>
                        <strong>${goldTeamCount.toLocaleString()}</strong>
                        <small>${goldShare.toFixed(1)}%</small>
                    </div>
                    <div class="attribute-team-stat is-trainee">
                        <span>Trainee</span>
                        <strong>${traineeTeamCount.toLocaleString()}</strong>
                        <small>${traineeShare.toFixed(1)}%</small>
                    </div>
                </div>
                <div class="attribute-team-bars">
                    <div class="attribute-team-bar-row">
                        <span>Gold Share</span>
                        <div class="attribute-team-bar"><i class="fill is-gold" style="width:${goldShare.toFixed(1)}%"></i></div>
                    </div>
                    <div class="attribute-team-bar-row">
                        <span>Trainee Share</span>
                        <div class="attribute-team-bar"><i class="fill is-trainee" style="width:${traineeShare.toFixed(1)}%"></i></div>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    if (!noteKeys.length) {
        notesNode.innerHTML = `<div class="attribute-note-empty">No action-note breakdown available.</div>`;
    } else {
        const rowsHtml = noteKeys.map((note) => {
            const g = Number(goldNotes[note] || 0);
            const t = Number(traineeNotes[note] || 0);
            const displayKey = (note === SPECIAL_NOTE_KEY) ? attributeCode : `${attributeCode}-${note}`;
            const goldTeamA = Number(((goldTeamNotes.A || {})[note]) || 0);
            const goldTeamB = Number(((goldTeamNotes.B || {})[note]) || 0);
            const goldOther = Number(((goldTeamNotes.OTHER || {})[note]) || 0);
            const traineeTeamA = Number(((traineeTeamNotes.A || {})[note]) || 0);
            const traineeTeamB = Number(((traineeTeamNotes.B || {})[note]) || 0);
            const traineeOther = Number(((traineeTeamNotes.OTHER || {})[note]) || 0);
            const goldSplitBits = [
                `<span class="attribute-note-pill">A ${goldTeamA.toLocaleString()}</span>`,
                `<span class="attribute-note-pill">B ${goldTeamB.toLocaleString()}</span>`,
                goldOther > 0 ? `<span class="attribute-note-pill is-other">Other ${goldOther.toLocaleString()}</span>` : ''
            ].join('');
            const traineeSplitBits = [
                `<span class="attribute-note-pill">A ${traineeTeamA.toLocaleString()}</span>`,
                `<span class="attribute-note-pill">B ${traineeTeamB.toLocaleString()}</span>`,
                traineeOther > 0 ? `<span class="attribute-note-pill is-other">Other ${traineeOther.toLocaleString()}</span>` : ''
            ].join('');
            return `
                <div class="attribute-note-matrix-row">
                    <span class="attribute-note-key">${escapeHtml(displayKey)}</span>
                    <span class="attribute-note-val is-gold">${g.toLocaleString()}</span>
                    <span class="attribute-note-split">${goldSplitBits}</span>
                    <span class="attribute-note-val is-trainee">${t.toLocaleString()}</span>
                    <span class="attribute-note-split">${traineeSplitBits}</span>
                </div>
            `;
        }).join('');

        notesNode.innerHTML = `
            <div class="attribute-note-matrix-row attribute-note-matrix-row-head">
                <span>Action-Note</span>
                <span>Gold Total</span>
                <span>Gold Team Split</span>
                <span>Trainee Total</span>
                <span>Trainee Team Split</span>
            </div>
            ${rowsHtml}
        `;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    if (!MOTION_ENABLED) return;

    const card = modal.querySelector(".attribute-count-modal-card");
    motionRun({
        targets: modal,
        opacity: [0, 1],
        duration: 180,
        easing: "easeOutQuad"
    });
    motionRun({
        targets: card,
        opacity: [0, 1],
        translateY: [16, 0],
        scale: [0.95, 1],
        duration: 250,
        easing: "easeOutCubic"
    });
    animateStaggered("#attributeCountTeams .attribute-team-card", 20, 10, 420, 0.99);
    animateStaggered("#attributeCountNotes .attribute-note-matrix-row", 50, 8, 420, 0.99);
}

function restoreSavedInputs() {
    const goldBox = document.getElementById("gold_text");
    const traineeBox = document.getElementById("trainee_text");
    const analystNameInput = document.getElementById("analystNameInput");
    if (!goldBox || !traineeBox) return;

    try {
        const savedGold = localStorage.getItem(STORAGE_KEYS.gold);
        const savedTrainee = localStorage.getItem(STORAGE_KEYS.trainee);
        const savedAnalystName = localStorage.getItem(STORAGE_KEYS.analystName);

        if (savedGold !== null) goldBox.value = savedGold;
        if (savedTrainee !== null) traineeBox.value = savedTrainee;
        if (analystNameInput && savedAnalystName !== null) analystNameInput.value = savedAnalystName;
    } catch (err) {
        // Ignore storage access errors silently.
    }
}

function attachInputPersistence() {
    const goldBox = document.getElementById("gold_text");
    const traineeBox = document.getElementById("trainee_text");
    if (!goldBox || !traineeBox) return;

    const persist = () => {
        try {
            localStorage.setItem(STORAGE_KEYS.gold, goldBox.value);
            localStorage.setItem(STORAGE_KEYS.trainee, traineeBox.value);
        } catch (err) {
            // Ignore storage access errors silently.
        }
    };

    goldBox.addEventListener("input", persist);
    traineeBox.addEventListener("input", persist);
}

function announceAnimationStatus() {
    if (MOTION_ENABLED) {
        console.info("Anime.js motion system is enabled.");
        return;
    }
    if (HAS_ANIME && PREFERS_REDUCED_MOTION) {
        console.info("Anime.js loaded, but motion is reduced by system accessibility preference.");
        return;
    }
    console.warn("Anime.js not loaded. Check internet/CDN access if no motion is visible.");
}

applyTheme(getStoredTheme(), { persist: false, rerenderCharts: false });
restoreSavedInputs();
attachInputPersistence();
announceAnimationStatus();

const attributeCountModal = document.getElementById("attributeCountModal");
const attributeCountModalClose = document.getElementById("attributeCountModalClose");
const exportNameModal = document.getElementById("exportNameModal");
const exportNameModalClose = document.getElementById("exportNameModalClose");
const exportNameCancel = document.getElementById("exportNameCancel");
const exportNameConfirm = document.getElementById("exportNameConfirm");
const analystNameInput = document.getElementById("analystNameInput");
const exportFilePreview = document.getElementById("exportFilePreview");
const themeToggle = document.getElementById("themeToggle");
if (attributeCountModalClose) {
    attributeCountModalClose.addEventListener("click", hideAttributeCountModal);
}
if (attributeCountModal) {
    attributeCountModal.addEventListener("click", (event) => {
        if (event.target === attributeCountModal) {
            hideAttributeCountModal();
        }
    });
}

function updateExportFilenamePreview() {
    if (!exportFilePreview || !analystNameInput) return;
    exportFilePreview.textContent = buildExportFilename(analystNameInput.value);
}

function hideExportNameModal() {
    if (!exportNameModal) return;

    const finalizeHide = () => {
        exportNameModal.classList.remove("show");
        exportNameModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        exportNameModal.style.opacity = "";
        const card = exportNameModal.querySelector(".export-name-modal-card");
        if (card) {
            card.style.opacity = "";
            card.style.transform = "";
        }
    };

    if (!MOTION_ENABLED || !exportNameModal.classList.contains("show")) {
        finalizeHide();
        return;
    }

    const card = exportNameModal.querySelector(".export-name-modal-card");
    motionRun({
        targets: exportNameModal,
        opacity: [1, 0],
        duration: 170,
        easing: "easeInOutQuad"
    });
    motionRun({
        targets: card,
        opacity: [1, 0],
        translateY: [0, 12],
        scale: [1, 0.96],
        duration: 190,
        easing: "easeInOutQuad",
        complete: finalizeHide
    });
}

function showExportNameModal() {
    if (!exportNameModal) return;
    updateExportFilenamePreview();
    exportNameModal.classList.add("show");
    exportNameModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const focusInput = () => {
        if (analystNameInput) {
            analystNameInput.focus();
            analystNameInput.select();
        }
    };

    if (!MOTION_ENABLED) {
        focusInput();
        return;
    }

    const card = exportNameModal.querySelector(".export-name-modal-card");
    motionRun({
        targets: exportNameModal,
        opacity: [0, 1],
        duration: 180,
        easing: "easeOutQuad"
    });
    motionRun({
        targets: card,
        opacity: [0, 1],
        translateY: [16, 0],
        scale: [0.95, 1],
        duration: 250,
        easing: "easeOutCubic",
        complete: focusInput
    });
}

if (exportNameModalClose) {
    exportNameModalClose.addEventListener("click", hideExportNameModal);
}
if (exportNameCancel) {
    exportNameCancel.addEventListener("click", hideExportNameModal);
}
if (exportNameModal) {
    exportNameModal.addEventListener("click", (event) => {
        if (event.target === exportNameModal) {
            hideExportNameModal();
        }
    });
}
if (analystNameInput) {
    analystNameInput.addEventListener("input", () => {
        updateExportFilenamePreview();
        try {
            localStorage.setItem(STORAGE_KEYS.analystName, analystNameInput.value);
        } catch (err) {
            // Ignore storage access errors silently.
        }
    });
    analystNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (exportNameConfirm) {
                exportNameConfirm.click();
            }
        }
    });
}
updateExportFilenamePreview();
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        animateTapFeedback(themeToggle, 0.985);
        toggleTheme();
    });
}
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideAttributeCountModal();
        hideExportNameModal();
    }
});

function switchSidebarView(viewName) {
    const homeView = document.getElementById("homeView");
    const checkerView = document.getElementById("stringCheckerView");
    const auditView = document.getElementById("stringAuditView");
    const explorerView = document.getElementById("attributeExplorerView");
    if (!homeView || !checkerView || !auditView || !explorerView) return;

    if (viewName !== "string-checker") mismatchRenderToken += 1;
    if (viewName !== "string-audit") auditRenderToken += 1;

    const navLinks = document.querySelectorAll(".sidebar-link[data-view]");
    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.view === viewName);
    });

    if (viewName === "string-checker") {
        homeView.style.display = "none";
        checkerView.style.display = "block";
        auditView.style.display = "none";
        explorerView.style.display = "none";
    } else if (viewName === "string-audit") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "block";
        explorerView.style.display = "none";
    } else if (viewName === "attribute-explorer") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "none";
        explorerView.style.display = "block";
    } else {
        homeView.style.display = "block";
        checkerView.style.display = "none";
        auditView.style.display = "none";
        explorerView.style.display = "none";
    }

    activeView = viewName;
    if (viewName === "string-checker") {
        renderMismatchSection();
    } else if (viewName === "string-audit") {
        renderAuditSection();
    } else if (viewName === "attribute-explorer") {
        renderAttributeExplorerSection();
    }

    animateSidebarView(viewName);
}

function animateStaggered(selector, baseDelay = 0, distance = 14, duration = 640, scaleFrom = 0.97) {
    if (!MOTION_ENABLED) return;
    const elements = Array.from(document.querySelectorAll(selector)).slice(0, MAX_ANIMATED_ELEMENTS);
    if (!elements.length) return;

    motionRun({
        targets: elements,
        opacity: [0, 1],
        translateY: [distance, 0],
        scale: [scaleFrom, 1],
        easing: "easeOutCubic",
        duration,
        delay: (_, i) => baseDelay + (i * 38)
    });
}

function animateDashboardBoot() {
    animateStaggered(".left-sidebar .brand-area, .left-sidebar .sidebar-section-title, .left-sidebar .sidebar-link[data-view], .left-sidebar .sidebar-card", 0, 16, 620, 0.98);
    animateStaggered(".topbar, .form-panel", 90, 18, 600, 0.97);
    animateStaggered("#homeView .chart-card, #summary-section .row > *, #insights-section .insight-card", 180, 14, 560, 0.98);
}

function animateSidebarView(viewName) {
    if (viewName === "string-checker") {
        animateStaggered("#stringCheckerView .search-tools, #mismatch-section .comparison-header, #mismatch-section .comparison-card, #mismatch-section .comparison-empty", 0, 20, 560, 0.97);
        return;
    }
    if (viewName === "string-audit") {
        animateStaggered("#stringAuditView .search-tools, #audit-section .comparison-header, #audit-section .audit-card, #audit-section .comparison-empty", 0, 18, 560, 0.97);
        return;
    }
    if (viewName === "attribute-explorer") {
        animateStaggered("#attributeExplorerView .attribute-explorer-list-panel, #attributeExplorerView .attribute-explorer-card, #attributeExplorerView .attribute-explorer-detail-panel, #attributeExplorerView .attribute-explorer-team-board, #attributeExplorerView .attribute-explorer-string-card", 0, 18, 560, 0.98);
        return;
    }
    animateStaggered("#summary-section .row > *, #insights-section .insight-card, #insights-section .insight-chip, #insights-section .key-action-card, #homeView .chart-card", 0, 16, 560, 0.98);
}

function animateEvaluationRender() {
    animateStaggered("#summary-section .row > *", 0, 24, 620, 0.97);
    animateStaggered("#insights-section .insight-card", 90, 22, 640, 0.97);
    animateStaggered("#insights-section .insight-chip, #insights-section .key-action-card", 150, 18, 620, 0.98);
    animateStaggered("#homeView .chart-card", 200, 14, 520, 0.99);
    animateStaggered("#stringCheckerView .search-tools, #mismatch-section .comparison-header, #mismatch-section .comparison-card, #mismatch-section .comparison-empty", 240, 20, 620, 0.97);
    animateStaggered("#stringAuditView .search-tools, #audit-section .comparison-header, #audit-section .audit-card, #audit-section .comparison-empty", 300, 20, 620, 0.97);
    animateStaggered("#attributeExplorerView .attribute-explorer-list-panel, #attributeExplorerView .attribute-explorer-card, #attributeExplorerView .attribute-explorer-detail-panel, #attributeExplorerView .attribute-explorer-team-board, #attributeExplorerView .attribute-explorer-string-card", 340, 18, 620, 0.98);
}

function animateChartPanels() {
    animateStaggered("#homeView .chart-card h5, #pieChart, #barChart, #timelineChart, #attributeCompareChart, #pie-breakdown", 0, 10, 500, 1);
    animateStaggered("#attributeBarsGrid .attribute-mini-card", 80, 10, 500, 0.98);
}

function animateSummaryMetrics() {
    const accuracyNode = document.querySelector("#summary-section .summary-accuracy");
    if (accuracyNode) {
        const accuracyValue = Number(accuracyNode.getAttribute("data-value") || 0);
        const hasFraction = String(accuracyNode.getAttribute("data-value") || "").includes(".");
        animateCountUp(accuracyNode, accuracyValue, "%", hasFraction ? 2 : 0, 980);
    }

    document.querySelectorAll("#summary-section .summary-number").forEach((node, idx) => {
        const value = Number(node.getAttribute("data-value") || 0);
        animateCountUp(node, value, "", 0, 780 + (idx * 90));
    });
}

function renderIssueChips(entries, terms, chipClass, fieldClass, textClass) {
    if (!entries.length) return '';

    return `
        <div class="${chipClass === 'warning-chip' ? 'comparison-warnings' : 'comparison-errors'}">
            ${entries.map(([field, values]) => {
                const expected = highlightText(values?.expected, terms);
                const predicted = highlightText(values?.predicted, terms);
                return `
                    <div class="${chipClass}">
                        <span class="${fieldClass}">${highlightText(String(field ?? '').toUpperCase(), terms)}</span>
                        <span class="${textClass}">Expected: <b>${expected}</b></span>
                        <span class="${textClass}">Got: <b>${predicted}</b></span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function buildMismatchCardHtml(item, index, terms, query, searchMatched = null) {
    const errors = Object.entries(item.errors || {});
    const warnings = Object.entries(item.warnings || {});
    const isMatch = searchMatched ?? rowMatchesQuery([
        item.gold || '',
        item.trainee || '',
        JSON.stringify(item.errors || {}),
        JSON.stringify(item.warnings || {})
    ], terms);
    const searchClass = query ? (isMatch ? " search-hit" : " search-muted") : "";

    return `
        <article class="comparison-card${searchClass} mb-3">
            <div class="comparison-card-head">
                <span class="comparison-id">Mismatch #${index + 1}</span>
                <span class="comparison-meta">${errors.length} field${errors.length === 1 ? '' : 's'} differ</span>
            </div>
            <div class="comparison-grid">
                <div class="comparison-side comparison-side-gold">
                    <div class="comparison-label">Gold Standard</div>
                    <pre class="comparison-string">${highlightText(item.gold, terms)}</pre>
                </div>
                <div class="comparison-side comparison-side-trainee">
                    <div class="comparison-label">Trainee Output</div>
                    <pre class="comparison-string">${highlightText(item.trainee, terms)}</pre>
                </div>
            </div>
            ${renderIssueChips(errors, terms, 'error-chip', 'error-field', 'error-text')}
            ${renderIssueChips(warnings, terms, 'warning-chip', 'warning-field', 'warning-text')}
        </article>
    `;
}

function buildAuditCardHtml(row, index, terms, query, searchMatched = null) {
    const status = row.status || 'matched';
    const errors = Object.entries(row.errors || {});
    const warnings = Object.entries(row.warnings || {});
    const isMatch = searchMatched ?? rowMatchesQuery([
        row.status || '',
        row.gold || '',
        row.trainee || '',
        JSON.stringify(row.errors || {}),
        JSON.stringify(row.warnings || {})
    ], terms);
    const searchClass = query ? (isMatch ? " search-hit" : " search-muted") : "";

    return `
        <article class="audit-card audit-${status}${searchClass} mb-3">
            <div class="audit-head">
                <span class="audit-index">Row #${index + 1}</span>
                <span class="audit-status">${highlightText(status.toUpperCase(), terms)}</span>
            </div>
            <div class="comparison-grid">
                <div class="comparison-side comparison-side-gold">
                    <div class="comparison-label">Gold</div>
                    <pre class="comparison-string">${highlightText(row.gold ?? '(none)', terms)}</pre>
                </div>
                <div class="comparison-side comparison-side-trainee">
                    <div class="comparison-label">Trainee</div>
                    <pre class="comparison-string">${highlightText(row.trainee ?? '(none)', terms)}</pre>
                </div>
            </div>
            ${renderIssueChips(errors, terms, 'error-chip', 'error-field', 'error-text')}
            ${renderIssueChips(warnings, terms, 'warning-chip', 'warning-field', 'warning-text')}
        </article>
    `;
}

function appendHtmlInChunks(host, items, buildHtml, renderTokenRef, token, chunkSize = ROW_RENDER_CHUNK_SIZE) {
    let cursor = 0;

    const appendChunk = () => {
        if (!host || renderTokenRef() !== token) return;
        const nextItems = items.slice(cursor, cursor + chunkSize);
        if (!nextItems.length) return;

        host.insertAdjacentHTML('beforeend', nextItems.map(buildHtml).join(''));
        cursor += chunkSize;

        if (cursor < items.length) {
            window.requestAnimationFrame(appendChunk);
        }
    };

    window.requestAnimationFrame(appendChunk);
}

function renderMismatchSection() {
    const container = document.getElementById("mismatch-section");
    const input = document.getElementById("checkerSearchInput");
    const meta = document.getElementById("checkerSearchMeta");
    if (!container || !input || !meta) return;

    const query = input.value.trim();
    const terms = getSearchTerms(query);
    const rows = Array.isArray(latestMismatchRows) ? latestMismatchRows : [];
    if (!hasEvaluationRun) {
        meta.textContent = "Run an evaluation to search mismatch rows.";
        container.innerHTML = `
            <div class="comparison-empty">
                <div class="comparison-empty-title">No mismatch data yet</div>
                <div class="comparison-empty-sub">Run an evaluation to generate the detailed string checker view.</div>
            </div>
        `;
        return;
    }
    const indexedRows = rows.map((item, index) => {
        const searchMatched = rowMatchesQuery([
            item.gold || '',
            item.trainee || '',
            JSON.stringify(item.errors || {}),
            JSON.stringify(item.warnings || {})
        ], terms);
        return { item, index, searchMatched };
    });
    const matchedCount = indexedRows.filter(({ searchMatched }) => searchMatched).length;
    const orderedRows = query
        ? [
            ...indexedRows.filter(({ searchMatched }) => searchMatched),
            ...indexedRows.filter(({ searchMatched }) => !searchMatched)
        ]
        : indexedRows;

    meta.textContent = query
        ? `${matchedCount} of ${rows.length} mismatch row(s) matched "${query}". Matched rows are shown first; others stay below.`
        : `Showing all ${rows.length} mismatch row(s).`;

    const token = ++mismatchRenderToken;
    let logHtml = `
        <div class="comparison-header mb-3">
            <h3 class="comparison-title m-0">Detailed String Comparison</h3>
            <span class="comparison-total">${query ? `${matchedCount} matched / ${rows.length}` : rows.length} mismatches</span>
        </div>
    `;

    if (!rows.length) {
        logHtml += `
            <div class="comparison-empty">
                <div class="comparison-empty-title">Perfect alignment</div>
                <div class="comparison-empty-sub">No mismatches found in this run.</div>
            </div>
        `;
    } else {
        logHtml += `<div id="mismatchRowsHost"></div>`;
    }

    container.innerHTML = logHtml;
    if (rows.length) {
        const host = document.getElementById("mismatchRowsHost");
        appendHtmlInChunks(
            host,
            orderedRows,
            ({ item, index, searchMatched }) => buildMismatchCardHtml(item, index, terms, query, searchMatched),
            () => mismatchRenderToken,
            token
        );
    }
}

function renderAuditSection() {
    const container = document.getElementById("audit-section");
    const input = document.getElementById("auditSearchInput");
    const meta = document.getElementById("auditSearchMeta");
    if (!container || !input || !meta) return;

    const query = input.value.trim();
    const terms = getSearchTerms(query);
    const rows = Array.isArray(latestAlignmentRows) ? latestAlignmentRows : [];
    if (!hasEvaluationRun) {
        meta.textContent = "Run an evaluation to search audit rows.";
        container.innerHTML = `
            <div class="comparison-empty">
                <div class="comparison-empty-title">No audit data yet</div>
                <div class="comparison-empty-sub">Run an evaluation to generate the string audit view.</div>
            </div>
        `;
        return;
    }
    const indexedRows = rows.map((row, index) => {
        const searchMatched = rowMatchesQuery([
            row.status || '',
            row.gold || '',
            row.trainee || '',
            JSON.stringify(row.errors || {}),
            JSON.stringify(row.warnings || {})
        ], terms);
        return { row, index, searchMatched };
    });
    const matchedCount = indexedRows.filter(({ searchMatched }) => searchMatched).length;
    const orderedRows = query
        ? [
            ...indexedRows.filter(({ searchMatched }) => searchMatched),
            ...indexedRows.filter(({ searchMatched }) => !searchMatched)
        ]
        : indexedRows;

    meta.textContent = query
        ? `${matchedCount} of ${rows.length} row(s) matched "${query}". Matched rows are shown first; others stay below.`
        : `Showing all ${rows.length} row(s).`;

    const token = ++auditRenderToken;
    let auditHtml = `
        <div class="comparison-header mb-3">
            <h3 class="comparison-title m-0">String Audit</h3>
            <span class="comparison-total">${query ? `${matchedCount} matched / ${rows.length}` : rows.length} aligned rows</span>
        </div>
    `;

    if (!rows.length) {
        auditHtml += `
            <div class="comparison-empty">
                <div class="comparison-empty-title">No audit data</div>
                <div class="comparison-empty-sub">Run an evaluation to generate string audit rows.</div>
            </div>
        `;
    } else {
        auditHtml += `<div id="auditRowsHost"></div>`;
    }

    container.innerHTML = auditHtml;
    if (rows.length) {
        const host = document.getElementById("auditRowsHost");
        appendHtmlInChunks(
            host,
            orderedRows,
            ({ row, index, searchMatched }) => buildAuditCardHtml(row, index, terms, query, searchMatched),
            () => auditRenderToken,
            token
        );
    }
}

function applyAuditFilter() {
    renderAuditSection();
}

function applyCheckerFilter() {
    renderMismatchSection();
}

function getAttributeExplorerEntries() {
    const library = (attributeStringLibrary && typeof attributeStringLibrary === "object")
        ? attributeStringLibrary
        : {};

    return Object.values(library)
        .map((entry) => {
            const code = String(entry.code || "");
            const label = String(entry.label || attributeLabel(code));
            const teams = entry.teams || {};
            const teamTotals = {};

            EXPLORER_TEAM_ORDER.forEach((team) => {
                const teamGroup = teams[team] || {};
                teamTotals[team] = Number((teamGroup.gold || []).length) + Number((teamGroup.trainee || []).length);
            });

            return {
                code,
                label,
                gold_total: Number(entry.gold_total || 0),
                trainee_total: Number(entry.trainee_total || 0),
                teams,
                teamTotals,
                combinedTotal: Number(entry.gold_total || 0) + Number(entry.trainee_total || 0),
            };
        })
        .filter((entry) => entry.code && entry.combinedTotal > 0)
        .sort((a, b) => {
            if (b.combinedTotal !== a.combinedTotal) return b.combinedTotal - a.combinedTotal;
            return attributeLabel(a.code).localeCompare(attributeLabel(b.code));
        });
}

function buildAttributeExplorerCard(entry, isActive) {
    const teamA = Number(entry.teamTotals.A || 0);
    const teamB = Number(entry.teamTotals.B || 0);
    const other = Number(entry.teamTotals.OTHER || 0);
    const otherHtml = other > 0
        ? `<span class="attribute-explorer-team-pill is-other">Other ${other.toLocaleString()}</span>`
        : "";

    return `
        <button
            type="button"
            class="attribute-explorer-card${isActive ? " is-active" : ""}"
            data-attribute-code="${escapeHtml(entry.code)}"
            aria-pressed="${isActive ? "true" : "false"}"
        >
            <div class="attribute-explorer-card-top">
                <span class="attribute-explorer-card-code">${escapeHtml(entry.code)}</span>
                <span class="attribute-explorer-card-total">${entry.combinedTotal.toLocaleString()}</span>
            </div>
            <div class="attribute-explorer-card-title">${escapeHtml(attributeLabel(entry.code))}</div>
            <div class="attribute-explorer-card-stats">
                <span>Gold ${entry.gold_total.toLocaleString()}</span>
                <span>Trainee ${entry.trainee_total.toLocaleString()}</span>
            </div>
            <div class="attribute-explorer-card-teams">
                <span class="attribute-explorer-team-pill">Team A ${teamA.toLocaleString()}</span>
                <span class="attribute-explorer-team-pill is-b">Team B ${teamB.toLocaleString()}</span>
                ${otherHtml}
            </div>
        </button>
    `;
}

function buildAttributeExplorerSourcePanel(attributeCode, teamCode, sourceKey, items) {
    const sourceLabel = sourceKey === "gold" ? "Gold Strings" : "Trainee Strings";
    const emptyText = `No ${sourceKey} strings tagged for ${teamLabel(teamCode)}.`;

    if (!items.length) {
        return `
            <article class="attribute-explorer-source-panel is-${sourceKey}">
                <div class="attribute-explorer-source-head">
                    <div>
                        <div class="attribute-explorer-source-label">${escapeHtml(sourceLabel)}</div>
                        <div class="attribute-explorer-source-sub">${escapeHtml(teamLabel(teamCode))}</div>
                    </div>
                    <span class="attribute-explorer-source-count">0</span>
                </div>
                <div class="attribute-explorer-source-empty">${escapeHtml(emptyText)}</div>
            </article>
        `;
    }

    const rowsHtml = items.map((item, index) => {
        const noteLabel = SPECIAL_PRESENCE_ACTIONS.has(attributeCode)
            ? attributeCode
            : `${attributeCode}-${String(item.note || "?")}`;
        const metaBits = [
            item.player ? `<span>${escapeHtml(item.player)}</span>` : "",
            item.timestamp ? `<span>${escapeHtml(item.timestamp)}</span>` : "",
            noteLabel ? `<span>${escapeHtml(noteLabel)}</span>` : "",
            item.foot && item.foot !== "X" ? `<span>${escapeHtml(item.foot)}</span>` : "",
            item.special_action && item.special_action !== "X" && item.special_action !== attributeCode
                ? `<span>${escapeHtml(item.special_action)}</span>`
                : "",
        ].filter(Boolean).join("");

        return `
            <article class="attribute-explorer-string-card">
                <div class="attribute-explorer-string-head">
                    <span class="attribute-explorer-string-index">#${index + 1}</span>
                    <span class="attribute-explorer-string-meta">${metaBits}</span>
                </div>
                <pre class="attribute-explorer-string-raw">${escapeHtml(item.raw || "")}</pre>
            </article>
        `;
    }).join("");

    return `
        <article class="attribute-explorer-source-panel is-${sourceKey}">
            <div class="attribute-explorer-source-head">
                <div>
                    <div class="attribute-explorer-source-label">${escapeHtml(sourceLabel)}</div>
                    <div class="attribute-explorer-source-sub">${escapeHtml(teamLabel(teamCode))}</div>
                </div>
                <span class="attribute-explorer-source-count">${items.length.toLocaleString()}</span>
            </div>
            <div class="attribute-explorer-source-list">
                ${rowsHtml}
            </div>
        </article>
    `;
}

function buildAttributeExplorerTeamBoard(entry, teamCode) {
    const teamGroup = entry.teams[teamCode] || {};
    const goldItems = Array.isArray(teamGroup.gold) ? teamGroup.gold : [];
    const traineeItems = Array.isArray(teamGroup.trainee) ? teamGroup.trainee : [];
    const total = goldItems.length + traineeItems.length;

    return `
        <section class="attribute-explorer-team-board team-${escapeHtml(teamCode.toLowerCase())}">
            <div class="attribute-explorer-team-head">
                <div>
                    <div class="attribute-explorer-team-title">${escapeHtml(teamLabel(teamCode))}</div>
                    <div class="attribute-explorer-team-sub">Gold ${goldItems.length.toLocaleString()} | Trainee ${traineeItems.length.toLocaleString()}</div>
                </div>
                <span class="attribute-explorer-team-total">${total.toLocaleString()} tagged</span>
            </div>
            <div class="attribute-explorer-source-grid">
                ${buildAttributeExplorerSourcePanel(entry.code, teamCode, "gold", goldItems)}
                ${buildAttributeExplorerSourcePanel(entry.code, teamCode, "trainee", traineeItems)}
            </div>
        </section>
    `;
}

function renderAttributeExplorerSection() {
    const listNode = document.getElementById("attributeExplorerList");
    const detailNode = document.getElementById("attributeExplorerDetail");
    if (!listNode || !detailNode) return;

    if (!hasEvaluationRun) {
        listNode.innerHTML = `
            <div class="attribute-explorer-empty-state">
                <div class="attribute-explorer-empty-title">No attribute data yet</div>
                <div class="attribute-explorer-empty-sub">Run an evaluation to unlock the attribute explorer.</div>
            </div>
        `;
        detailNode.innerHTML = `
            <div class="attribute-explorer-detail-empty">
                <div class="attribute-explorer-empty-title">Select an attribute after evaluation</div>
                <div class="attribute-explorer-empty-sub">This panel will show Team A and Team B strings for both Gold and Trainee.</div>
            </div>
        `;
        return;
    }

    const entries = getAttributeExplorerEntries();
    if (!entries.length) {
        listNode.innerHTML = `
            <div class="attribute-explorer-empty-state">
                <div class="attribute-explorer-empty-title">No tagged attributes available</div>
                <div class="attribute-explorer-empty-sub">The current evaluation did not produce attribute-level string groups.</div>
            </div>
        `;
        detailNode.innerHTML = `
            <div class="attribute-explorer-detail-empty">
                <div class="attribute-explorer-empty-title">No attribute strings to display</div>
                <div class="attribute-explorer-empty-sub">Try another evaluation run with valid tagged strings.</div>
            </div>
        `;
        return;
    }

    if (!selectedAttributeExplorerCode || !entries.some((entry) => entry.code === selectedAttributeExplorerCode)) {
        selectedAttributeExplorerCode = entries[0].code;
    }

    const selected = entries.find((entry) => entry.code === selectedAttributeExplorerCode) || entries[0];
    selectedAttributeExplorerCode = selected.code;

    listNode.innerHTML = entries.map((entry) => buildAttributeExplorerCard(entry, entry.code === selected.code)).join("");

    const detailTeams = ["A", "B"];
    if (Number(selected.teamTotals.OTHER || 0) > 0) {
        detailTeams.push("OTHER");
    }
    const teamBoardsHtml = detailTeams.map((teamCode) => buildAttributeExplorerTeamBoard(selected, teamCode)).join("");
    const leadingTeam = (selected.teamTotals.A || 0) >= (selected.teamTotals.B || 0) ? "Team A" : "Team B";

    detailNode.innerHTML = `
        <div class="attribute-explorer-detail-hero">
            <div>
                <div class="attribute-explorer-kicker">Attribute Explorer</div>
                <h3 class="attribute-explorer-detail-title">${escapeHtml(attributeLabel(selected.code))}</h3>
                <p class="attribute-explorer-detail-sub">Raw strings grouped by team and source for fast analyst review. Leading volume: ${escapeHtml(leadingTeam)}.</p>
            </div>
            <div class="attribute-explorer-summary-grid">
                <article class="attribute-explorer-summary-card is-gold">
                    <span>Gold</span>
                    <strong>${selected.gold_total.toLocaleString()}</strong>
                </article>
                <article class="attribute-explorer-summary-card is-trainee">
                    <span>Trainee</span>
                    <strong>${selected.trainee_total.toLocaleString()}</strong>
                </article>
                <article class="attribute-explorer-summary-card">
                    <span>Team A</span>
                    <strong>${Number(selected.teamTotals.A || 0).toLocaleString()}</strong>
                </article>
                <article class="attribute-explorer-summary-card">
                    <span>Team B</span>
                    <strong>${Number(selected.teamTotals.B || 0).toLocaleString()}</strong>
                </article>
            </div>
        </div>
        <div class="attribute-explorer-team-stack">
            ${teamBoardsHtml}
        </div>
    `;
}

function setInsightsLoading(isLoading) {
    const loader = document.getElementById("insightLoader");
    const loaderCard = loader ? loader.querySelector(".insight-loader-card") : null;
    const submitBtn = document.querySelector("#uploadForm button[type='submit']");
    if (!loader) return;

    if (isLoading) {
        loader.classList.add("show");
        loader.setAttribute("aria-hidden", "false");
        if (MOTION_ENABLED) {
            motionRun({
                targets: loader,
                opacity: [0, 1],
                duration: 160,
                easing: "linear"
            });
            motionRun({
                targets: loaderCard,
                opacity: [0, 1],
                scale: [0.94, 1],
                translateY: [12, 0],
                duration: 220,
                easing: "easeOutCubic"
            });
        }
    } else if (MOTION_ENABLED && loader.classList.contains("show")) {
        motionRun({
            targets: loader,
            opacity: [1, 0],
            duration: 140,
            easing: "linear",
            complete: () => {
                loader.classList.remove("show");
                loader.setAttribute("aria-hidden", "true");
                loader.style.opacity = "";
            }
        });
        motionRun({
            targets: loaderCard,
            opacity: [1, 0],
            scale: [1, 0.97],
            translateY: [0, 6],
            duration: 160,
            easing: "easeInOutQuad",
            complete: () => {
                if (loaderCard) {
                    loaderCard.style.opacity = "";
                    loaderCard.style.transform = "";
                }
            }
        });
    } else {
        loader.classList.remove("show");
        loader.setAttribute("aria-hidden", "true");
    }

    if (submitBtn) {
        submitBtn.disabled = !!isLoading;
        submitBtn.textContent = isLoading ? "Generating..." : "Run Full Evaluation";
    }
}

function renderKeyActionDrilldown(key) {
    const target = document.getElementById("keyActionDrilldown");
    if (!target) return;

    const rows = Array.isArray(keyActionErrorStore[key]) ? keyActionErrorStore[key] : [];
    if (!key) {
        target.innerHTML = '';
        return;
    }

    if (!rows.length) {
        target.innerHTML = `
            <div class="key-drilldown-card mt-3">
                <div class="key-drilldown-title">Action ${escapeHtml(key)} has no mismatches in this run.</div>
            </div>
        `;
        animateStaggered("#keyActionDrilldown .key-drilldown-card", 0, 10, 420, 0.99);
        return;
    }

    const detailsHtml = rows.map((item, idx) => {
        const errors = Object.entries(item.errors || {});
        return `
            <article class="comparison-card mb-3">
                <div class="comparison-card-head">
                    <span class="comparison-id">${escapeHtml(key)} Error #${idx + 1}</span>
                    <span class="comparison-meta">${errors.length} field${errors.length === 1 ? '' : 's'} differ</span>
                </div>
                <div class="comparison-grid">
                    <div class="comparison-side comparison-side-gold">
                        <div class="comparison-label">Gold Standard</div>
                        <pre class="comparison-string">${escapeHtml(item.gold)}</pre>
                    </div>
                    <div class="comparison-side comparison-side-trainee">
                        <div class="comparison-label">Trainee Output</div>
                        <pre class="comparison-string">${escapeHtml(item.trainee)}</pre>
                    </div>
                </div>
                ${errors.length ? `
                    <div class="comparison-errors">
                        ${errors.map(([field, values]) => {
                            const expected = escapeHtml(values?.expected);
                            const predicted = escapeHtml(values?.predicted);
                            return `
                                <div class="error-chip">
                                    <span class="error-field">${escapeHtml(field).toUpperCase()}</span>
                                    <span class="error-text">Expected: <b>${expected}</b></span>
                                    <span class="error-text">Got: <b>${predicted}</b></span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </article>
        `;
    }).join('');

    target.innerHTML = `
        <div class="key-drilldown-card mt-3">
            <div class="key-drilldown-title">Mismatched Strings for ${escapeHtml(key)} (${rows.length})</div>
            ${detailsHtml}
        </div>
    `;
    animateStaggered("#keyActionDrilldown .key-drilldown-card, #keyActionDrilldown .comparison-card", 0, 10);
}

document.querySelectorAll(".sidebar-link[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        animateTapFeedback(link, 0.965);
        switchSidebarView(link.dataset.view);
    });
});

document.addEventListener("click", (event) => {
    const target = event.target.closest(".btn, .key-action-link, .attribute-mini-card, .insight-chip, .attribute-explorer-card");
    if (!target) return;
    animateTapFeedback(target);
});

document.addEventListener("click", (event) => {
    const card = event.target.closest(".attribute-explorer-card");
    if (!card) return;

    const nextCode = card.getAttribute("data-attribute-code") || "";
    if (!nextCode || nextCode === selectedAttributeExplorerCode) return;

    selectedAttributeExplorerCode = nextCode;
    renderAttributeExplorerSection();
    if (activeView === "attribute-explorer") {
        animateSidebarView("attribute-explorer");
    }
});

const checkerSearchInput = document.getElementById("checkerSearchInput");
if (checkerSearchInput) {
    checkerSearchInput.addEventListener("input", debounce(applyCheckerFilter, 180));
}

const auditSearchInput = document.getElementById("auditSearchInput");
if (auditSearchInput) {
    auditSearchInput.addEventListener("input", debounce(applyAuditFilter, 180));
}

renderMismatchSection();
renderAuditSection();
renderAttributeExplorerSection();

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        animateDashboardBoot();
    }, { once: true });
} else {
    setTimeout(() => {
        animateDashboardBoot();
    }, 30);
}

document.getElementById("uploadForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    setInsightsLoading(true);

    try {
        const formData = new FormData(this);
        const response = await fetch("/evaluate", { method: "POST", body: formData });
        const data = await response.json();

        if (!response.ok) {
            alert(data.error || 'Evaluation failed.');
            return;
        }
        if (data.attribute_display_names && typeof data.attribute_display_names === "object") {
            attributeDisplayNames = { ...ATTRIBUTE_FULL_NAMES, ...data.attribute_display_names };
        } else {
            attributeDisplayNames = { ...ATTRIBUTE_FULL_NAMES };
        }
        attributeNoteBreakdown = (data.attribute_note_breakdown && typeof data.attribute_note_breakdown === "object")
            ? data.attribute_note_breakdown
            : {};
        attributeTeamBreakdown = (data.attribute_team_breakdown && typeof data.attribute_team_breakdown === "object")
            ? data.attribute_team_breakdown
            : {};
        attributeTeamNoteBreakdown = (data.attribute_team_note_breakdown && typeof data.attribute_team_note_breakdown === "object")
            ? data.attribute_team_note_breakdown
            : {};
        attributeStringLibrary = (data.attribute_string_library && typeof data.attribute_string_library === "object")
            ? data.attribute_string_library
            : {};
        latestEvaluationData = data;

        document.getElementById("downloadPdf").style.display = "block";

        document.getElementById("summary-section").innerHTML = `
        <div class="row g-3 mb-4 text-center">
            <div class="col-md-3">
                <div class="p-4 bg-primary text-white rounded-4 shadow-sm">
                    <h2 class="display-6 fw-bold m-0 summary-accuracy" data-value="${Number(data.overall_accuracy || 0)}">${data.overall_accuracy}%</h2>
                    <small class="text-uppercase fw-bold">Overall Accuracy</small>
                </div>
            </div>
            <div class="col-md-9 d-flex gap-2">
                <div class="flex-fill bg-white p-3 rounded-4 border"><b>Correct</b><br><span class="summary-number" data-value="${Number(data.correct || 0)}">${data.correct}</span></div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-warning"><b>Missed</b><br><span class="summary-number" data-value="${Number(data.missed_count || 0)}">${data.missed_count}</span></div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-danger"><b>Mismatch</b><br><span class="summary-number" data-value="${Number(data.mismatch_count || 0)}">${data.mismatch_count}</span></div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-info"><b>Extra</b><br><span class="summary-number" data-value="${Number(data.extra_count || 0)}">${data.extra_count}</span></div>
            </div>
        </div>
        `;
        animateSummaryMetrics();

        const insights = data.insights || {};
        const mostAttr = insights.most_error_attribute || {};
        const tsInfo = insights.timestamp_deviation || {};
        const passInfo = insights.passing_error_prone || {};
        const halfInfo = insights.half_mistakes || {};
        const players = Array.isArray(insights.top_players_wrong) ? insights.top_players_wrong : [];
        const keyActionSections = Array.isArray(insights.key_action_sections) ? insights.key_action_sections : [];
        keyActionErrorStore = (insights.key_action_error_details && typeof insights.key_action_error_details === "object")
            ? insights.key_action_error_details
            : {};
        const trends = insights.trends || {};
        const attrTrend = Array.isArray(trends.attribute) ? trends.attribute : [];
        const tsTrend = Array.isArray(trends.timestamp) ? trends.timestamp : [];
        const passTrend = Array.isArray(trends.passing) ? trends.passing : [];
        const halfTrend = Array.isArray(trends.half) ? trends.half : [];

        const passingMessage = passInfo.is_more_error_prone === null
            ? `Insufficient data to compare passing vs non-passing error rates.`
            : (passInfo.is_more_error_prone
                ? `Passing actions are more error-prone (${passInfo.passing_error_rate}% vs ${passInfo.non_passing_error_rate}%).`
                : `Passing actions are not more error-prone (${passInfo.passing_error_rate}% vs ${passInfo.non_passing_error_rate}%).`);
        const passingState = passInfo.is_more_error_prone === null
            ? 'neutral'
            : (passInfo.is_more_error_prone ? 'warn' : 'good');
        const timestampState = tsInfo.is_common ? 'warn' : 'good';
        const worstHalf = halfInfo.worst_half || 'N/A';

        const playersHtml = players.length
            ? players.map((p, i) => `<span class="insight-chip"><b>#${i + 1}</b> ${p.player} <i>${p.errors}</i></span>`).join('')
            : `<span class="insight-chip">No recurring player error pattern yet.</span>`;
        const keyActionSectionsHtml = keyActionSections.length
            ? keyActionSections.map((section) => {
                const rows = Array.isArray(section.rows) ? section.rows : [];
                const bodyRows = rows.length
                    ? rows.map((row) => `
                        <tr>
                            <td><button type="button" class="key-action-link" data-key="${escapeHtml(row.key)}">${escapeHtml(row.key)}</button></td>
                            <td>${Number(row.total || 0)}</td>
                            <td>${Number(row.mismatches || 0)}</td>
                            <td>${Number(row.error_rate || 0).toFixed(2)}%</td>
                        </tr>
                    `).join('')
                    : `<tr><td colspan="4">No data</td></tr>`;

                return `
                    <article class="key-action-card key-action-${escapeHtml(section.id || 'section')}">
                        <div class="key-action-head">${escapeHtml(section.title || 'Key Actions')}</div>
                        <div class="table-responsive">
                            <table class="table table-sm mb-0 insight-table">
                                <thead>
                                    <tr>
                                        <th>Action-Note</th>
                                        <th>Total</th>
                                        <th>Mismatches</th>
                                        <th>Error Rate</th>
                                    </tr>
                                </thead>
                                <tbody>${bodyRows}</tbody>
                            </table>
                        </div>
                    </article>
                `;
            }).join('')
            : `<div class="insight-line mt-0">No key action data available.</div>`;

        document.getElementById("insights-section").innerHTML = `
        <div class="chart-card shadow-sm p-4 bg-white rounded-4 insights-board">
            <div class="insights-head">
                <h5 class="fw-bold m-0">Performance Insights</h5>
                <span class="insights-sub">Automated quality intelligence from current run</span>
            </div>
            <div class="insights-grid mt-3">
                <article class="insight-card">
                    <div class="insight-kicker">Top Error Attribute</div>
                    <div class="insight-main">${mostAttr.attribute ? attributeLabel(mostAttr.attribute) : 'N/A'}</div>
                    <div class="insight-note">${mostAttr.count || 0} mismatch case(s)</div>
                    <div class="insight-spark">${sparklineSvg(attrTrend, '#8ab4ff')}</div>
                </article>
                <article class="insight-card">
                    <div class="insight-kicker">Timestamp Deviation</div>
                    <div class="insight-main">${tsInfo.percentage || 0}%</div>
                    <div class="insight-note">${tsInfo.count || 0} out-of-tolerance case(s)</div>
                    <div class="insight-note">Within tolerance drift: ${tsInfo.within_tolerance_count || 0} (${tsInfo.within_tolerance_percentage || 0}%)</div>
                    <span class="insight-badge ${timestampState}">${tsInfo.is_common ? 'Common' : 'Controlled'}</span>
                    <div class="insight-spark">${sparklineSvg(tsTrend, '#f7b267')}</div>
                </article>
                <article class="insight-card">
                    <div class="insight-kicker">Passing Error Profile</div>
                    <div class="insight-main">${passInfo.passing_error_rate ?? 0}%</div>
                    <div class="insight-note">Non-passing: ${passInfo.non_passing_error_rate ?? 0}%</div>
                    <span class="insight-badge ${passingState}">${passInfo.is_more_error_prone === null ? 'Unknown' : (passInfo.is_more_error_prone ? 'Higher Risk' : 'Stable')}</span>
                    <div class="insight-spark">${sparklineSvg(passTrend, '#84d8c9')}</div>
                </article>
                <article class="insight-card">
                    <div class="insight-kicker">Half-wise Mistakes</div>
                    <div class="insight-main">${worstHalf}</div>
                    <div class="insight-note">FHN ${halfInfo.FHN || 0} | SHN ${halfInfo.SHN || 0} | Other ${halfInfo.OTHER || 0}</div>
                    <div class="insight-spark">${sparklineSvg(halfTrend, '#f497b6')}</div>
                </article>
            </div>
            <div class="insight-players mt-3">
                <div class="insight-kicker mb-2">Frequently Incorrect Player Tags</div>
                <div class="insight-chip-wrap">${playersHtml}</div>
            </div>
            <div class="key-action-board mt-3">
                ${keyActionSectionsHtml}
            </div>
            <div id="keyActionDrilldown"></div>
            <div class="insight-line mt-3">${passingMessage}</div>
        </div>
        `;

        document.querySelectorAll(".key-action-link").forEach((btn) => {
            btn.addEventListener("click", () => {
                const key = btn.getAttribute("data-key") || "";
                document.querySelectorAll(".key-action-link").forEach((el) => el.classList.remove("active"));
                btn.classList.add("active");
                renderKeyActionDrilldown(key);
            });
        });

        renderCharts(data);
        animateChartPanels();

        hasEvaluationRun = true;
        latestMismatchRows = Array.isArray(data.mismatched_details) ? data.mismatched_details : [];
        latestAlignmentRows = Array.isArray(data.alignment_rows) ? data.alignment_rows : [];
        if (activeView === "string-checker") {
            renderMismatchSection();
        } else if (activeView === "string-audit") {
            renderAuditSection();
        } else if (activeView === "attribute-explorer") {
            renderAttributeExplorerSection();
        }
        animateEvaluationRender();
    } catch (err) {
        alert("Unable to generate insights. Please try again.");
    } finally {
        setInsightsLoading(false);
    }
});

/* ---------- Charts (ECharts) ---------- */
function renderCharts(data) {
    Object.values(charts).forEach((chart) => {
        try {
            chart.dispose();
        } catch (error) {
            // Ignore stale chart instances.
        }
    });
    charts = {};

    const EC = getChartTheme();

    const pieEl = document.getElementById('pieChart');
    if (pieEl) {
        const pieChart = echarts.init(pieEl, null, { renderer: 'canvas' });
        charts.pie = pieChart;
        const pieValues = [
            { value: data.correct, name: 'Correct', itemStyle: { color: '#22d47a' } },
            { value: data.missed_count, name: 'Missed', itemStyle: { color: '#f59e0b' } },
            { value: data.extra_count, name: 'Extra', itemStyle: { color: '#38bdf8' } },
            { value: data.mismatch_count, name: 'Mismatch', itemStyle: { color: '#f43f5e' } }
        ];
        const pieTotal = pieValues.reduce((sum, datum) => sum + datum.value, 0);

        pieChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                ...EC.tooltip,
                formatter: (point) => `<b>${point.name}</b><br/>${point.value} &nbsp;(${pieTotal ? ((point.value / pieTotal) * 100).toFixed(1) : 0}%)`
            },
            legend: {
                bottom: 6,
                left: 'center',
                ...EC.legend,
                icon: 'circle',
                itemWidth: 10,
                itemHeight: 10,
                itemGap: 18
            },
            series: [{
                type: 'pie',
                radius: ['42%', '70%'],
                center: ['50%', '46%'],
                data: pieValues,
                label: {
                    show: true,
                    position: 'inside',
                    formatter: (point) => pieTotal && (point.value / pieTotal) * 100 >= 4 ? `${((point.value / pieTotal) * 100).toFixed(1)}%` : '',
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 12
                },
                emphasis: {
                    itemStyle: { shadowBlur: 18, shadowColor: EC.pieShadow },
                    scale: true,
                    scaleSize: 6
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDuration: 900
            }]
        });

        const breakdownHtml = pieValues.map((point) => {
            const pct = pieTotal ? ((point.value / pieTotal) * 100).toFixed(1) : '0.0';
            return `<span class="mx-2"><b>${point.name}:</b> ${pct}%</span>`;
        }).join('');
        document.getElementById('pie-breakdown').innerHTML = breakdownHtml;
    }

    const barEl = document.getElementById('barChart');
    if (barEl) {
        const barChart = echarts.init(barEl, null, { renderer: 'canvas' });
        charts.bar = barChart;
        const fieldKeys = Object.keys(data.field_errors || {});
        const fieldVals = Object.values(data.field_errors || {});

        barChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip
            },
            grid: { left: 16, right: 24, top: 24, bottom: 60, containLabel: true },
            xAxis: {
                type: 'category',
                data: fieldKeys,
                axisLabel: { color: EC.mutedColor, rotate: 40, fontSize: 11 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            series: [{
                type: 'bar',
                data: fieldVals,
                barMaxWidth: 44,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#ff6f8a' },
                        { offset: 1, color: '#c0374f' }
                    ]),
                    borderRadius: [6, 6, 0, 0]
                },
                emphasis: { itemStyle: { color: '#ff9aad' } },
                label: {
                    show: true,
                    position: 'top',
                    color: EC.valueLabel,
                    fontSize: 11,
                    fontWeight: 'bold'
                },
                animationDelay: (index) => index * 60
            }],
            animationEasing: 'elasticOut',
            animationDuration: 900
        });
    }

    const timelineEl = document.getElementById('timelineChart');
    if (timelineEl) {
        const timelineChart = echarts.init(timelineEl, null, { renderer: 'canvas' });
        charts.timeline = timelineChart;
        const timeline = data.timeline_chart || {};
        const timelineLabels = Array.isArray(timeline.labels) ? timeline.labels : ['0-5', '5-10', '10-15', '15-20', '20-25', '25-30'];
        const timelineValues = Array.isArray(timeline.values) && timeline.values.length === timelineLabels.length
            ? timeline.values
            : timelineLabels.map(() => 0);

        timelineChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip,
                formatter: (points) => `<b>${points[0].name} min</b><br/>Errors: <b>${points[0].value}</b>`
            },
            grid: { left: 16, right: 24, top: 24, bottom: 48, containLabel: true },
            xAxis: {
                type: 'category',
                data: timelineLabels,
                name: 'Minutes',
                nameLocation: 'middle',
                nameGap: 32,
                nameTextStyle: { color: EC.mutedColor, fontSize: 11 },
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            visualMap: {
                show: false,
                min: 0,
                max: Math.max(...timelineValues, 1),
                inRange: { color: ['#1e4d7b', '#0ea5e9', '#7dd3fc'] }
            },
            series: [{
                type: 'bar',
                data: timelineValues,
                barMaxWidth: 36,
                itemStyle: { borderRadius: [5, 5, 0, 0] },
                emphasis: { itemStyle: { shadowBlur: 12, shadowColor: EC.timelineShadow } },
                label: {
                    show: true,
                    position: 'top',
                    color: EC.timelineValueLabel,
                    fontSize: 10,
                    fontWeight: 'bold',
                    formatter: (point) => point.value > 0 ? point.value : ''
                },
                animationDelay: (index) => index * 50
            }],
            animationEasing: 'cubicOut',
            animationDuration: 800
        });
    }

    const attrComp = data.attribute_comparison || {};
    let attrLabels = Array.isArray(attrComp.labels) ? [...attrComp.labels] : [];
    let goldValues = Array.isArray(attrComp.gold_values) ? [...attrComp.gold_values] : [];
    let traineeValues = Array.isArray(attrComp.trainee_values) ? [...attrComp.trainee_values] : [];

    const mustShowAttrs = ['CN', 'F', 'FK', 'GK'];
    const goldMap = new Map(attrLabels.map((label, index) => [label, goldValues[index] ?? 0]));
    const traineeMap = new Map(attrLabels.map((label, index) => [label, traineeValues[index] ?? 0]));
    mustShowAttrs.forEach((attr) => {
        if (!goldMap.has(attr)) {
            attrLabels.push(attr);
            goldMap.set(attr, 0);
            traineeMap.set(attr, 0);
        }
    });
    goldValues = attrLabels.map((label) => goldMap.get(label) ?? 0);
    traineeValues = attrLabels.map((label) => traineeMap.get(label) ?? 0);
    const attrDisplayLabels = attrLabels.map((code) => attributeLabel(code));

    const attrCompEl = document.getElementById('attributeCompareChart');
    if (attrCompEl && attrLabels.length) {
        const attrCompChart = echarts.init(attrCompEl, null, { renderer: 'canvas' });
        charts.attributeComparison = attrCompChart;
        attrCompChart.setOption({
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                ...EC.tooltip
            },
            legend: {
                top: 4,
                right: 12,
                ...EC.legend,
                data: ['Gold', 'Trainee']
            },
            grid: { left: 16, right: 16, top: 40, bottom: 80, containLabel: true },
            xAxis: {
                type: 'category',
                data: attrDisplayLabels,
                axisLabel: { color: EC.mutedColor, rotate: 60, fontSize: 10, interval: 0 },
                axisLine: { lineStyle: { color: EC.axisLineColor } },
                splitLine: { show: false }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: EC.mutedColor, fontSize: 11 },
                splitLine: { lineStyle: { color: EC.gridLine } }
            },
            series: [
                {
                    name: 'Gold',
                    type: 'bar',
                    data: goldValues,
                    barMaxWidth: 22,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#818cf8' },
                            { offset: 1, color: '#4f46e5' }
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: { itemStyle: { color: '#a5b4fc' } }
                },
                {
                    name: 'Trainee',
                    type: 'bar',
                    data: traineeValues,
                    barMaxWidth: 22,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#fbbf24' },
                            { offset: 1, color: '#d97706' }
                        ]),
                        borderRadius: [4, 4, 0, 0]
                    },
                    emphasis: { itemStyle: { color: '#fde68a' } }
                }
            ],
            animationEasing: 'elasticOut',
            animationDuration: 950
        });
    }

    const skippedParse = Number(data.trainee_count_skipped || 0);
    const skippedValid = Number(data.trainee_count_skipped_valid || 0);
    document.getElementById('attributeCompareMeta').innerHTML =
        `Counts use all parsed trainee strings. Parse-skipped: <b>${skippedParse}</b>, validation-invalid: <b>${skippedValid}</b>.`;

    const barsGrid = document.getElementById('attributeBarsGrid');
    if (barsGrid && attrLabels.length) {
        barsGrid.innerHTML = '';

        attrLabels.forEach((label, idx) => {
            const divId = `attrBar_${idx}`;
            const col = document.createElement('div');
            col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
            col.innerHTML = `
                <div class="p-3 rounded-4 border h-100 attribute-mini-card" role="button" tabindex="0" aria-label="Open ${attributeLabel(label)} count details">
                    <div class="fw-bold mb-2 text-center" style="font-size:0.8rem;">${attributeLabel(label)}</div>
                    <div id="${divId}" style="height:190px;"></div>
                </div>
            `;
            barsGrid.appendChild(col);

            const card = col.querySelector('.attribute-mini-card');
            if (card) {
                const openDetails = () => showAttributeCountModal(label, goldValues[idx], traineeValues[idx]);
                card.addEventListener('click', openDetails);
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openDetails();
                    }
                });
            }

            const miniDiv = document.getElementById(divId);
            if (miniDiv) {
                const miniChart = echarts.init(miniDiv, null, { renderer: 'canvas' });
                charts[`attribute_${label}_${idx}`] = miniChart;
                const goldValue = goldValues[idx];
                const traineeValue = traineeValues[idx];

                miniChart.setOption({
                    backgroundColor: 'transparent',
                    tooltip: {
                        ...EC.tooltip,
                        formatter: (point) => `<b>${point.name}</b>: ${point.value}`
                    },
                    grid: { left: 10, right: 10, top: 16, bottom: 10, containLabel: true },
                    xAxis: {
                        type: 'category',
                        data: ['Gold', 'Trainee'],
                        axisLabel: { color: EC.strongAxisLabel, fontWeight: 'bold', fontSize: 12 },
                        axisLine: { show: false },
                        axisTick: { show: false }
                    },
                    yAxis: {
                        type: 'value',
                        axisLabel: { color: EC.mutedColor, fontSize: 10 },
                        splitLine: { lineStyle: { color: EC.gridLine } }
                    },
                    series: [{
                        type: 'bar',
                        data: [
                            {
                                value: goldValue,
                                itemStyle: {
                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: '#818cf8' },
                                        { offset: 1, color: '#4f46e5' }
                                    ]),
                                    borderRadius: [5, 5, 0, 0]
                                }
                            },
                            {
                                value: traineeValue,
                                itemStyle: {
                                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                        { offset: 0, color: '#fbbf24' },
                                        { offset: 1, color: '#d97706' }
                                    ]),
                                    borderRadius: [5, 5, 0, 0]
                                }
                            }
                        ],
                        barMaxWidth: 40,
                        label: {
                            show: true,
                            position: 'top',
                            color: EC.miniValueLabel,
                            fontWeight: 'bold',
                            fontSize: 12,
                            formatter: (point) => point.value
                        }
                    }],
                    animationDuration: 700,
                    animationEasing: 'cubicOut',
                    animationDelay: () => idx * 30
                });
            }
        });
    } else if (barsGrid) {
        barsGrid.innerHTML = '<div class="col-12 text-center small">No attribute comparison data available.</div>';
    }

    if (window._ecResizeHandler) {
        window.removeEventListener('resize', window._ecResizeHandler);
    }
    window._ecResizeHandler = () => {
        Object.values(charts).forEach((chart) => {
            try {
                chart.resize();
            } catch (error) {
                // Ignore disposed chart instances.
            }
        });
    };
    window.addEventListener('resize', window._ecResizeHandler);
}

/* ---------- PDF Export ---------- */
const PDF_TARGET_MIN_BYTES = 2 * 1024 * 1024;
const PDF_TARGET_MAX_BYTES = 5 * 1024 * 1024;
const PDF_TARGET_IDEAL_BYTES = 3.5 * 1024 * 1024;
const PDF_MARGIN_MM = 6;
const PDF_BLOCK_GAP_MM = 4;

function createPdfDocument() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    return {
        pdf,
        margin: PDF_MARGIN_MM,
        gap: PDF_BLOCK_GAP_MM,
        usableWidth: pageWidth - (PDF_MARGIN_MM * 2),
        usableHeight: pageHeight - (PDF_MARGIN_MM * 2),
        currentY: PDF_MARGIN_MM
    };
}

function downscaleCanvas(sourceCanvas, maxWidth) {
    if (!sourceCanvas || sourceCanvas.width <= maxWidth) {
        return sourceCanvas;
    }

    const ratio = maxWidth / sourceCanvas.width;
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = Math.max(1, Math.round(sourceCanvas.width * ratio));
    scaledCanvas.height = Math.max(1, Math.round(sourceCanvas.height * ratio));

    const scaledContext = scaledCanvas.getContext('2d', { alpha: false });
    scaledContext.imageSmoothingEnabled = true;
    scaledContext.imageSmoothingQuality = 'high';
    scaledContext.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

    return scaledCanvas;
}

function addCanvasSliceToPdf(doc, sliceCanvas, jpegQuality, compressionMode) {
    const imgData = sliceCanvas.toDataURL('image/jpeg', jpegQuality);
    const imgHeightMm = (sliceCanvas.height * doc.usableWidth) / sliceCanvas.width;
    doc.pdf.addImage(imgData, 'JPEG', doc.margin, doc.currentY, doc.usableWidth, imgHeightMm, undefined, compressionMode);
    doc.currentY += imgHeightMm + doc.gap;
}

function addCanvasBlockToPdf(doc, sourceCanvas, jpegQuality, compressionMode) {
    const blockHeightMm = (sourceCanvas.height * doc.usableWidth) / sourceCanvas.width;

    if (blockHeightMm <= doc.usableHeight) {
        if (doc.currentY > doc.margin && (doc.currentY + blockHeightMm) > (doc.margin + doc.usableHeight)) {
            doc.pdf.addPage();
            doc.currentY = doc.margin;
        }
        addCanvasSliceToPdf(doc, sourceCanvas, jpegQuality, compressionMode);
        return;
    }

    if (doc.currentY > doc.margin) {
        doc.pdf.addPage();
        doc.currentY = doc.margin;
    }

    const pagePixelHeight = Math.floor((sourceCanvas.width * doc.usableHeight) / doc.usableWidth);
    let offsetY = 0;

    while (offsetY < sourceCanvas.height) {
        const sliceHeight = Math.min(pagePixelHeight, sourceCanvas.height - offsetY);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = sourceCanvas.width;
        sliceCanvas.height = sliceHeight;
        const sliceContext = sliceCanvas.getContext('2d', { alpha: false });
        sliceContext.imageSmoothingEnabled = true;
        sliceContext.imageSmoothingQuality = 'high';
        sliceContext.drawImage(
            sourceCanvas,
            0,
            offsetY,
            sourceCanvas.width,
            sliceHeight,
            0,
            0,
            sourceCanvas.width,
            sliceHeight
        );

        addCanvasSliceToPdf(doc, sliceCanvas, jpegQuality, compressionMode);
        offsetY += sliceHeight;

        if (offsetY < sourceCanvas.height) {
            doc.pdf.addPage();
            doc.currentY = doc.margin;
        }
    }
}

function getPrintableBlocks(targetNode) {
    const blocks = [];
    const sections = Array.from(targetNode.children).filter((section) => window.getComputedStyle(section).display !== 'none');

    sections.forEach((section) => {
        Array.from(section.children).forEach((child) => {
            if (window.getComputedStyle(child).display === 'none') {
                return;
            }

            if (["summary-section", "insights-section", "mismatch-section", "audit-section"].includes(child.id)) {
                Array.from(child.children).forEach((nestedChild) => {
                    if (window.getComputedStyle(nestedChild).display !== 'none' && nestedChild.getBoundingClientRect().height > 0) {
                        blocks.push(nestedChild);
                    }
                });
                return;
            }

            if (child.getBoundingClientRect().height > 0) {
                blocks.push(child);
            }
        });
    });

    return blocks;
}

async function buildPdfFromBlocks(blocks, attempt) {
    const doc = createPdfDocument();

    for (const block of blocks) {
        const canvas = await html2canvas(block, {
            scale: attempt.scale,
            backgroundColor: '#0c1628',
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: -window.scrollY,
            width: block.scrollWidth || block.offsetWidth,
            height: block.scrollHeight || block.offsetHeight,
            windowWidth: document.documentElement.scrollWidth,
            windowHeight: document.documentElement.scrollHeight
        });
        const optimizedCanvas = downscaleCanvas(canvas, attempt.maxWidth);
        addCanvasBlockToPdf(doc, optimizedCanvas, attempt.quality, attempt.compression);
    }

    return doc.pdf;
}

async function createCompressedPdf(targetNode) {
    const exportHeight = targetNode.scrollHeight || targetNode.offsetHeight || 0;
    const blocks = getPrintableBlocks(targetNode);
    if (!blocks.length) {
        return null;
    }
    const attempts = exportHeight > 7000
        ? [
            { scale: 1.18, quality: 0.72, maxWidth: 1700, compression: 'MEDIUM' },
            { scale: 1.04, quality: 0.64, maxWidth: 1500, compression: 'MEDIUM' },
            { scale: 0.92, quality: 0.56, maxWidth: 1320, compression: 'MEDIUM' },
            { scale: 0.82, quality: 0.48, maxWidth: 1160, compression: 'SLOW' },
            { scale: 0.74, quality: 0.4, maxWidth: 1020, compression: 'SLOW' }
        ]
        : [
            { scale: 1.36, quality: 0.78, maxWidth: 2200, compression: 'MEDIUM' },
            { scale: 1.2, quality: 0.7, maxWidth: 1920, compression: 'MEDIUM' },
            { scale: 1.06, quality: 0.62, maxWidth: 1660, compression: 'MEDIUM' },
            { scale: 0.94, quality: 0.54, maxWidth: 1440, compression: 'SLOW' },
            { scale: 0.82, quality: 0.46, maxWidth: 1240, compression: 'SLOW' }
        ];

    let bestUnderMax = null;
    let smallestOverMax = null;

    for (let index = 0; index < attempts.length; index += 1) {
        const pdf = await buildPdfFromBlocks(blocks, attempts[index]);
        const blob = pdf.output('blob');
        const candidate = { pdf, size: blob.size };

        if (blob.size >= PDF_TARGET_MIN_BYTES && blob.size <= PDF_TARGET_MAX_BYTES) {
            return pdf;
        }

        if (blob.size <= PDF_TARGET_MAX_BYTES) {
            if (!bestUnderMax || Math.abs(blob.size - PDF_TARGET_IDEAL_BYTES) < Math.abs(bestUnderMax.size - PDF_TARGET_IDEAL_BYTES)) {
                bestUnderMax = candidate;
            }
            if (blob.size < PDF_TARGET_MIN_BYTES) {
                break;
            }
            continue;
        }

        if (!smallestOverMax || blob.size < smallestOverMax.size) {
            smallestOverMax = candidate;
        }
    }

    return (bestUnderMax || smallestOverMax || {}).pdf || null;
}

async function exportPdfWithFilename(filename) {
    const button = document.getElementById("downloadPdf");
    const printableNode = document.getElementById('printable-content');
    if (!printableNode || !button) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Exporting...";

    try {
        const pdf = await createCompressedPdf(printableNode);
        if (!pdf) {
            throw new Error("PDF generation failed");
        }
        pdf.save(filename);
    } catch (error) {
        alert("Unable to export PDF right now. Please try again.");
    } finally {
        button.disabled = false;
        button.textContent = originalText;
    }
}

document.getElementById("downloadPdf").addEventListener("click", function() {
    showExportNameModal();
});

if (exportNameConfirm) {
    exportNameConfirm.addEventListener("click", async () => {
        const analystName = analystNameInput ? analystNameInput.value : "";
        const filename = buildExportFilename(analystName);
        try {
            localStorage.setItem(STORAGE_KEYS.analystName, analystName);
        } catch (err) {
            // Ignore storage access errors silently.
        }
        hideExportNameModal();
        await exportPdfWithFilename(filename);
    });
}


let charts = {};
let latestAlignmentRows = [];
let keyActionErrorStore = {};
let attributeNoteBreakdown = {};
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
    trainee: "stepout_trainee_text"
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
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

function hideAttributeCountModal() {
    const modal = document.getElementById("attributeCountModal");
    if (!modal) return;
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function showAttributeCountModal(attributeCode, goldCount, traineeCount) {
    const modal = document.getElementById("attributeCountModal");
    const title = document.getElementById("attributeCountModalTitle");
    const goldNode = document.getElementById("attributeCountGold");
    const traineeNode = document.getElementById("attributeCountTrainee");
    const deltaNode = document.getElementById("attributeCountDelta");
    const notesNode = document.getElementById("attributeCountNotes");
    if (!modal || !title || !goldNode || !traineeNode || !deltaNode || !notesNode) return;

    const breakdown = (attributeNoteBreakdown && typeof attributeNoteBreakdown === "object")
        ? (attributeNoteBreakdown[attributeCode] || {})
        : {};
    const goldNotes = breakdown.gold || {};
    const traineeNotes = breakdown.trainee || {};
    const noteKeys = Array.from(new Set([...Object.keys(goldNotes), ...Object.keys(traineeNotes)]))
        .sort((a, b) => {
            const aNum = /^\d+$/.test(String(a));
            const bNum = /^\d+$/.test(String(b));
            if (aNum && bNum) return Number(a) - Number(b);
            return String(a).localeCompare(String(b));
        });

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

    if (!noteKeys.length) {
        notesNode.innerHTML = `<div class="attribute-note-empty">No action-note breakdown available.</div>`;
    } else {
        const rowsHtml = noteKeys.map((note) => {
            const g = Number(goldNotes[note] || 0);
            const t = Number(traineeNotes[note] || 0);
            return `
                <div class="attribute-note-row">
                    <span class="attribute-note-key">${escapeHtml(`${attributeCode}-${note}`)}</span>
                    <span class="attribute-note-val is-gold">${g.toLocaleString()}</span>
                    <span class="attribute-note-val is-trainee">${t.toLocaleString()}</span>
                </div>
            `;
        }).join('');

        notesNode.innerHTML = `
            <div class="attribute-note-row attribute-note-row-head">
                <span>Action-Note</span>
                <span>Gold</span>
                <span>Trainee</span>
            </div>
            ${rowsHtml}
        `;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function restoreSavedInputs() {
    const goldBox = document.getElementById("gold_text");
    const traineeBox = document.getElementById("trainee_text");
    if (!goldBox || !traineeBox) return;

    try {
        const savedGold = localStorage.getItem(STORAGE_KEYS.gold);
        const savedTrainee = localStorage.getItem(STORAGE_KEYS.trainee);

        if (savedGold !== null) goldBox.value = savedGold;
        if (savedTrainee !== null) traineeBox.value = savedTrainee;
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

restoreSavedInputs();
attachInputPersistence();

const attributeCountModal = document.getElementById("attributeCountModal");
const attributeCountModalClose = document.getElementById("attributeCountModalClose");
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
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideAttributeCountModal();
    }
});

function switchSidebarView(viewName) {
    const homeView = document.getElementById("homeView");
    const checkerView = document.getElementById("stringCheckerView");
    const auditView = document.getElementById("stringAuditView");
    if (!homeView || !checkerView || !auditView) return;

    const navLinks = document.querySelectorAll(".sidebar-link[data-view]");
    navLinks.forEach((link) => {
        link.classList.toggle("active", link.dataset.view === viewName);
    });

    if (viewName === "string-checker") {
        homeView.style.display = "none";
        checkerView.style.display = "block";
        auditView.style.display = "none";
    } else if (viewName === "string-audit") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "block";
    } else {
        homeView.style.display = "block";
        checkerView.style.display = "none";
        auditView.style.display = "none";
    }
}

function applyAuditFilter() {
    const container = document.getElementById("audit-section");
    const input = document.getElementById("auditSearchInput");
    const meta = document.getElementById("auditSearchMeta");
    if (!container || !input || !meta) return;

    const q = input.value.trim().toLowerCase();
    const rows = Array.isArray(latestAlignmentRows) ? latestAlignmentRows : [];

    let visibleCount = 0;
    const cards = container.querySelectorAll(".audit-card");
    cards.forEach((card, idx) => {
        const row = rows[idx] || {};
        const haystack = [
            row.status || "",
            row.gold || "",
            row.trainee || "",
            JSON.stringify(row.errors || {}),
            JSON.stringify(row.warnings || {})
        ].join(" ").toLowerCase();

        const show = !q || haystack.includes(q);
        card.style.display = show ? "" : "none";
        if (show) visibleCount += 1;
    });

    meta.textContent = q
        ? `${visibleCount} of ${rows.length} row(s) matched "${input.value.trim()}".`
        : `Showing all ${rows.length} row(s).`;
}

function setInsightsLoading(isLoading) {
    const loader = document.getElementById("insightLoader");
    const submitBtn = document.querySelector("#uploadForm button[type='submit']");
    if (!loader) return;

    loader.classList.toggle("show", !!isLoading);
    loader.setAttribute("aria-hidden", isLoading ? "false" : "true");

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
}

document.querySelectorAll(".sidebar-link[data-view]").forEach((link) => {
    link.addEventListener("click", (e) => {
        e.preventDefault();
        switchSidebarView(link.dataset.view);
    });
});

const auditSearchInput = document.getElementById("auditSearchInput");
if (auditSearchInput) {
    auditSearchInput.addEventListener("input", applyAuditFilter);
}

document.getElementById("uploadForm").addEventListener("submit", async function(e) {
    e.preventDefault();
    setInsightsLoading(true);

    try {
        const formData = new URLSearchParams(new FormData(this));
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

        document.getElementById("downloadPdf").style.display = "block";

        document.getElementById("summary-section").innerHTML = `
        <div class="row g-3 mb-4 text-center">
            <div class="col-md-3">
                <div class="p-4 bg-primary text-white rounded-4 shadow-sm">
                    <h2 class="display-6 fw-bold m-0">${data.overall_accuracy}%</h2>
                    <small class="text-uppercase fw-bold">Overall Accuracy</small>
                </div>
            </div>
            <div class="col-md-9 d-flex gap-2">
                <div class="flex-fill bg-white p-3 rounded-4 border"><b>Correct</b><br>${data.correct}</div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-warning"><b>Missed</b><br>${data.missed_count}</div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-danger"><b>Mismatch</b><br>${data.mismatch_count}</div>
                <div class="flex-fill bg-white p-3 rounded-4 border text-info"><b>Extra</b><br>${data.extra_count}</div>
            </div>
        </div>
        `;

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

        let logHtml = `
        <div class="comparison-header mt-5 mb-3">
            <h3 class="comparison-title m-0">Detailed String Comparison</h3>
            <span class="comparison-total">${data.mismatch_count || 0} mismatches</span>
        </div>
    `;
        if (!data.mismatched_details || data.mismatched_details.length === 0) {
        logHtml += `
            <div class="comparison-empty">
                <div class="comparison-empty-title">Perfect alignment</div>
                <div class="comparison-empty-sub">No mismatches found in this run.</div>
            </div>
        `;
        } else {
            data.mismatched_details.forEach((item, idx) => {
            const errors = Object.entries(item.errors || {});
            const goldText = escapeHtml(item.gold);
            const traineeText = escapeHtml(item.trainee);
            logHtml += `
                <article class="comparison-card mb-3">
                    <div class="comparison-card-head">
                        <span class="comparison-id">Mismatch #${idx + 1}</span>
                        <span class="comparison-meta">${errors.length} field${errors.length === 1 ? '' : 's'} differ</span>
                    </div>
                    <div class="comparison-grid">
                        <div class="comparison-side comparison-side-gold">
                            <div class="comparison-label">Gold Standard</div>
                            <pre class="comparison-string">${goldText}</pre>
                        </div>
                        <div class="comparison-side comparison-side-trainee">
                            <div class="comparison-label">Trainee Output</div>
                            <pre class="comparison-string">${traineeText}</pre>
                        </div>
                    </div>
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
                </article>`;
            });
        }

        document.getElementById("mismatch-section").innerHTML = logHtml;

        const rows = Array.isArray(data.alignment_rows) ? data.alignment_rows : [];
        latestAlignmentRows = rows;
        let auditHtml = `
        <div class="comparison-header mt-5 mb-3">
            <h3 class="comparison-title m-0">String Audit</h3>
            <span class="comparison-total">${rows.length} aligned rows</span>
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
            rows.forEach((row, idx) => {
            const status = row.status || 'matched';
            const goldText = escapeHtml(row.gold ?? '(none)');
            const traineeText = escapeHtml(row.trainee ?? '(none)');
            const errors = Object.entries(row.errors || {});

            auditHtml += `
                <article class="audit-card audit-${status} mb-3">
                    <div class="audit-head">
                        <span class="audit-index">Row #${idx + 1}</span>
                        <span class="audit-status">${status.toUpperCase()}</span>
                    </div>
                    <div class="comparison-grid">
                        <div class="comparison-side comparison-side-gold">
                            <div class="comparison-label">Gold</div>
                            <pre class="comparison-string">${goldText}</pre>
                        </div>
                        <div class="comparison-side comparison-side-trainee">
                            <div class="comparison-label">Trainee</div>
                            <pre class="comparison-string">${traineeText}</pre>
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
            });
        }

        document.getElementById("audit-section").innerHTML = auditHtml;
        applyAuditFilter();
    } catch (err) {
        alert("Unable to generate insights. Please try again.");
    } finally {
        setInsightsLoading(false);
    }
});

/* ---------- Charts ---------- */
function renderCharts(data) {
    Object.values(charts).forEach(c => c.destroy());

    Chart.register(ChartDataLabels);

    /* PIE CHART */
    charts.pie = new Chart(document.getElementById('pieChart'), {
        type: 'doughnut',
        data: {
            labels: ['Correct', 'Missed', 'Extra', 'Mismatch'],
            datasets: [{
                data: [
                    data.correct,
                    data.missed_count,
                    data.extra_count,
                    data.mismatch_count
                ],
                backgroundColor: [
                    '#22c55e',
                    '#f59e0b',
                    '#38bdf8',
                    '#f43f5e'
                ],
                borderWidth: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            cutout: '55%',
            layout: { padding: 10 },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#cbd5e1'
                    }
                },
                datalabels: {
                    color: '#fff',
                    anchor: 'center',
                    align: 'center',
                    formatter: (value, ctx) => {
                        const total = ctx.dataset.data.reduce((sum, n) => sum + n, 0);
                        if (!total || value === 0) return '';
                        const percent = (value / total) * 100;
                        return percent >= 4 ? `${percent.toFixed(1)}%` : '';
                    },
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            }
        }
    });

    const pieValues = [data.correct, data.missed_count, data.extra_count, data.mismatch_count];
    const pieLabels = ['Correct', 'Missed', 'Extra', 'Mismatch'];
    const pieTotal = pieValues.reduce((sum, n) => sum + n, 0);
    const breakdownHtml = pieLabels.map((label, i) => {
        const pct = pieTotal ? ((pieValues[i] / pieTotal) * 100).toFixed(1) : '0.0';
        return `<span class="mx-2"><b>${label}:</b> ${pct}%</span>`;
    }).join('');
    document.getElementById('pie-breakdown').innerHTML = breakdownHtml;

    /* BAR CHART */
    charts.bar = new Chart(document.getElementById('barChart'), {
        type: 'bar',
        data: {
            labels: Object.keys(data.field_errors || {}),
            datasets: [{
                label: 'Errors',
                data: Object.values(data.field_errors || {}),
                backgroundColor: '#fb7185',
                borderRadius: 8
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#cbd5e1'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.15)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.18)' }
                }
            }
        }
    });

    /* TIMELINE CHART */
    const timeline = data.timeline_chart || {};
    let labels = timeline.labels;
    let values = timeline.values;

    if (!Array.isArray(labels) || !Array.isArray(values) || labels.length !== values.length) {
        labels = ['0-5', '5-10', '10-15', '15-20', '20-25', '25-30'];
        values = [0, 0, 0, 0, 0, 0];
    }
    charts.timeline = new Chart(document.getElementById('timelineChart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Error Frequency',
                data: values,
                backgroundColor: '#0ea5e9',
                borderColor: '#38bdf8',
                borderWidth: 2
            }]
        },
        options: {
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#cbd5e1'
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.12)' }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(148, 163, 184, 0.18)' }
                }
            }
        }
    });

    /* ATTRIBUTE COMPARISON CHART */
    const attrComp = data.attribute_comparison || {};
    let attrLabels = Array.isArray(attrComp.labels) ? [...attrComp.labels] : [];
    let goldValues = Array.isArray(attrComp.gold_values) ? [...attrComp.gold_values] : [];
    let traineeValues = Array.isArray(attrComp.trainee_values) ? [...attrComp.trainee_values] : [];

    // Ensure key special attributes are always visible.
    const mustShowAttrs = ['CN', 'F', 'FK', 'GK'];
    const goldMap = new Map(attrLabels.map((l, i) => [l, goldValues[i] ?? 0]));
    const traineeMap = new Map(attrLabels.map((l, i) => [l, traineeValues[i] ?? 0]));
    mustShowAttrs.forEach((attr) => {
        if (!goldMap.has(attr)) {
            attrLabels.push(attr);
            goldMap.set(attr, 0);
            traineeMap.set(attr, 0);
        }
    });
    goldValues = attrLabels.map((l) => goldMap.get(l) ?? 0);
    traineeValues = attrLabels.map((l) => traineeMap.get(l) ?? 0);
    const attrDisplayLabels = attrLabels.map((code) => attributeLabel(code));

    if (attrLabels.length && goldValues.length === attrLabels.length && traineeValues.length === attrLabels.length) {
        charts.attributeComparison = new Chart(document.getElementById('attributeCompareChart'), {
            type: 'bar',
            data: {
                labels: attrDisplayLabels,
                datasets: [
                    {
                        label: 'Gold',
                        data: goldValues,
                        backgroundColor: '#6366f1',
                        borderColor: '#818cf8',
                        borderWidth: 1
                    },
                    {
                        label: 'Trainee (Valid only)',
                        data: traineeValues,
                        backgroundColor: '#f59e0b',
                        borderColor: '#fbbf24',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#cbd5e1' }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: '#94a3b8',
                            autoSkip: false,
                            maxRotation: 65,
                            minRotation: 65
                        },
                        grid: { color: 'rgba(148, 163, 184, 0.10)' }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(148, 163, 184, 0.16)' }
                    }
                }
            }
        });
    }

    const skippedParse = Number(data.trainee_count_skipped || 0);
    const skippedValid = Number(data.trainee_count_skipped_valid || 0);
    document.getElementById('attributeCompareMeta').innerHTML =
        `Counts use all parsed trainee strings. Parse-skipped: <b>${skippedParse}</b>, validation-invalid: <b>${skippedValid}</b>.`;

    /* MINI BAR CHARTS: ONE PER ATTRIBUTE */
    const barsGrid = document.getElementById('attributeBarsGrid');
    if (barsGrid && attrLabels.length && goldValues.length === attrLabels.length && traineeValues.length === attrLabels.length) {
        barsGrid.innerHTML = '';

        attrLabels.forEach((label, idx) => {
            const canvasId = `attrBar_${idx}`;
            const col = document.createElement('div');
            col.className = 'col-12 col-sm-6 col-lg-4 col-xl-3';
            col.innerHTML = `
                <div class="p-3 rounded-4 border h-100 attribute-mini-card" role="button" tabindex="0" aria-label="Open ${attributeLabel(label)} count details">
                    <div class="fw-bold mb-2 text-center">${attributeLabel(label)}</div>
                    <div style="height: 210px;">
                        <canvas id="${canvasId}"></canvas>
                    </div>
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

            charts[`attribute_${label}_${idx}`] = new Chart(document.getElementById(canvasId), {
                type: 'bar',
                data: {
                    labels: ['Gold', 'Trainee'],
                    datasets: [{
                        data: [goldValues[idx], traineeValues[idx]],
                        backgroundColor: ['#6366f1', '#f59e0b'],
                        borderColor: ['#818cf8', '#fbbf24'],
                        borderWidth: 1,
                        borderRadius: 6
                    }]
                },
                options: {
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#eaf2ff',
                            anchor: 'end',
                            align: 'end',
                            offset: -2,
                            clamp: true,
                            clip: false,
                            font: {
                                size: 12,
                                weight: '700'
                            },
                            formatter: (value) => `${Number(value || 0)}`
                        }
                    },
                    scales: {
                        x: {
                            ticks: {
                                color: '#cfe0ff',
                                font: {
                                    size: 12,
                                    weight: '700'
                                }
                            },
                            grid: { display: false }
                        },
                        y: {
                            beginAtZero: true,
                            grace: '18%',
                            ticks: {
                                color: '#dbe7fb',
                                precision: 0,
                                font: {
                                    size: 11,
                                    weight: '600'
                                }
                            },
                            grid: { color: 'rgba(148, 163, 184, 0.14)' }
                        }
                    }
                }
            });
        });
    } else if (barsGrid) {
        barsGrid.innerHTML = '<div class="col-12 text-center small">No attribute comparison data available.</div>';
    }
}

/* ---------- PDF Export ---------- */
document.getElementById("downloadPdf").addEventListener("click", async function() {
    const { jsPDF } = window.jspdf;
    const canvas = await html2canvas(document.getElementById('printable-content'), { scale: 2 });
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save("StepOut_Evaluation.pdf");
});



/*
 * Evaluation submission, summary rendering, and insight drilldowns
 */

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
renderProgressReportSection();
loadTrainees();

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
    const currentTraineeId = traineeSelect ? traineeSelect.value : selectedTraineeId;
    setSelectedTrainee(currentTraineeId, { fetchReport: false });
    setInsightsLoading(true);

    try {
        const formData = new FormData(this);
        if (currentTraineeId && !isLocalTraineeId(currentTraineeId)) {
            formData.set("trainee_id", currentTraineeId);
        } else {
            formData.delete("trainee_id");
        }
        const data = await parseApiResponse(
            await fetch("/evaluate", { method: "POST", body: formData }),
            "Evaluation failed."
        );
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

        const downloadPdfBtn = document.getElementById("downloadPdf");
        if (downloadPdfBtn) {
            downloadPdfBtn.disabled = false;
        }

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
        latestEvaluationData = data;
        latestMismatchRows = Array.isArray(data.mismatched_details) ? data.mismatched_details : [];
        latestAlignmentRows = Array.isArray(data.alignment_rows) ? data.alignment_rows : [];
        mismatchPage = 1;
        auditPage = 1;
        lastMismatchQuery = document.getElementById("checkerSearchInput")?.value.trim() || "";
        lastAuditQuery = document.getElementById("auditSearchInput")?.value.trim() || "";
        if (activeView === "string-checker") {
            renderMismatchSection();
        } else if (activeView === "string-audit") {
            renderAuditSection();
        } else if (activeView === "attribute-explorer") {
            renderAttributeExplorerSection();
        } else if (activeView === "progress-report") {
            renderProgressReportSection();
        }
        await loadTrainees(currentTraineeId || "");
        animateEvaluationRender();
    } catch (err) {
        alert(err.message || "Unable to generate insights. Please try again.");
    } finally {
        setInsightsLoading(false);
    }
});

/* ---------- Charts (ECharts) ---------- */

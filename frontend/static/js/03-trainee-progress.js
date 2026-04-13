/*
 * Trainee directory, selection, and progress report rendering
 */

function updateTraineeQuickSummary() {
    const summaryNode = document.getElementById("traineeQuickSummary");
    if (!summaryNode) return;

    const selected = traineeDirectory.find((item) => String(item.id) === String(selectedTraineeId));
    if (!selected) {
        summaryNode.innerHTML = `
            <div class="trainee-selector-summary-kicker">History Status</div>
            <div class="trainee-selector-summary-main">No trainee selected</div>
            <div class="trainee-selector-summary-sub">Choose or create a trainee to start storing progress data.</div>
        `;
        return;
    }

    const latestAccuracy = selected.latest_accuracy === null || selected.latest_accuracy === undefined
        ? "No runs yet"
        : `${Number(selected.latest_accuracy).toFixed(2)}% latest accuracy`;
    summaryNode.innerHTML = `
        <div class="trainee-selector-summary-kicker">History Status</div>
        <div class="trainee-selector-summary-main">${escapeHtml(selected.name)}</div>
        <div class="trainee-selector-summary-sub">${Number(selected.run_count || 0).toLocaleString()} saved run(s) - ${escapeHtml(latestAccuracy)}</div>
    `;
}

function populateTraineeSelects() {
    const selects = [
        document.getElementById("traineeSelect"),
        document.getElementById("progressTraineeSelect"),
    ].filter(Boolean);

    selects.forEach((select) => {
        const placeholder = select.id === "progressTraineeSelect"
            ? "Select trainee report"
            : "Select trainee analyst";
        const currentValue = selectedTraineeId;
        select.innerHTML = `<option value="">${placeholder}</option>`;
        traineeDirectory.forEach((trainee) => {
            const option = document.createElement("option");
            option.value = String(trainee.id);
            option.textContent = trainee.run_count
                ? `${trainee.name} - ${trainee.run_count} run${trainee.run_count === 1 ? "" : "s"}`
                : `${trainee.name} - New`;
            select.appendChild(option);
        });
        select.value = currentValue && traineeDirectory.some((item) => String(item.id) === String(currentValue))
            ? String(currentValue)
            : "";
    });

    updateTraineeQuickSummary();
}

function setSelectedTrainee(traineeId, options = {}) {
    const { persist = true, fetchReport = false } = options;
    selectedTraineeId = traineeId ? String(traineeId) : "";

    try {
        if (persist) {
            if (selectedTraineeId) {
                localStorage.setItem(STORAGE_KEYS.traineeId, selectedTraineeId);
            } else {
                localStorage.removeItem(STORAGE_KEYS.traineeId);
            }
        }
    } catch (err) {
        // Ignore storage access errors silently.
    }

    populateTraineeSelects();

    if (!selectedTraineeId) {
        latestProgressReport = null;
        renderProgressReportSection();
        return;
    }

    if (fetchReport) {
        fetchProgressReport(selectedTraineeId, { silent: activeView !== "progress-report" });
    }
}

async function loadTrainees(preferredTraineeId = "") {
    try {
        const payload = await parseApiResponse(await fetch("/api/trainees"), "Unable to load trainee list.");
        traineeDirectory = Array.isArray(payload.trainees) ? payload.trainees : [];
        const storedTraineeId = (() => {
            try {
                return localStorage.getItem(STORAGE_KEYS.traineeId) || "";
            } catch (err) {
                return "";
            }
        })();
        const nextTraineeId = preferredTraineeId || selectedTraineeId || storedTraineeId;
        if (nextTraineeId && traineeDirectory.some((item) => String(item.id) === String(nextTraineeId))) {
            selectedTraineeId = String(nextTraineeId);
        } else {
            selectedTraineeId = "";
        }
        populateTraineeSelects();

        if (selectedTraineeId) {
            await fetchProgressReport(selectedTraineeId, { silent: true });
        } else {
            renderProgressReportSection();
        }
    } catch (error) {
        console.error(error);
    }
}

async function createTraineeFromPrompt() {
    showTraineeCreateModal();
}

function renderProgressReportSection() {
    const target = document.getElementById("progressReportContent");
    if (!target) return;

    if (charts.progressTrend) {
        try {
            charts.progressTrend.dispose();
        } catch (error) {
            // Ignore disposed chart instances.
        }
        delete charts.progressTrend;
    }

    if (!selectedTraineeId) {
        target.innerHTML = `
            <div class="progress-report-empty">
                <div class="progress-report-empty-title">No trainee selected</div>
                <div class="progress-report-empty-sub">Select a trainee to load saved runs and generated progress insights.</div>
            </div>
        `;
        return;
    }

    const report = latestProgressReport;
    if (!report || !report.trainee) {
        target.innerHTML = `
            <div class="progress-report-empty">
                <div class="progress-report-empty-title">No saved runs yet</div>
                <div class="progress-report-empty-sub">The selected trainee does not have any stored evaluations yet. Run one evaluation to start the history.</div>
            </div>
        `;
        return;
    }

    const overview = report.overview || {};
    const aiReport = report.ai_report || {};
    const history = Array.isArray(report.history) ? report.history : [];
    const latestGaps = Array.isArray(report.latest_attribute_gaps) ? report.latest_attribute_gaps : [];
    if (!history.length) {
        target.innerHTML = `
            <div class="progress-report-empty">
                <div class="progress-report-empty-title">No saved runs yet</div>
                <div class="progress-report-empty-sub">${escapeHtml(report.trainee.name || "This trainee")} has been created, but no evaluation has been saved yet. Run one evaluation to start the report history.</div>
            </div>
        `;
        return;
    }
    const deltaValue = overview.accuracy_delta;
    const deltaLabel = deltaValue === null || deltaValue === undefined
        ? "First saved benchmark"
        : deltaValue > 0
            ? `+${Number(deltaValue).toFixed(2)} pts vs previous`
            : `${Number(deltaValue).toFixed(2)} pts vs previous`;

    const gapRows = latestGaps.length
        ? latestGaps.map((gap) => `
            <tr>
                <td>${escapeHtml(attributeLabel(gap.attribute))}</td>
                <td>${Number(gap.gold_count || 0)}</td>
                <td>${Number(gap.trainee_count || 0)}</td>
                <td class="${Number(gap.delta || 0) === 0 ? "is-balanced" : Number(gap.delta || 0) > 0 ? "is-over" : "is-under"}">
                    ${Number(gap.delta || 0) > 0 ? "+" : ""}${Number(gap.delta || 0)}
                </td>
            </tr>
        `).join("")
        : `<tr><td colspan="4">No attribute gap data yet.</td></tr>`;

    const historyRows = history.length
        ? history.map((run) => `
            <tr>
                <td>Run ${Number(run.sequence || 0)}</td>
                <td>${escapeHtml(formatDateTimeLabel(run.created_at))}</td>
                <td>${Number(run.overall_accuracy || 0).toFixed(2)}%</td>
                <td>${Number(run.correct_count || 0)}</td>
                <td>${Number(run.mismatch_count || 0)}</td>
                <td>${Number(run.missed_count || 0)}</td>
                <td>${Number(run.extra_count || 0)}</td>
                <td>${escapeHtml(run.top_error_attribute || "N/A")}</td>
            </tr>
        `).join("")
        : `<tr><td colspan="8">No history available yet.</td></tr>`;

    target.innerHTML = `
        <div class="progress-report-grid">
            <article class="progress-overview-card progress-overview-card--primary">
                <span class="progress-overview-label">Latest Accuracy</span>
                <strong>${Number(overview.latest_accuracy || 0).toFixed(2)}%</strong>
                <span class="progress-overview-sub">${escapeHtml(deltaLabel)}</span>
            </article>
            <article class="progress-overview-card">
                <span class="progress-overview-label">Average Accuracy</span>
                <strong>${Number(overview.average_accuracy || 0).toFixed(2)}%</strong>
                <span class="progress-overview-sub">${Number(overview.total_runs || 0).toLocaleString()} saved run(s)</span>
            </article>
            <article class="progress-overview-card">
                <span class="progress-overview-label">Best Accuracy</span>
                <strong>${Number(overview.best_accuracy || 0).toFixed(2)}%</strong>
                <span class="progress-overview-sub">Latest run: ${escapeHtml(formatDateTimeLabel(overview.latest_run_at))}</span>
            </article>
            <article class="progress-overview-card">
                <span class="progress-overview-label">Latest Mismatches</span>
                <strong>${Number(overview.latest_mismatch_count || 0).toLocaleString()}</strong>
                <span class="progress-overview-sub">Current saved run pressure</span>
            </article>
        </div>
        <div class="progress-report-board">
            <article class="progress-report-card progress-report-card--chart">
                <div class="progress-report-card-head">
                    <div>
                        <div class="progress-report-kicker">Progress Trend</div>
                        <h4 class="progress-report-card-title">${escapeHtml(report.trainee.name || "Trainee")} Accuracy History</h4>
                    </div>
                </div>
                <div id="progressTrendChart" class="progress-trend-chart"></div>
            </article>
            <article class="progress-report-card progress-report-card--ai">
                <div class="progress-report-card-head">
                    <div>
                        <div class="progress-report-kicker">AI Report</div>
                        <h4 class="progress-report-card-title">${escapeHtml(aiReport.title || "Progress readout")}</h4>
                    </div>
                </div>
                <p class="progress-report-ai-summary">${escapeHtml(aiReport.summary || "No generated summary yet.")}</p>
                <ul class="progress-report-ai-list">
                    ${(Array.isArray(aiReport.bullets) ? aiReport.bullets : []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
                </ul>
            </article>
        </div>
        <div class="progress-report-detail-grid">
            <article class="progress-report-card">
                <div class="progress-report-card-head">
                    <div>
                        <div class="progress-report-kicker">Current Run Gaps</div>
                        <h4 class="progress-report-card-title">Largest Attribute Differences</h4>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm mb-0 progress-history-table">
                        <thead>
                            <tr>
                                <th>Attribute</th>
                                <th>Gold</th>
                                <th>Trainee</th>
                                <th>Delta</th>
                            </tr>
                        </thead>
                        <tbody>${gapRows}</tbody>
                    </table>
                </div>
            </article>
            <article class="progress-report-card">
                <div class="progress-report-card-head">
                    <div>
                        <div class="progress-report-kicker">Run History</div>
                        <h4 class="progress-report-card-title">Saved Evaluations</h4>
                    </div>
                </div>
                <div class="table-responsive">
                    <table class="table table-sm mb-0 progress-history-table">
                        <thead>
                            <tr>
                                <th>Run</th>
                                <th>Date</th>
                                <th>Accuracy</th>
                                <th>Correct</th>
                                <th>Mismatch</th>
                                <th>Missed</th>
                                <th>Extra</th>
                                <th>Top Error</th>
                            </tr>
                        </thead>
                        <tbody>${historyRows}</tbody>
                    </table>
                </div>
            </article>
        </div>
    `;

    renderProgressTrendChart(report);
}

function renderProgressTrendChart(report) {
    const chartNode = document.getElementById("progressTrendChart");
    if (!chartNode || !report) return;

    if (charts.progressTrend) {
        try {
            charts.progressTrend.dispose();
        } catch (error) {
            // Ignore disposed chart instances.
        }
        delete charts.progressTrend;
    }

    const labels = Array.isArray(report.accuracy_trend?.labels) ? report.accuracy_trend.labels : [];
    const values = Array.isArray(report.accuracy_trend?.values) ? report.accuracy_trend.values : [];
    if (!labels.length) return;

    const EC = getChartTheme();
    const progressChart = echarts.init(chartNode, null, { renderer: "canvas" });
    charts.progressTrend = progressChart;
    progressChart.setOption({
        backgroundColor: "transparent",
        tooltip: {
            trigger: "axis",
            axisPointer: { type: "line" },
            ...EC.tooltip,
            formatter: (points) => {
                const point = Array.isArray(points) ? points[0] : points;
                return `<b>${escapeHtml(point.axisValue || "")}</b><br/>Accuracy: <b>${Number(point.value || 0).toFixed(2)}%</b>`;
            }
        },
        grid: { left: 18, right: 20, top: 24, bottom: 28, containLabel: true },
        xAxis: {
            type: "category",
            data: labels,
            axisLabel: { color: EC.mutedColor, fontSize: 11 },
            axisLine: { lineStyle: { color: EC.axisLineColor } },
        },
        yAxis: {
            type: "value",
            min: 0,
            max: 100,
            axisLabel: {
                color: EC.mutedColor,
                fontSize: 11,
                formatter: (value) => `${value}%`
            },
            splitLine: { lineStyle: { color: EC.gridLine } }
        },
        series: [{
            type: "line",
            data: values,
            smooth: true,
            symbol: "circle",
            symbolSize: 9,
            lineStyle: { width: 3, color: "#6283f1" },
            itemStyle: { color: "#f0b356", borderColor: "#ffffff", borderWidth: 1.5 },
            areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: "rgba(98, 131, 241, 0.35)" },
                    { offset: 1, color: "rgba(98, 131, 241, 0.04)" }
                ])
            }
        }],
        animationDuration: 820,
        animationEasing: "cubicOut"
    });
}

async function fetchProgressReport(traineeId, options = {}) {
    const { silent = false } = options;
    if (!traineeId) {
        latestProgressReport = null;
        renderProgressReportSection();
        return;
    }

    try {
        const payload = await parseApiResponse(
            await fetch(`/api/trainees/${encodeURIComponent(traineeId)}/progress`),
            "Unable to load trainee progress report."
        );
        latestProgressReport = payload;
        renderProgressReportSection();
        if (!silent && activeView === "progress-report") {
            animateSidebarView("progress-report");
        }
    } catch (error) {
        latestProgressReport = null;
        renderProgressReportSection();
        if (!silent) {
            alert(error.message || "Unable to load trainee progress report.");
        }
    }
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

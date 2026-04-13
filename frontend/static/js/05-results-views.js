/*
 * Navigation, animations, search, pagination, and result views
 */

function switchSidebarView(viewName) {
    const homeView = document.getElementById("homeView");
    const checkerView = document.getElementById("stringCheckerView");
    const auditView = document.getElementById("stringAuditView");
    const explorerView = document.getElementById("attributeExplorerView");
    const progressView = document.getElementById("progressReportView");
    if (!homeView || !checkerView || !auditView || !explorerView || !progressView) return;

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
        progressView.style.display = "none";
    } else if (viewName === "string-audit") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "block";
        explorerView.style.display = "none";
        progressView.style.display = "none";
    } else if (viewName === "attribute-explorer") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "none";
        explorerView.style.display = "block";
        progressView.style.display = "none";
    } else if (viewName === "progress-report") {
        homeView.style.display = "none";
        checkerView.style.display = "none";
        auditView.style.display = "none";
        explorerView.style.display = "none";
        progressView.style.display = "block";
    } else {
        homeView.style.display = "block";
        checkerView.style.display = "none";
        auditView.style.display = "none";
        explorerView.style.display = "none";
        progressView.style.display = "none";
    }

    activeView = viewName;
    if (viewName === "string-checker") {
        renderMismatchSection();
    } else if (viewName === "string-audit") {
        renderAuditSection();
    } else if (viewName === "attribute-explorer") {
        renderAttributeExplorerSection();
    } else if (viewName === "progress-report") {
        renderProgressReportSection();
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
    if (viewName === "progress-report") {
        animateStaggered("#progressReportView .progress-overview-card, #progressReportView .progress-report-card, #progressReportView .progress-report-toolbar", 0, 18, 560, 0.98);
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
    animateStaggered("#progressReportView .progress-overview-card, #progressReportView .progress-report-card, #progressReportView .progress-report-toolbar", 380, 18, 620, 0.98);
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

function paginateRows(rows, requestedPage) {
    const totalRows = Array.isArray(rows) ? rows.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalRows / RESULTS_PAGE_SIZE));
    const page = Math.min(Math.max(1, Number(requestedPage) || 1), totalPages);
    const startIndex = totalRows ? (page - 1) * RESULTS_PAGE_SIZE : 0;
    const endIndex = totalRows ? Math.min(startIndex + RESULTS_PAGE_SIZE, totalRows) : 0;
    return {
        page,
        totalPages,
        totalRows,
        startIndex,
        endIndex,
        rows: totalRows ? rows.slice(startIndex, endIndex) : []
    };
}

function buildPaginationHtml(kind, pagination) {
    if (!pagination || pagination.totalPages <= 1) {
        return "";
    }

    return `
        <div class="list-pagination">
            <div class="list-pagination-meta">
                Showing ${pagination.startIndex + 1}-${pagination.endIndex} of ${pagination.totalRows || pagination.endIndex} rows
            </div>
            <div class="list-pagination-actions">
                <button type="button" class="list-pagination-btn" data-page-target="${kind}" data-page-action="prev" ${pagination.page <= 1 ? "disabled" : ""}>Previous</button>
                <span class="list-pagination-state">Page ${pagination.page} of ${pagination.totalPages}</span>
                <button type="button" class="list-pagination-btn" data-page-target="${kind}" data-page-action="next" ${pagination.page >= pagination.totalPages ? "disabled" : ""}>Next</button>
            </div>
        </div>
    `;
}

function bindPaginationControls(kind, pagination) {
    if (!pagination || pagination.totalPages <= 1) {
        return;
    }

    document.querySelectorAll(`[data-page-target="${kind}"]`).forEach((button) => {
        button.addEventListener("click", () => {
            const direction = button.getAttribute("data-page-action");
            if (kind === "mismatch") {
                mismatchPage = direction === "next" ? pagination.page + 1 : pagination.page - 1;
                renderMismatchSection();
                return;
            }

            auditPage = direction === "next" ? pagination.page + 1 : pagination.page - 1;
            renderAuditSection();
        });
    });
}

function renderMismatchSection() {
    const container = document.getElementById("mismatch-section");
    const input = document.getElementById("checkerSearchInput");
    const meta = document.getElementById("checkerSearchMeta");
    if (!container || !input || !meta) return;

    const query = input.value.trim();
    const terms = getSearchTerms(query);
    const rows = Array.isArray(latestMismatchRows) ? latestMismatchRows : [];
    if (query !== lastMismatchQuery) {
        mismatchPage = 1;
        lastMismatchQuery = query;
    }
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
    const pagination = paginateRows(orderedRows, mismatchPage);
    mismatchPage = pagination.page;

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
        logHtml += `
            ${buildPaginationHtml("mismatch", pagination)}
            <div id="mismatchRowsHost"></div>
            ${buildPaginationHtml("mismatch", pagination)}
        `;
    }

    container.innerHTML = logHtml;
    if (rows.length) {
        const host = document.getElementById("mismatchRowsHost");
        appendHtmlInChunks(
            host,
            pagination.rows,
            ({ item, index, searchMatched }) => buildMismatchCardHtml(item, index, terms, query, searchMatched),
            () => mismatchRenderToken,
            token
        );
        bindPaginationControls("mismatch", pagination);
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
    if (query !== lastAuditQuery) {
        auditPage = 1;
        lastAuditQuery = query;
    }
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
    const pagination = paginateRows(orderedRows, auditPage);
    auditPage = pagination.page;

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
        auditHtml += `
            ${buildPaginationHtml("audit", pagination)}
            <div id="auditRowsHost"></div>
            ${buildPaginationHtml("audit", pagination)}
        `;
    }

    container.innerHTML = auditHtml;
    if (rows.length) {
        const host = document.getElementById("auditRowsHost");
        appendHtmlInChunks(
            host,
            pagination.rows,
            ({ row, index, searchMatched }) => buildAuditCardHtml(row, index, terms, query, searchMatched),
            () => auditRenderToken,
            token
        );
        bindPaginationControls("audit", pagination);
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


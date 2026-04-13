/*
 * Attribute count modal and local input persistence
 */

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


/*
 * DOM references, modal controls, and shell-level event wiring
 */

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
const traineeCreateModal = document.getElementById("traineeCreateModal");
const traineeCreateModalClose = document.getElementById("traineeCreateModalClose");
const traineeCreateCancel = document.getElementById("traineeCreateCancel");
const traineeCreateConfirm = document.getElementById("traineeCreateConfirm");
const traineeNameInput = document.getElementById("traineeNameInput");
const traineeCreateError = document.getElementById("traineeCreateError");
const themeToggle = document.getElementById("themeToggle");
const traineeSelect = document.getElementById("traineeSelect");
const addTraineeBtn = document.getElementById("addTraineeBtn");
const progressTraineeSelect = document.getElementById("progressTraineeSelect");
const refreshProgressReportBtn = document.getElementById("refreshProgressReport");
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

function resetTraineeCreateState() {
    if (traineeCreateError) {
        traineeCreateError.hidden = true;
        traineeCreateError.textContent = "";
    }
    if (traineeNameInput) {
        traineeNameInput.removeAttribute("aria-invalid");
    }
    if (traineeCreateConfirm) {
        traineeCreateConfirm.disabled = false;
        traineeCreateConfirm.textContent = "Create Trainee";
    }
}

function showTraineeCreateError(message) {
    if (!traineeCreateError) return;
    traineeCreateError.hidden = false;
    traineeCreateError.textContent = message;
    if (traineeNameInput) {
        traineeNameInput.setAttribute("aria-invalid", "true");
        traineeNameInput.focus();
        traineeNameInput.select();
    }
}

function hideTraineeCreateModal() {
    if (!traineeCreateModal) return;

    const finalizeHide = () => {
        traineeCreateModal.classList.remove("show");
        traineeCreateModal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
        traineeCreateModal.style.opacity = "";
        const card = traineeCreateModal.querySelector(".trainee-create-modal-card");
        if (card) {
            card.style.opacity = "";
            card.style.transform = "";
        }
        resetTraineeCreateState();
    };

    if (!MOTION_ENABLED || !traineeCreateModal.classList.contains("show")) {
        finalizeHide();
        return;
    }

    const card = traineeCreateModal.querySelector(".trainee-create-modal-card");
    motionRun({
        targets: traineeCreateModal,
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

function showTraineeCreateModal() {
    if (!traineeCreateModal) return;

    resetTraineeCreateState();
    if (traineeNameInput) {
        const prefill = traineeSelect && traineeSelect.options[traineeSelect.selectedIndex]
            ? traineeSelect.options[traineeSelect.selectedIndex].textContent.split(" - ")[0]
            : "";
        traineeNameInput.value = selectedTraineeId && prefill && prefill !== "Select trainee analyst"
            ? prefill
            : "";
    }
    traineeCreateModal.classList.add("show");
    traineeCreateModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");

    const focusInput = () => {
        if (traineeNameInput) {
            traineeNameInput.focus();
            traineeNameInput.select();
        }
    };

    if (!MOTION_ENABLED) {
        focusInput();
        return;
    }

    const card = traineeCreateModal.querySelector(".trainee-create-modal-card");
    motionRun({
        targets: traineeCreateModal,
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

async function submitTraineeCreateModal() {
    const submitName = traineeNameInput ? traineeNameInput.value.trim() : "";
    if (!submitName) {
        showTraineeCreateError("Enter a trainee analyst name before creating the profile.");
        return;
    }

    resetTraineeCreateState();
    if (traineeCreateConfirm) {
        traineeCreateConfirm.disabled = true;
        traineeCreateConfirm.textContent = "Creating...";
    }

    try {
        const payload = await parseApiResponse(
            await fetch("/api/trainees", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: submitName })
            }),
            "Unable to create trainee."
        );
        const createdTrainee = payload.trainee || null;
        await loadTrainees(createdTrainee ? String(createdTrainee.id) : "");
        if (createdTrainee) {
            setSelectedTrainee(createdTrainee.id, { fetchReport: true });
        }
        hideTraineeCreateModal();
    } catch (error) {
        showTraineeCreateError(error.message || "Unable to create trainee.");
        if (traineeCreateConfirm) {
            traineeCreateConfirm.disabled = false;
            traineeCreateConfirm.textContent = "Create Trainee";
        }
    }
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
if (traineeCreateModalClose) {
    traineeCreateModalClose.addEventListener("click", hideTraineeCreateModal);
}
if (traineeCreateCancel) {
    traineeCreateCancel.addEventListener("click", hideTraineeCreateModal);
}
if (traineeCreateModal) {
    traineeCreateModal.addEventListener("click", (event) => {
        if (event.target === traineeCreateModal) {
            hideTraineeCreateModal();
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
if (traineeNameInput) {
    traineeNameInput.addEventListener("input", () => {
        if (!traineeCreateError?.hidden) {
            resetTraineeCreateState();
        }
    });
    traineeNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submitTraineeCreateModal();
        }
        if (event.key === "Escape") {
            event.preventDefault();
            hideTraineeCreateModal();
        }
    });
}
if (traineeCreateConfirm) {
    traineeCreateConfirm.addEventListener("click", submitTraineeCreateModal);
}
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (traineeCreateModal?.classList.contains("show")) {
        hideTraineeCreateModal();
        return;
    }
    if (exportNameModal?.classList.contains("show")) {
        hideExportNameModal();
        return;
    }
    if (attributeCountModal?.classList.contains("show")) {
        hideAttributeCountModal();
    }
});
updateExportFilenamePreview();
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        animateTapFeedback(themeToggle, 0.985);
        toggleTheme();
    });
}
if (traineeSelect) {
    traineeSelect.addEventListener("change", (event) => {
        setSelectedTrainee(event.target.value, { fetchReport: true });
    });
}
if (progressTraineeSelect) {
    progressTraineeSelect.addEventListener("change", (event) => {
        setSelectedTrainee(event.target.value, { fetchReport: true });
    });
}
if (addTraineeBtn) {
    addTraineeBtn.addEventListener("click", () => {
        createTraineeFromPrompt();
    });
}
if (refreshProgressReportBtn) {
    refreshProgressReportBtn.addEventListener("click", () => {
        if (!selectedTraineeId) {
            alert("Select a trainee first.");
            return;
        }
        fetchProgressReport(selectedTraineeId);
    });
}
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        hideAttributeCountModal();
        hideExportNameModal();
    }
});

const container = document.createElement("div");
container.id = "fxToasts";
container.setAttribute("aria-live", "polite");
container.setAttribute("aria-atomic", "false");
document.body.append(container);

function show(message, type = "info", duration = 3200) {
    const toast = document.createElement("div");
    toast.className = `fx-toast fx-toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = String(message);
    container.append(toast);
    while (container.children.length > 4) container.firstElementChild.remove();
    requestAnimationFrame(() => toast.classList.add("visible"));
    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        toast.classList.remove("visible");
        toast.addEventListener("transitionend", () => toast.remove(), { once: true });
        setTimeout(() => toast.remove(), 250);
    };
    toast.addEventListener("click", dismiss, { once: true });
    if (duration > 0) setTimeout(dismiss, duration);
    return toast;
}

function showAfterReload(message, type = "info") {
    sessionStorage.setItem("fx_pending_toast", JSON.stringify({ message, type }));
}

function confirmAction(message, options = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "fx-confirm-overlay";
        const dialog = document.createElement("div");
        dialog.className = "fx-confirm";
        dialog.setAttribute("role", "alertdialog");
        dialog.setAttribute("aria-modal", "true");
        const text = document.createElement("p");
        text.textContent = message;
        const actions = document.createElement("div");
        actions.className = "fx-confirm-actions";
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = options.cancelLabel || "Cancel";
        const accept = document.createElement("button");
        accept.type = "button";
        accept.textContent = options.confirmLabel || "Confirm";
        if (options.danger) accept.className = "danger";
        actions.append(cancel, accept);
        dialog.append(text, actions);
        overlay.append(dialog);
        document.body.append(overlay);

        const finish = (answer) => {
            document.removeEventListener("keydown", onKeyDown, true);
            overlay.remove();
            resolve(answer);
        };
        const onKeyDown = (event) => {
            if (event.key === "Escape") finish(false);
            if (event.key === "Tab") {
                event.preventDefault();
                (document.activeElement === cancel ? accept : cancel).focus();
            }
        };
        document.addEventListener("keydown", onKeyDown, true);
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) finish(false);
        });
        cancel.addEventListener("click", () => finish(false));
        accept.addEventListener("click", () => finish(true));
        cancel.focus();
    });
}

try {
    const pending = JSON.parse(sessionStorage.getItem("fx_pending_toast"));
    sessionStorage.removeItem("fx_pending_toast");
    if (pending?.message) queueMicrotask(() => show(pending.message, pending.type));
} catch (error) {
    sessionStorage.removeItem("fx_pending_toast");
}

export default { show, showAfterReload, confirm: confirmAction };

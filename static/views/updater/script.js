/** @type {HTMLDialogElement} */
const updateDialog = document.getElementById("update-dialog");
/** @type {HTMLDialogElement} */
const installingDialog = document.getElementById("installing-dialog");
/** @type {HTMLProgressElement} */
const downloadProgress = document.getElementById("download-progress");
/** @type {HTMLElement} */
const errorText = document.getElementById("error");

// wire the safe buttons FIRST so the window is never dead — even if the
// update metadata below fails to load
document.getElementById("later-button").addEventListener("click", () => VesktopUpdaterNative.snoozeUpdate());
document.getElementById("ignore-button").addEventListener("click", () => {
    const confirmed = confirm(
        "Are you sure you want to ignore this update? You will not be notified about this update again. Updates are important for security and stability."
    );
    if (confirmed) VesktopUpdaterNative.ignoreUpdate();
});

let data;
try {
    data = await VesktopUpdaterNative.getData();
} catch (e) {
    console.error("Failed to load update metadata:", e);
}

const updateButton = document.getElementById("update-button");

if (!data) {
    // metadata never arrived: leave the version fields blank, disable
    // installing, and let the user dismiss the window
    document.getElementById("new-version").textContent = "unknown";
    updateButton.disabled = true;
    updateButton.style.opacity = "0.5";
    updateButton.title = "Update information could not be loaded";
} else {
    const { update, version: currentVersion } = data;

    document.getElementById("current-version").textContent = currentVersion;
    document.getElementById("new-version").textContent = update.version;
    updateButton.addEventListener("click", () => {
        downloadProgress.value = 0;
        errorText.textContent = "";

        if (navigator.platform.startsWith("Linux")) {
            document.getElementById("linux-note").classList.remove("hidden");
        }

        updateDialog.showModal();

        VesktopUpdaterNative.installUpdate().then(() => {
            downloadProgress.value = 100;
            updateDialog.closedBy = "any";

            installingDialog.showModal();
            updateDialog.classList.add("hidden");
        });
    });

    try {
        document.getElementById("release-notes").innerHTML = update.releaseNotes
            .map(
                ({ version, note: html }) => `
                    <section>
                        <h3>Version ${version}</h3>
                        <div>${html.replace(/<\/?h([1-3])/g, (m, level) => m.replace(level, Number(level) + 3))}</div>
                    </section>
                `
            )
            .join("\n");

        document.querySelectorAll("#release-notes a").forEach(a => {
            a.target = "_blank";
        });

        // remove useless headings
        document.querySelectorAll("#release-notes h3, #release-notes h4, #release-notes h5, #release-notes h6").forEach(h => {
            if (h.textContent.trim().toLowerCase() === "what's changed") {
                h.remove();
            }
        });
    } catch (e) {
        console.error("Failed to render release notes:", e);
    }
}

VesktopUpdaterNative.onProgress(percent => (downloadProgress.value = percent));
VesktopUpdaterNative.onError(message => {
    updateDialog.closedBy = "any";
    errorText.textContent = `An error occurred while downloading the update: ${message}`;
    installingDialog.close();
    updateDialog.classList.remove("hidden");
});

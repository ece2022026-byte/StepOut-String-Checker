const SCRIPT_FILES = [
  'js/01-core.js',
  'js/02-attribute-modal.js',
  'js/03-trainee-progress.js',
  'js/04-shell.js',
  'js/05-results-views.js',
  'js/06-evaluation-flow.js',
  'js/07-charts.js',
  'js/08-pdf-export.js'
];

function loadScriptSequentially(relativePath) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL(relativePath, import.meta.url).href;
    script.async = false;
    script.defer = false;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${relativePath}`));
    document.head.appendChild(script);
  });
}

if (!window.__stepoutAppBootPromise) {
  window.__stepoutAppBootPromise = (async () => {
    for (const file of SCRIPT_FILES) {
      await loadScriptSequentially(file);
    }
  })();
}

await window.__stepoutAppBootPromise;

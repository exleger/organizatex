function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function downloadStatement() {
  const header = [
    'Fecha', 'ID de ingreso', 'Tipo de movimiento', 'Apartado', 'Fuente',
    'Cliente o pasajero', 'Descripción', 'Ingreso bruto COP',
    'Costos COP', 'Ganancia neta COP', 'Destino',
    'Valor repartido COP', 'Saldo pendiente COP'
  ];
  const rows = [header];
  const orderedEntries = [...data.entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const entry of orderedEntries) {
    const allocations = [
      ...(entry.allocations || []).map(item => ({ name: item.name, amount: Number(item.amount) || 0 })),
      ...data.distributions.filter(item => item.entryId === entry.id).map(item => ({ name: item.name, amount: Number(item.amount) || 0 }))
    ];
    const allocated = allocations.reduce((sum, item) => sum + item.amount, 0);
    rows.push([
      entry.date, entry.id, 'Ingreso', entry.category || '', entry.source, entry.counterparty || '', entry.note || '',
      entry.gross, entry.cost, entry.net, '', '', Math.max(0, Number(entry.net) - allocated)
    ]);
    for (const allocation of allocations) {
      rows.push([
        entry.date, entry.id, 'Reparto', entry.category || '', entry.source, entry.counterparty || '', entry.note || '',
        '', '', '', allocation.name, allocation.amount, ''
      ]);
    }
  }

  const csv = '\ufeff' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
  downloadFile(`claro-extracto-${dateKey()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('Extracto descargado.');
}

function downloadBackup() {
  const backup = { format: 'claro-backup', version: 1, exportedAt: new Date().toISOString(), data };
  downloadFile(`claro-respaldo-${dateKey()}.json`, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
  toast('Copia completa descargada.');
}

const themeToggle = document.querySelector('#themeToggle');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
let themeMode = localStorage.getItem('claro.theme') || 'system';
function applyTheme() {
  const dark = themeMode === 'dark' || (themeMode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  themeToggle.textContent = dark ? '☀' : '☾';
  themeToggle.title = dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  themeToggle.setAttribute('aria-label', themeToggle.title);
  themeColorMeta.content = dark ? '#121714' : '#386b50';
}
themeToggle.addEventListener('click', () => {
  const currentlyDark = document.documentElement.dataset.theme === 'dark';
  themeMode = currentlyDark ? 'light' : 'dark';
  localStorage.setItem('claro.theme', themeMode);
  applyTheme();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (themeMode === 'system') applyTheme();
});
applyTheme();

document.querySelector('#restoreFile').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.data || parsed;
    if (!Array.isArray(incoming.sources) || !Array.isArray(incoming.targets) || !Array.isArray(incoming.entries)) {
      throw new Error('El archivo no contiene un respaldo Claro válido.');
    }
    if (!confirm('Restaurar esta copia reemplazará los datos guardados en este navegador. ¿Continuar?')) return;
    data = {
      ...defaults,
      ...incoming,
      distributions: Array.isArray(incoming.distributions) ? incoming.distributions : [],
      sourceRules: incoming.sourceRules || {},
      reminder: incoming.reminder || defaults.reminder
    };
    if (typeof normalizeIncomeGroups === 'function') normalizeIncomeGroups();
    save();
    render();
    toast('Copia restaurada.');
  } catch (error) {
    alert(error.message || 'No se pudo leer el archivo.');
  } finally {
    event.target.value = '';
  }
});

let deferredInstallPrompt = null;
const installButton = document.querySelector('#installButton');
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) {
    alert('Android: abre el menú de Chrome y elige “Instalar app”. iPhone: abre este enlace en Safari, toca Compartir y luego “Añadir a pantalla de inicio”.');
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});
window.addEventListener('appinstalled', () => {
  installButton.hidden = true;
  toast('Claro quedó instalada.');
});

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}

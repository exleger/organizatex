// Apartados de ingreso con sus plataformas o fuentes secundarias.
function normalizeIncomeGroups() {
  const legacySources = Array.isArray(data.sources) ? [...data.sources] : [];
  if (!data.incomeGroups || !Object.keys(data.incomeGroups).length) {
    data.incomeGroups = { Carreras: ['InDriver', 'Uber', 'Yango', 'DiDi'], Ventas: ['AirPods'] };
    const otherLegacy = legacySources.filter(source => !['Carreras', 'Ventas AirPods', 'InDriver', 'Uber', 'Yango', 'DiDi', 'AirPods'].includes(source));
    if (otherLegacy.length) data.incomeGroups['Otros ingresos'] = otherLegacy;
  }
  for (const [category, values] of Object.entries(data.incomeGroups)) {
    if (!Array.isArray(values)) data.incomeGroups[category] = [];
  }
  data.sourceRules = data.sourceRules || {};
  if (data.sourceRules['Ventas AirPods'] && !data.sourceRules.Ventas) data.sourceRules.Ventas = data.sourceRules['Ventas AirPods'];
  for (const entry of data.entries) {
    if (entry.category) continue;
    if (entry.source === 'Carreras') {
      entry.category = 'Carreras';
      entry.source = 'Carrera directa';
      if (!data.incomeGroups.Carreras.includes(entry.source)) data.incomeGroups.Carreras.push(entry.source);
    } else if (entry.source === 'Ventas AirPods') {
      entry.category = 'Ventas';
      entry.source = 'AirPods';
    } else {
      const match = Object.entries(data.incomeGroups).find(([, items]) => items.includes(entry.source));
      if (match) entry.category = match[0];
      else {
        data.incomeGroups['Otros ingresos'] ||= [];
        data.incomeGroups['Otros ingresos'].push(entry.source);
        entry.category = 'Otros ingresos';
      }
    }
  }
  data.sources = [...new Set(Object.values(data.incomeGroups).flat())];
  save();
}
normalizeIncomeGroups();

function categoryForSource(source) {
  return Object.entries(data.incomeGroups).find(([, items]) => items.includes(source))?.[0] || 'Otros ingresos';
}

populateSources = function () {
  const select = document.querySelector('#sourceSelect');
  if (!select) return;
  select.innerHTML = Object.entries(data.incomeGroups).flatMap(([category, items]) =>
    items.map(source => `<option value="${encodeURIComponent(category)}::${encodeURIComponent(source)}">${esc(category)} · ${esc(source)}</option>`)
  ).join('');
};

renderSources = function () {
  const box = document.querySelector('#sourceList');
  box.innerHTML = Object.entries(data.incomeGroups).map(([category, items]) => `
    <div style="padding:12px 0;border-bottom:1px solid var(--line)">
      <div style="font-weight:700;font-size:14px;margin-bottom:7px">▸ ${esc(category)}</div>
      ${items.map(source => `<div class="listitem" style="padding:7px 0;border:0"><div class="listmain"><small>${esc(source)}</small></div><button class="secondary" data-remove-category="${esc(category)}" data-remove-source="${esc(source)}" aria-label="Quitar ${esc(source)}">×</button></div>`).join('') || '<small style="color:var(--muted)">Aún no tiene fuentes. Agrégale una abajo.</small>'}
    </div>`).join('') || '<div class="empty">Crea tu primer apartado.</div>';
  const select = document.querySelector('#sourceCategory');
  select.innerHTML = Object.keys(data.incomeGroups).map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
  box.querySelectorAll('[data-remove-source]').forEach(button => button.onclick = () => removeIncomeSource(button.dataset.removeCategory, button.dataset.removeSource));
  populateSources();
};

function removeIncomeSource(category, source) {
  if (data.entries.some(entry => entry.source === source && entry.category === category)) return toast('Esta fuente ya tiene movimientos guardados y no se puede quitar.');
  data.incomeGroups[category] = data.incomeGroups[category].filter(item => item !== source);
  data.sources = [...new Set(Object.values(data.incomeGroups).flat())];
  save(); render();
}

document.querySelector('#addCategory').onclick = () => {
  const input = document.querySelector('#newCategory'), name = input.value.trim();
  if (!name) return toast('Escribe el nombre del apartado.');
  if (Object.keys(data.incomeGroups).some(item => item.toLowerCase() === name.toLowerCase())) return toast('Ese apartado ya existe.');
  data.incomeGroups[name] = []; input.value = ''; save(); render(); toast(`Apartado ${name} agregado.`);
};
document.querySelector('#addSource').onclick = () => {
  const category = document.querySelector('#sourceCategory').value, input = document.querySelector('#newSource'), name = input.value.trim();
  if (!name) return toast('Escribe el nombre de la fuente.');
  if (data.incomeGroups[category].some(item => item.toLowerCase() === name.toLowerCase())) return toast('Esa fuente ya existe en el apartado.');
  data.incomeGroups[category].push(name); data.sources = [...new Set([...data.sources, name])];
  input.value = ''; save(); render(); toast(`${name} agregado en ${category}.`);
};

renderSourceActions = function () {
  const box = document.querySelector('#sourceActions');
  box.innerHTML = Object.entries(data.incomeGroups).map(([category, items]) => {
    const total = todayEntries().filter(entry => (entry.category || categoryForSource(entry.source)) === category).reduce((sum, entry) => sum + Number(entry.net || 0), 0);
    return `<button class="source-tile" type="button" data-category="${esc(category)}"><span class="source-icon">${category.toLowerCase().includes('carrer') ? '🛵' : category.toLowerCase().includes('venta') ? '🛍️' : '💰'}</span><b>${esc(category)}</b><small>${items.length} fuentes · Ganancia hoy: ${money(total)}</small><small>Tocar para registrar ↗</small></button>`;
  }).join('') || '<div class="empty">Agrega un apartado en Configuración.</div>';
  box.querySelectorAll('[data-category]').forEach(button => button.onclick = () => openQuick(button.dataset.category));
};

openQuick = function (category) {
  const platforms = data.incomeGroups[category] || [];
  document.querySelector('#quickCategory').value = category;
  document.querySelector('#quickTitle').textContent = category;
  document.querySelector('#counterpartyLabel').textContent = category.toLowerCase().includes('carrer') ? '¿A quién le hiciste la carrera?' : category.toLowerCase().includes('venta') ? '¿A quién le vendiste?' : '¿Quién te pagó?';
  document.querySelector('#quickPlatform').innerHTML = platforms.map(source => `<option value="${esc(source)}">${esc(source)}</option>`).join('');
  document.querySelector('#quickSource').value = platforms[0] || '';
  document.querySelector('#quickPlatform').onchange = event => { document.querySelector('#quickSource').value = event.target.value; };
  document.querySelector('#quickDate').value = dateKey();
  document.querySelector('#quickGross').value = '';
  document.querySelector('#quickCost').value = '0';
  document.querySelector('#quickNote').value = '';
  document.querySelector('#quickCounterparty').value = '';
  document.querySelector('#quickModal').classList.add('open');
  setTimeout(() => document.querySelector('#quickGross').focus(), 100);
};

document.querySelector('#quickForm').onsubmit = event => {
  event.preventDefault();
  const gross = Number(document.querySelector('#quickGross').value), cost = Number(document.querySelector('#quickCost').value) || 0;
  const category = document.querySelector('#quickCategory').value, source = document.querySelector('#quickPlatform').value;
  const date = document.querySelector('#quickDate').value || dateKey();
  if (!source) return toast('Agrega una fuente dentro de este apartado primero.');
  if (gross <= 0) return toast('Ingresa un monto mayor a cero.');
  if (cost > gross) return toast('El costo no puede superar el ingreso.');
  data.entries.push({ id: 'e' + Date.now(), date, category, source, gross, cost, net: gross - cost, counterparty: document.querySelector('#quickCounterparty').value.trim(), note: document.querySelector('#quickNote').value.trim(), allocations: [] });
  save(); closeQuick(); render(); showPage('inicio'); toast(`${category} · ${source}: ingreso guardado.`);
};

document.querySelector('#incomeForm').onsubmit = event => {
  event.preventDefault();
  const [encodedCategory, encodedSource] = document.querySelector('#sourceSelect').value.split('::');
  const category = decodeURIComponent(encodedCategory || ''), source = decodeURIComponent(encodedSource || ''), gross = Number(document.querySelector('#gross').value), cost = Number(document.querySelector('#cost').value) || 0;
  if (cost > gross) return toast('El costo no puede superar el ingreso.');
  data.entries.push({ id: 'e' + Date.now(), date: document.querySelector('#incomeDate').value, category, source, gross, cost, net: gross - cost, note: document.querySelector('#note').value.trim(), allocations: [] });
  save(); document.querySelector('#incomeForm').reset(); document.querySelector('#incomeDate').value = dateKey(); document.querySelector('#cost').value = 0; render(); showPage('inicio'); toast('Ingreso guardado. Puedes repartir el total del apartado cuando quieras.');
};

entriesForSource = function (category) { return pendingEntries().filter(entry => (entry.category || categoryForSource(entry.source)) === category); };
sourcePending = function (category) { return entriesForSource(category).reduce((sum, entry) => sum + entryPending(entry), 0); };
openDistribution = function () {
  const categories = [...new Set(pendingEntries().map(entry => entry.category || categoryForSource(entry.source)))];
  if (!categories.length) return toast('No tienes dinero pendiente por repartir.');
  const select = document.querySelector('#distributionDate');
  select.innerHTML = categories.map(category => `<option value="${esc(category)}">${esc(category)} · ${entriesForSource(category).length} ingresos · ${money(sourcePending(category))}</option>`).join('');
  select.onchange = renderDistribution; renderDistribution(); document.querySelector('#allocationModal').classList.add('open');
};
renderDistribution = function () {
  const category = document.querySelector('#distributionDate').value, entries = entriesForSource(category), available = entries.reduce((sum, entry) => sum + entryPending(entry), 0), custom = data.sourceRules[category];
  const included = entries.map(entry => `<div style="padding:5px 0">${new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short'}).format(new Date(entry.date+'T12:00:00'))} · ${esc(entry.source)}${entry.counterparty ? ' · '+esc(entry.counterparty) : ''} — ${money(entryPending(entry))} pendiente</div>`).join('');
  const rows = data.targets.map(target => {
    const suggested = custom ? entries.reduce((sum, entry) => sum + Math.floor(entryPending(entry) * (Number(custom[target.id]) || 0) / 100), 0) : target.mode === 'percent' ? Math.floor(available * Number(target.value) / 100) : Math.min(available, Number(target.value) || 0);
    const percent = custom ? Number(custom[target.id]) || 0 : null;
    return `<div class="allocation"><div><b>${target.emoji || '🎯'} ${esc(target.name)}</b><small style="display:block;color:var(--muted)">${percent === null ? 'Sugerido según reparto general' : `${percent}% de ${esc(category)}`}</small></div><input aria-label="Monto para ${esc(target.name)}" type="number" min="0" step="100" data-dist="${esc(target.id)}" value="${suggested}"><span>COP</span></div>`;
  }).join('');
  document.querySelector('#allocationIntro').innerHTML = `<b>${esc(category)} · ${entries.length} ingresos acumulados</b><br>Ganancia pendiente para repartir: <b>${money(available)}</b><details style="margin-top:8px"><summary style="cursor:pointer;color:var(--green);font-weight:700">Ver detalle de los ingresos</summary>${included}</details>`;
  document.querySelector('#allocationResult').innerHTML = (rows || '<div class="empty">Agrega una meta o deuda en tu plan.</div>') + `<div class="alloc-total"><span>Quedará de ${esc(category)}</span><b id="distRemaining">${money(available)}</b></div>`;
  document.querySelectorAll('[data-dist]').forEach(input => input.oninput = updateDistributionRemaining);
  document.querySelector('#confirmIncome').onclick = confirmDistribution; updateDistributionRemaining();
};

renderRulesEditor = function () {
  const select = document.querySelector('#ruleSource'), categories = Object.keys(data.incomeGroups);
  if (!categories.includes(selectedRuleSource)) selectedRuleSource = categories[0] || '';
  select.innerHTML = categories.map(category => `<option value="${esc(category)}" ${category === selectedRuleSource ? 'selected' : ''}>${esc(category)}</option>`).join('');
  select.onchange = () => { selectedRuleSource = select.value; renderRulesEditor(); };
  const rules = data.sourceRules[selectedRuleSource];
  const rows = data.targets.map(target => {
    const value = rules ? Number(rules[target.id] || 0) : target.mode === 'percent' ? Number(target.value) || 0 : 0;
    return `<div class="allocation"><div><b>${target.emoji || '🎯'} ${esc(target.name)}</b><small style="display:block;color:var(--muted)">${target.type === 'debt' ? 'Parte del grupo Deudas' : 'Meta, gasto o ahorro'}</small></div><input type="number" min="0" max="100" step="0.1" data-rule="${esc(target.id)}" value="${value}"><span>%</span></div>`;
  }).join('');
  document.querySelector('#rulesEditor').innerHTML = rows || '<div class="empty">Agrega metas o deudas para configurar sus porcentajes.</div>';
  document.querySelectorAll('[data-rule]').forEach(input => input.oninput = updateRuleTotals);
  updateRuleTotals(); document.querySelector('#saveRules').onclick = saveSourceRules;
};

renderRecent = function () {
  const box = document.querySelector('#recentList'), entries = [...data.entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  box.innerHTML = entries.length ? entries.map(entry => `<div class="activity"><div class="iconbox">${(entry.category || '').toLowerCase().includes('carrer') ? '🛵' : (entry.category || '').toLowerCase().includes('venta') ? '🛍️' : '💰'}</div><div class="activity-info"><b>${esc(entry.category || '')} · ${esc(entry.source)}</b><small>${entry.counterparty ? esc(entry.counterparty)+' · ' : ''}${entry.date}${entry.note ? ' · '+esc(entry.note) : ''}</small></div><div class="activity-amt">+${money(entry.net)}<small>recibido ${money(entry.gross)}</small></div></div>`).join('') : '<div class="empty"><b>Tu primer registro empieza aquí</b>Cuando anotes tus ingresos, aparecerán en esta lista.</div>';
};

renderWeek = function () {
  const days = weekDates(weekOffset), start = new Date(days[0]+'T12:00:00'), end = new Date(days[6]+'T12:00:00'), format = date => new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short'}).format(date);
  const entries = data.entries.filter(entry => days.includes(entry.date)), gross = entries.reduce((sum, entry) => sum + Number(entry.gross || 0), 0), net = entries.reduce((sum, entry) => sum + Number(entry.net || 0), 0);
  const allocated = entries.reduce((sum, entry) => sum + entryDistributed(entry), 0), byTarget = {}, bySource = {};
  entries.forEach(entry => { const label = `${entry.category || categoryForSource(entry.source)} · ${entry.source}`; bySource[label] = (bySource[label] || 0) + Number(entry.net || 0); (entry.allocations || []).forEach(item => byTarget[item.name] = (byTarget[item.name] || 0) + Number(item.amount || 0)); });
  data.distributions.filter(item => days.includes(item.date)).forEach(item => { byTarget[item.name] = (byTarget[item.name] || 0) + Number(item.amount || 0); });
  const sourceRows = Object.entries(bySource).map(([name, value]) => `<span>${esc(name)}</span><b>${money(value)} ganancia</b>`).join(''), targetRows = Object.entries(byTarget).map(([name, value]) => `<span>${esc(name)}</span><b>${money(value)}</b>`).join('');
  const movements = [...entries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => `<div class="activity"><div class="iconbox">${(entry.category || '').toLowerCase().includes('carrer') ? '🛵' : '💰'}</div><div class="activity-info"><b>${esc(entry.category || '')} · ${esc(entry.source)}${entry.counterparty ? ' · '+esc(entry.counterparty) : ''}</b><small>${format(new Date(entry.date+'T12:00:00'))}${entry.note ? ' · '+esc(entry.note) : ''}</small></div><div class="activity-amt">${money(entry.net)}<small>${entry.cost ? `costos ${money(entry.cost)}` : 'ganancia'}</small></div></div>`).join('');
  document.querySelector('#weekRange').textContent = `${format(start)} – ${format(end)}`;
  document.querySelector('#weekSummary').innerHTML = `<div class="week-stats"><div class="week-stat"><small>Ingresó</small><b>${money(gross)}</b></div><div class="week-stat"><small>Ganancia neta</small><b>${money(net)}</b></div><div class="week-stat"><small>Por repartir</small><b>${money(Math.max(0,net-allocated))}</b></div></div>${sourceRows ? `<div class="week-detail"><span class="muted" style="grid-column:1/-1">Ganancia por apartado y fuente</span>${sourceRows}</div>` : ''}${targetRows ? `<div class="week-detail"><span class="muted" style="grid-column:1/-1">Repartido por obligación</span>${targetRows}</div>` : '<div class="week-detail"><span class="muted">Todavía no has repartido dinero esta semana.</span></div>'}${movements ? `<details class="week-moves"><summary>Ver ${entries.length} movimiento${entries.length===1?'':'s'} de la semana</summary>${movements}</details>` : '<div class="empty" style="padding:20px 0">Aún no hay movimientos esta semana.</div>'}`;
};

const renderBaseWithGroups = baseRender;
render = function () { renderBaseWithGroups(); renderSourceActions(); renderWeek(); renderRulesEditor(); };
render();

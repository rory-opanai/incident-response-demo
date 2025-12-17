const cwGroupsEl = document.getElementById('cwGroups');
const cwRowsEl = document.getElementById('cwRows');
const cwFilterInput = document.getElementById('cwFilter');
const cwGroupFilter = document.getElementById('cwGroupFilter');
const cwMeta = document.getElementById('cwMeta');
const logTimestamp = document.getElementById('logTimestamp');
const cwApplyButton = document.querySelector('.cw-button');

const ddQueryInput = document.getElementById('ddQuery');
const ddQueryTags = document.getElementById('ddQueryTags');
const ddFacets = document.getElementById('ddFacets');
const ddBars = document.getElementById('ddBars');
const ddHistogramMeta = document.getElementById('ddHistogramMeta');
const ddStream = document.getElementById('ddStream');
const ddSearchButton = document.querySelector('.dd-button');

let cloudwatchLogs = [];
let cloudwatchGroups = [];
let datadogTraces = [];
let selectedGroup = null;

init();

async function init() {
  try {
    const [cwData, ddData] = await Promise.all([
      fetchJson('/api/logs/cloudwatch'),
      fetchJson('/api/logs/datadog')
    ]);
    cloudwatchLogs = cwData.entries ?? [];
    datadogTraces = ddData.traces ?? [];
  } catch (error) {
    console.error('Failed to load log fixtures', error);
  }

  cloudwatchGroups = buildCloudwatchGroups(cloudwatchLogs);
  selectedGroup = cloudwatchGroups[0]?.name ?? null;

  renderCloudwatch();
  renderDatadog();
  updateTimestamp();

  if (cwGroupFilter) {
    cwGroupFilter.addEventListener('input', renderCloudwatchGroups);
  }

  if (cwFilterInput) {
    cwFilterInput.addEventListener('input', renderCloudwatchRows);
  }

  if (cwApplyButton) {
    cwApplyButton.addEventListener('click', renderCloudwatch);
  }

  if (ddQueryInput) {
    ddQueryInput.addEventListener('input', renderDatadog);
  }

  if (ddSearchButton) {
    ddSearchButton.addEventListener('click', renderDatadog);
  }
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  return res.json();
}

function renderCloudwatch() {
  renderCloudwatchGroups();
  renderCloudwatchRows();
}

function renderCloudwatchGroups() {
  if (!cwGroupsEl) return;
  cwGroupsEl.innerHTML = '';

  const filterText = (cwGroupFilter?.value || '').trim().toLowerCase();
  const groupsToShow = cloudwatchGroups.filter((group) =>
    group.name.toLowerCase().includes(filterText)
  );

  if (!selectedGroup && cloudwatchGroups.length > 0) {
    selectedGroup = cloudwatchGroups[0].name;
  }

  if (groupsToShow.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'cw-count';
    empty.textContent = 'No matches';
    cwGroupsEl.appendChild(empty);
    return;
  }

  groupsToShow.forEach((group) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `cw-group${group.name === selectedGroup ? ' active' : ''}`;

    const name = document.createElement('span');
    name.textContent = group.name;

    const count = document.createElement('span');
    count.className = 'cw-count';
    count.textContent = group.count;

    button.append(name, count);
    button.addEventListener('click', () => {
      selectedGroup = group.name;
      renderCloudwatchRows();
      renderCloudwatchGroups();
    });

    cwGroupsEl.appendChild(button);
  });
}

function renderCloudwatchRows() {
  if (!cwRowsEl) return;
  cwRowsEl.innerHTML = '';

  const filter = parseFilter(cwFilterInput?.value ?? '');
  const entries = cloudwatchLogs
    .filter((entry) => (selectedGroup ? getGroupName(entry) === selectedGroup : true))
    .filter((entry) => matchesCloudwatch(entry, filter))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  if (cwMeta) {
    const groupLabel = selectedGroup ?? 'All groups';
    cwMeta.textContent = `${entries.length} events in ${groupLabel}`;
  }

  entries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'cw-row';
    row.style.setProperty('--delay', `${index * 40}ms`);

    const timestamp = document.createElement('div');
    timestamp.className = 'cw-timestamp';
    timestamp.textContent = formatTimestamp(entry.timestamp);

    const message = document.createElement('div');
    const messageLine = document.createElement('div');
    messageLine.className = 'cw-message-line';

    const level = document.createElement('span');
    const levelClass = (entry.level || 'info').toLowerCase();
    level.className = `cw-level cw-level-${levelClass}`;
    level.textContent = entry.level || 'INFO';

    const messageText = document.createElement('span');
    messageText.textContent = entry.message || 'Log entry';

    messageLine.append(level, messageText);

    const meta = document.createElement('div');
    meta.className = 'cw-message-meta';
    meta.textContent = formatCloudwatchMeta(entry);

    message.append(messageLine, meta);

    const detailsText = formatDetails(entry.details);
    if (detailsText) {
      const details = document.createElement('div');
      details.className = 'cw-message-details';
      details.textContent = detailsText;
      message.appendChild(details);
    }

    const status = document.createElement('div');
    status.className = 'cw-status';
    status.textContent = entry.status ?? '-';

    const request = document.createElement('div');
    request.className = 'cw-request';
    request.textContent = entry.request_id || '-';

    const trace = document.createElement('div');
    trace.className = 'cw-sub';
    trace.textContent = entry.trace_id || '';

    request.appendChild(trace);

    row.append(timestamp, message, status, request);
    cwRowsEl.appendChild(row);
  });
}

function renderDatadog() {
  if (!ddStream) return;

  const query = parseQuery(ddQueryInput?.value ?? '');
  const filteredTraces = datadogTraces
    .filter((trace) => matchesDatadog(trace, query))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  renderQueryTags(query.tokens);
  renderFacets(filteredTraces);
  renderHistogram(filteredTraces);
  renderStream(filteredTraces);
}

function renderQueryTags(tokens) {
  if (!ddQueryTags) return;
  ddQueryTags.innerHTML = '';

  tokens.forEach((token) => {
    const tag = document.createElement('span');
    tag.className = 'dd-query-tag';
    tag.textContent = token;
    ddQueryTags.appendChild(tag);
  });
}

function renderFacets(traces) {
  if (!ddFacets) return;
  ddFacets.innerHTML = '';

  const facets = [
    { title: 'Status', items: countBy(traces, (trace) => trace.status) },
    { title: 'Service', items: countBy(traces, (trace) => getPrimaryService(trace)) },
    { title: 'Error type', items: countErrors(traces) },
    { title: 'Release tag', items: countBy(traces, (trace) => trace.release_tag) }
  ];

  facets.forEach((facet) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'dd-facet';

    const title = document.createElement('p');
    title.className = 'dd-facet-title';
    title.textContent = facet.title;
    wrapper.appendChild(title);

    if (facet.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dd-facet-item';
      empty.textContent = 'No data';
      wrapper.appendChild(empty);
    } else {
      facet.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'dd-facet-item';

        const name = document.createElement('span');
        name.textContent = item.key;

        const count = document.createElement('span');
        count.textContent = item.count;

        row.append(name, count);
        wrapper.appendChild(row);
      });
    }

    ddFacets.appendChild(wrapper);
  });
}

function renderHistogram(traces) {
  if (!ddBars) return;
  ddBars.innerHTML = '';

  const { buckets, rangeLabel } = buildHistogram(traces, 10);
  const maxCount = Math.max(1, ...buckets);

  buckets.forEach((count) => {
    const bar = document.createElement('div');
    bar.className = 'dd-bar';
    const height = count === 0 ? 6 : Math.max(12, (count / maxCount) * 100);
    bar.style.setProperty('--bar-height', `${height}%`);
    bar.title = `${count} events`;
    ddBars.appendChild(bar);
  });

  if (ddHistogramMeta) {
    ddHistogramMeta.textContent = `${traces.length} events ${rangeLabel}`;
  }
}

function renderStream(traces) {
  if (!ddStream) return;
  ddStream.innerHTML = '';

  if (traces.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'dd-log';
    empty.textContent = 'No events match the current query.';
    ddStream.appendChild(empty);
    return;
  }

  traces.forEach((trace, index) => {
    const event = buildDatadogEvent(trace);
    const row = document.createElement('div');
    row.className = `dd-log ${event.status}`;
    row.style.setProperty('--delay', `${index * 45}ms`);

    const header = document.createElement('div');
    header.className = 'dd-log-header';

    const time = document.createElement('span');
    time.textContent = formatTimeOnly(trace.timestamp);

    const status = document.createElement('span');
    status.className = `dd-status ${event.status}`;
    status.textContent = event.status;

    const service = document.createElement('span');
    service.textContent = event.service;

    const duration = document.createElement('span');
    duration.className = 'dd-duration';
    duration.textContent = `${event.duration}ms`;

    header.append(time, status, service, duration);

    const message = document.createElement('div');
    message.className = 'dd-log-message';
    message.textContent = event.message;

    const tags = document.createElement('div');
    tags.className = 'dd-log-tags';

    event.tags.forEach((tagText) => {
      const tag = document.createElement('span');
      tag.className = 'dd-tag';
      tag.textContent = tagText;
      tags.appendChild(tag);
    });

    row.append(header, message, tags);
    ddStream.appendChild(row);
  });
}

function updateTimestamp() {
  if (!logTimestamp) return;
  const timestamps = [
    ...cloudwatchLogs.map((entry) => Date.parse(entry.timestamp)),
    ...datadogTraces.map((trace) => Date.parse(trace.timestamp))
  ].filter((value) => !Number.isNaN(value));

  if (timestamps.length === 0) return;
  const latest = new Date(Math.max(...timestamps));
  logTimestamp.textContent = `Latest event: ${formatTimestamp(latest.toISOString())}`;
}

function buildCloudwatchGroups(logs) {
  const groups = new Map();
  logs.forEach((entry) => {
    const name = getGroupName(entry);
    const group = groups.get(name) ?? { name, count: 0 };
    group.count += 1;
    groups.set(name, group);
  });
  return Array.from(groups.values()).sort((a, b) => b.count - a.count);
}

function getGroupName(entry) {
  return entry.service ? `/aws/ecs/${entry.service}` : '/aws/ecs/unknown';
}

function parseFilter(raw) {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const filters = { terms: [] };

  tokens.forEach((token) => {
    const idx = token.indexOf(':');
    if (idx > 0) {
      const key = token.slice(0, idx).toLowerCase();
      const value = token.slice(idx + 1);
      if (value) {
        filters[key] = value;
        return;
      }
    }
    filters.terms.push(token);
  });

  return filters;
}

function matchesCloudwatch(entry, filters) {
  if (!filters) return true;
  const has = (value, term) => String(value || '').toLowerCase().includes(term);

  if (filters.status && String(entry.status) !== String(filters.status)) return false;
  if (filters.level && String(entry.level || '').toLowerCase() !== String(filters.level).toLowerCase()) {
    return false;
  }
  if (filters.request_id && entry.request_id !== filters.request_id) return false;
  if (filters.trace_id && entry.trace_id !== filters.trace_id) return false;
  if (filters.service && !has(entry.service, String(filters.service).toLowerCase())) return false;
  if (filters.release_tag && !has(entry.release_tag, String(filters.release_tag).toLowerCase())) return false;

  if (filters.terms.length > 0) {
    const haystack = [
      entry.message,
      entry.request_id,
      entry.trace_id,
      entry.service,
      entry.release_tag,
      JSON.stringify(entry.details || {})
    ]
      .join(' ')
      .toLowerCase();

    if (!filters.terms.every((term) => haystack.includes(term.toLowerCase()))) return false;
  }

  return true;
}

function parseQuery(raw) {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const filters = {};
  const terms = [];

  tokens.forEach((token) => {
    const idx = token.indexOf(':');
    if (idx > 0) {
      const key = token.slice(0, idx).toLowerCase();
      const value = token.slice(idx + 1);
      if (value) {
        if (!filters[key]) {
          filters[key] = [];
        }
        filters[key].push(value);
        return;
      }
    }
    terms.push(token);
  });

  return { tokens, filters, terms };
}

function matchesDatadog(trace, query) {
  const filters = query.filters || {};
  const terms = query.terms || [];

  if (filters.status && !filters.status.includes(trace.status)) return false;

  if (filters.service) {
    const services = trace.spans?.map((span) => span.service) ?? [];
    if (!filters.service.some((service) => services.includes(service))) return false;
  }

  if (filters.request_id && !filters.request_id.includes(trace.request_id)) return false;
  if (filters.trace_id && !filters.trace_id.includes(trace.trace_id)) return false;
  if (filters.release_tag && !filters.release_tag.includes(trace.release_tag)) return false;

  if (filters.error) {
    const errorTypes = trace.errors?.map((err) => err.type) ?? [];
    if (!filters.error.some((value) => errorTypes.includes(value))) return false;
  }

  if (filters.env && !filters.env.includes('prod')) return false;

  if (terms.length > 0) {
    const haystack = [
      trace.request_id,
      trace.trace_id,
      trace.release_tag,
      trace.spans?.map((span) => span.name).join(' '),
      trace.errors?.map((err) => `${err.type} ${err.message}`).join(' ')
    ]
      .join(' ')
      .toLowerCase();

    if (!terms.every((term) => haystack.includes(term.toLowerCase()))) return false;
  }

  return true;
}

function buildDatadogEvent(trace) {
  const rootSpan = trace.spans?.[0];
  const error = trace.errors?.[0];
  const service = getPrimaryService(trace);
  const duration = sumDuration(trace);
  const baseMessage = rootSpan?.name ?? 'request';
  const message = error
    ? `${baseMessage} -> ${error.type}: ${error.message}`
    : `${baseMessage} completed`;
  const tags = [
    `service:${service}`,
    'env:prod',
    `release_tag:${trace.release_tag}`,
    `request_id:${trace.request_id}`,
    `trace_id:${trace.trace_id}`,
    `span.count:${trace.spans?.length ?? 0}`
  ];

  if (error) {
    tags.push(`error.type:${error.type}`);
  }

  return {
    status: trace.status === 'error' ? 'error' : 'ok',
    message,
    service,
    duration,
    tags
  };
}

function getPrimaryService(trace) {
  const errorService = trace.errors?.[0]?.service;
  if (errorService) return errorService;
  const span = trace.spans?.find((item) => item.service && item.service !== 'edge-gateway');
  return span?.service ?? trace.spans?.[0]?.service ?? 'unknown';
}

function sumDuration(trace) {
  return (trace.spans || []).reduce((total, span) => total + (span.duration_ms || 0), 0);
}

function countBy(list, selector) {
  const counts = new Map();
  list.forEach((item) => {
    const key = selector(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function countErrors(traces) {
  const counts = new Map();
  traces.forEach((trace) => {
    (trace.errors || []).forEach((error) => {
      const key = error.type || 'UnknownError';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function buildHistogram(traces, bucketCount) {
  if (traces.length === 0) {
    return { buckets: new Array(bucketCount).fill(0), rangeLabel: '' };
  }

  const timestamps = traces.map((trace) => Date.parse(trace.timestamp));
  const min = Math.min(...timestamps);
  const max = Math.max(...timestamps);
  const span = Math.max(1, max - min);
  const step = span / bucketCount;
  const buckets = new Array(bucketCount).fill(0);

  timestamps.forEach((time) => {
    const index = Math.min(bucketCount - 1, Math.floor((time - min) / step));
    buckets[index] += 1;
  });

  const rangeLabel = `(${formatShortDate(min)} - ${formatShortDate(max)})`;
  return { buckets, rangeLabel };
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

function formatTimeOnly(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().split('T')[1].replace('Z', ' UTC');
}

function formatShortDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDetails(details) {
  if (!details) return '';
  return Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
}

function formatCloudwatchMeta(entry) {
  const parts = [];
  if (entry.service) parts.push(`service=${entry.service}`);
  if (entry.user) parts.push(`user=${entry.user}`);
  if (entry.trace_id) parts.push(`trace_id=${entry.trace_id}`);
  if (entry.release_tag) parts.push(`release=${entry.release_tag}`);
  return parts.join(' ');
}

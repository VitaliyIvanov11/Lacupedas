// Minimal, dependency-free SVG bar chart: sightings per month for the
// current year. Single series -> no legend needed, title names it.
// Colors follow the validated reference palette (sequential blue ramp).

function renderMonthlyChart(container, sightings) {
  const year = new Date().getFullYear();
  const counts = new Array(12).fill(0);
  sightings.forEach((s) => {
    const d = new Date(s.date);
    if (d.getFullYear() === year) counts[d.getMonth()] += 1;
  });

  const max = Math.max(...counts, 1);
  const months = t("monthsShort");

  const width = 560;
  const height = 120;
  const padLeft = 28;
  const padBottom = 20;
  const padTop = 10;
  const padRight = 8;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const barGap = 6;
  const barW = plotW / 12 - barGap;

  const gridLines = [0, 0.5, 1].map((f) => {
    const y = padTop + plotH * (1 - f);
    const val = Math.round(max * f);
    return `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" class="viz-grid" />
      <text x="${padLeft - 6}" y="${y + 3}" class="viz-axis-label" text-anchor="end">${val}</text>`;
  }).join("");

  const bars = counts
    .map((c, i) => {
      const x = padLeft + i * (plotW / 12) + barGap / 2;
      const h = max === 0 ? 0 : (c / max) * plotH;
      const y = padTop + plotH - h;
      const label = `${months[i]}: ${c}`;
      return `<g class="viz-bar-group">
        <rect x="${x}" y="${y}" width="${Math.max(barW, 1)}" height="${Math.max(h, 0)}" rx="4" ry="4" class="viz-bar">
          <title>${label}</title>
        </rect>
        <text x="${x + barW / 2}" y="${height - padBottom + 14}" class="viz-axis-label" text-anchor="middle">${months[i]}</text>
      </g>`;
    })
    .join("");

  const hasData = counts.some((c) => c > 0);

  container.innerHTML = `
    <svg class="viz-root" viewBox="0 0 ${width} ${height}" role="img" aria-label="${t("chartTitle")} ${year}">
      ${gridLines}
      ${bars}
    </svg>
    ${hasData ? "" : `<p class="viz-empty">${t("chartNoData")}</p>`}
  `;
}

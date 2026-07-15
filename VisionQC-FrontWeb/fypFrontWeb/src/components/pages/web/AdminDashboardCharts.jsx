import { ShieldCheck } from "lucide-react";
import { VCard } from "../../visionqc/VCard";

function formatCompactNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

function describePercentage(part, total) {
  if (!total) {
    return "0%";
  }

  return `${Math.round((part / total) * 100)}%`;
}

function buildPieSegments(data, radius = 74, circumference = 2 * Math.PI * radius) {
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  let offset = 0;

  return data.map((item) => {
    const value = Number(item.value) || 0;
    const segmentLength = total > 0 ? (value / total) * circumference : 0;
    const segment = {
      ...item,
      total,
      dashArray: `${segmentLength} ${circumference - segmentLength}`,
      dashOffset: -offset,
      percentage: describePercentage(value, total),
    };

    offset += segmentLength;
    return segment;
  });
}

function DonutChart({ data, size = 160, strokeWidth = 18 }) {
  const radius = (size - strokeWidth) / 2;
  const segments = buildPieSegments(data, radius);
  const center = size / 2;
  const total = segments[0]?.total || 0;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,190px)_1fr] md:items-center">
      <div className="relative mx-auto h-[160px] w-[160px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90 overflow-visible">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(13, 77, 61, 0.08)"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment) => (
            <circle
              key={segment.name}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={segment.dashArray}
              strokeDashoffset={segment.dashOffset}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-xl font-semibold leading-none text-[#0d4d3d]">{formatCompactNumber(total)}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-[#2a2d35]/60">total</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[#fafaf8] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <div>
                <p className="text-sm text-[#0d4d3d]">{segment.name}</p>
                <p className="text-xs text-[#2a2d35]/60">{segment.percentage}</p>
              </div>
            </div>
            <p className="text-sm text-[#0d4d3d]">{formatCompactNumber(segment.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerticalBarChart({ data, valueLabel, maxValue }) {
  return (
    <div className="space-y-4">
      {data.map((item) => {
        const value = Number(item.value) || 0;
        const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 6) : 0;

        return (
          <div key={item.name} className="space-y-2">
            <div className="flex items-end justify-between gap-4">
              <p className="text-sm text-[#0d4d3d]">{item.name}</p>
              <p className="text-xs text-[#2a2d35]/60">
                {formatCompactNumber(value)} {valueLabel}
              </p>
            </div>
            <div className="h-3 rounded-full bg-[#0d4d3d]/8">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#0d4d3d] to-[#0a6b52]"
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HorizontalLocationChart({ data, maxValue }) {
  return (
    <div className="space-y-4">
      {data.map((item) => {
        const value = Number(item.diseasedScans) || 0;
        const width = maxValue > 0 ? Math.max((value / maxValue) * 100, 6) : 0;

        return (
          <div key={item.location} className="grid gap-2 md:grid-cols-[140px_minmax(0,1fr)_56px] md:items-center">
            <div>
              <p className="text-sm text-[#0d4d3d]">{item.location}</p>
              <p className="text-xs text-[#2a2d35]/60">{item.topDisease}</p>
            </div>
            <div className="h-3 rounded-full bg-[#0d4d3d]/8">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-[#0d4d3d] to-[#6effc9]"
                style={{ width: `${width}%` }}
              />
            </div>
            <p className="text-right text-sm text-[#0d4d3d]">{formatCompactNumber(value)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function AdminDashboardCharts({
  isLoading,
  roleDistributionData,
  statusDistributionData,
  topDiseasesData,
  diseaseByLocationData,
}) {
  const topDiseaseMax = topDiseasesData.reduce((max, item) => Math.max(max, Number(item.value) || 0), 0);
  const locationMax = diseaseByLocationData.reduce((max, item) => Math.max(max, Number(item.diseasedScans) || 0), 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <VCard variant="organic" className="!p-5 min-h-[280px]">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl text-[#0d4d3d]">Role Overview</h3>
              </div>
              <ShieldCheck className="w-5 h-5 text-[#0d4d3d]" />
            </div>

            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-[#2a2d35]/60">Loading breakdown...</div>
            ) : roleDistributionData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-[#2a2d35]/60">No role data available yet.</div>
            ) : (
              <DonutChart data={roleDistributionData} />
            )}
          </VCard>
        </div>

        <div>
          <VCard variant="organic" className="min-h-[280px]">
            <h3 className="text-xl text-[#0d4d3d] mb-6">User Status Distribution</h3>
            {isLoading ? (
              <div className="h-[180px] flex items-center justify-center text-[#2a2d35]/60">Loading chart...</div>
            ) : statusDistributionData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-[#2a2d35]/60">No user status data available yet.</div>
            ) : (
              <DonutChart data={statusDistributionData} />
            )}
          </VCard>
        </div>
      </div>

      <div className="mb-8">
        <VCard variant="organic" className="min-h-[360px]">
          <div className="mb-6">
            <h3 className="text-xl text-[#0d4d3d] mb-1">Top Diseases</h3>
            <p className="text-sm text-[#2a2d35]/60">Most frequent diseases from the admin overview statistics.</p>
          </div>

          {isLoading ? (
            <div className="h-[240px] flex items-center justify-center text-[#2a2d35]/60">Loading disease statistics...</div>
          ) : topDiseasesData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-[#2a2d35]/60">No disease statistics available yet.</div>
          ) : (
            <VerticalBarChart data={topDiseasesData} valueLabel="scans" maxValue={topDiseaseMax} />
          )}
        </VCard>
      </div>

      <div>
        <VCard variant="organic" className="min-h-[420px]">
          <div className="mb-6">
            <h3 className="text-xl text-[#0d4d3d] mb-1">Disease by Location</h3>
            <p className="text-sm text-[#2a2d35]/60">Locations with the highest number of diseased scans.</p>
          </div>

          {isLoading ? (
            <div className="h-[300px] flex items-center justify-center text-[#2a2d35]/60">Loading location statistics...</div>
          ) : diseaseByLocationData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-[#2a2d35]/60">No diseased scan locations available yet.</div>
          ) : (
            <HorizontalLocationChart data={diseaseByLocationData} maxValue={locationMax} />
          )}
        </VCard>
      </div>
    </>
  );
}

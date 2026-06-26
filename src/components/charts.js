// Small, theme-aware history charts shared by the menu hero and the Statistics
// page. Two views over the per-game accuracy history (an array of 0–100 percents,
// oldest → newest):
//   • RecentGamesChart — one bar per game (how you did that round).
//   • AccuracyTrendChart — a smooth line of your running lifetime accuracy.
//
// `smoothPath` and `cumulativeAverage` are exported so the hero's overlaid
// version can reuse the exact same math.

import React, { useState } from 'react';
import { View } from 'react-native';
import Svg, {
  Rect,
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
import { useTheme } from '../theme';

const clampPct = (v) => Math.min(100, Math.max(0, v));

// Cumulative (running) average of a series — value i is the mean of items 0..i.
// Used for the lifetime-accuracy trend: the average accuracy across every game
// played up to that point.
export function cumulativeAverage(data) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    out.push(sum / (i + 1));
  }
  return out;
}

// Partition n items into m contiguous, near-equal buckets; returns m [start,end)
// index pairs (end exclusive). Assumes n >= m >= 1.
function buckets(n, m) {
  const out = [];
  for (let i = 0; i < m; i++) {
    out.push([Math.floor((i * n) / m), Math.floor(((i + 1) * n) / m)]);
  }
  return out;
}

// Downsample a series to at most m points by averaging each bucket — so the
// whole history is always represented, just compressed once it outgrows the
// available bars. Returned unchanged when it already fits (length <= m).
export function downsampleMean(data, m) {
  if (m <= 0) return [];
  if (data.length <= m) return data.slice();
  return buckets(data.length, m).map(([s, e]) => {
    let sum = 0;
    for (let i = s; i < e; i++) sum += data[i];
    return sum / (e - s);
  });
}

// Sample a series to at most m points by taking each bucket's LAST value, so the
// final (most recent) value is always preserved. Used for the cumulative
// lifetime-accuracy line, whose endpoint is the true overall accuracy.
export function sampleBucketEnds(data, m) {
  if (m <= 0) return [];
  if (data.length <= m) return data.slice();
  return buckets(data.length, m).map(([, e]) => data[e - 1]);
}

// Smooth (Catmull-Rom → cubic-bezier) SVG path through { x, y } points, so a
// series reads as a flowing curve rather than jagged segments.
export function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

const PAD = 4; // vertical inset so 0%/100% don't clip at the edges
const BAR_GAP = 3;

// Faint horizontal gridlines at 0/50/100%.
function Gridlines({ width, height, color }) {
  const ys = [PAD, height / 2, height - PAD];
  return (
    <>
      {ys.map((y, i) => (
        <Line
          key={i}
          x1={0}
          y1={y}
          x2={width}
          y2={y}
          stroke={color}
          strokeWidth={1}
          strokeDasharray={i === 2 ? undefined : '3,4'}
          opacity={i === 2 ? 0.5 : 0.3}
        />
      ))}
    </>
  );
}

// Per-game accuracy as bars (oldest → newest). Bars stretch to fill the width.
export function RecentGamesChart({ history = [], height = 96 }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const data = history;

  let bars = null;
  if (width > 0 && data.length > 0) {
    const stride = width / data.length;
    const barW = Math.max(2, Math.min(stride - BAR_GAP, 16));
    const usable = height - 2 * PAD;
    bars = data.map((pct, i) => {
      const h = Math.max(2, (clampPct(pct) / 100) * usable);
      const x = i * stride + (stride - barW) / 2;
      const y = height - PAD - h;
      return (
        <Rect
          key={i}
          x={x}
          y={y}
          width={barW}
          height={h}
          rx={Math.min(2, barW / 2)}
          fill={colors.primary}
          opacity={0.85}
        />
      );
    });
  }

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Gridlines width={width} height={height} color={colors.border} />
          {bars}
        </Svg>
      )}
    </View>
  );
}

// Running lifetime accuracy as a smooth line with a soft area fill, plus a dot
// on the latest value.
export function AccuracyTrendChart({ history = [], height = 96 }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const series = cumulativeAverage(history);

  let content = null;
  if (width > 0 && series.length >= 2) {
    const usable = height - 2 * PAD;
    const points = series.map((v, i) => ({
      x: series.length > 1 ? (i / (series.length - 1)) * width : width / 2,
      y: PAD + (1 - clampPct(v) / 100) * usable,
    }));
    const line = smoothPath(points);
    // Close the curve down to the baseline for the gradient area fill.
    const area = `${line} L ${points[points.length - 1].x},${height} L ${points[0].x},${height} Z`;
    const last = points[points.length - 1];
    content = (
      <>
        <Defs>
          <SvgGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
            <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
          </SvgGradient>
        </Defs>
        <Gridlines width={width} height={height} color={colors.border} />
        <Path d={area} fill="url(#trendFill)" />
        <Path
          d={line}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <Circle cx={last.x} cy={last.y} r={3.5} fill={colors.primary} />
      </>
    );
  }

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {content}
        </Svg>
      )}
    </View>
  );
}

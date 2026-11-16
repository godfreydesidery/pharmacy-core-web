import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { formatCompact } from '../format/format';
import { TranslatePipe } from '../i18n/t.pipe';

export interface ChartPoint {
  label: string;
  value: number;
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  display?: string;
}

export interface BarSeries {
  name: string;
  color: string;
  values: number[];
}

/** The rounded-up axis maximum, such as 2,340 → 2,500. */
export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const mantissa = value / power;
  const step =
    mantissa <= 1 ? 1 : mantissa <= 2 ? 2 : mantissa <= 2.5 ? 2.5 : mantissa <= 5 ? 5 : 10;
  return step * power;
}

/** The host's width as a signal, kept current by a ResizeObserver. */
function observeWidth(fallback: number) {
  const host = inject(ElementRef<HTMLElement>);
  const destroyRef = inject(DestroyRef);
  const width = signal(fallback);
  afterNextRender(() => {
    const element = host.nativeElement as HTMLElement;
    width.set(element.clientWidth || fallback);
    if (typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? fallback);
      if (next > 0 && next !== width()) {
        width.set(next);
      }
    });
    observer.observe(element);
    destroyRef.onDestroy(() => observer.disconnect());
  });
  return width;
}

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block;position:relative' },
  template: `
    @if (geometry(); as g) {
      <svg
        [attr.width]="g.width"
        [attr.height]="height()"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <defs>
          <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--primary)" stop-opacity=".24" />
            <stop offset="1" stop-color="var(--primary)" stop-opacity="0" />
          </linearGradient>
        </defs>
        @for (tick of g.ticks; track tick.y) {
          <line
            [attr.x1]="g.left"
            [attr.x2]="g.right"
            [attr.y1]="tick.y"
            [attr.y2]="tick.y"
            stroke="var(--border)"
          />
          <text
            [attr.x]="g.left - 8"
            [attr.y]="tick.y + 4"
            text-anchor="end"
            font-size="10.5"
            fill="var(--faint)"
          >
            {{ tick.label }}
          </text>
        }
        @for (label of g.labels; track label.x) {
          <text
            [attr.x]="label.x"
            [attr.y]="height() - 6"
            text-anchor="middle"
            font-size="10.5"
            fill="var(--faint)"
          >
            {{ label.text }}
          </text>
        }
        <path [attr.d]="g.area" [attr.fill]="'url(#' + gradientId + ')'" />
        <path
          [attr.d]="g.line"
          fill="none"
          stroke="var(--primary)"
          stroke-width="2.2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        @if (hover(); as h) {
          <line
            [attr.x1]="h.x"
            [attr.x2]="h.x"
            [attr.y1]="g.top"
            [attr.y2]="g.bottom"
            stroke="var(--primary)"
            stroke-dasharray="3 3"
          />
          <circle
            [attr.cx]="h.x"
            [attr.cy]="h.y"
            r="5"
            fill="var(--primary)"
            stroke="var(--surface)"
            stroke-width="2"
          />
        }
        <rect
          [attr.x]="g.left"
          y="0"
          [attr.width]="g.right - g.left"
          [attr.height]="height()"
          fill="transparent"
          (mousemove)="move($event)"
          (mouseleave)="hoverIndex.set(null)"
        />
      </svg>
      @if (hover(); as h) {
        <div class="tip" [style.left.px]="h.tipX" [style.top.px]="h.y - 14">
          <span>{{ h.label }}</span
          ><b>{{ h.text }}</b>
        </div>
      }
    }
  `,
  styles: `
    svg {
      display: block;
      overflow: visible;
    }
    .tip {
      position: absolute;
      pointer-events: none;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 6px 10px;
      font-size: 11.5px;
      box-shadow: var(--shadow);
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      transform: translateY(-100%);
    }
    .tip span {
      color: var(--muted);
    }
  `,
})
export class LineChartComponent {
  private static nextId = 0;
  readonly points = input.required<ChartPoint[]>();
  readonly height = input(240);
  readonly format = input<(value: number) => string>((value) => formatCompact(value));
  readonly ariaLabel = input('Line chart');
  protected readonly gradientId = `line-gradient-${LineChartComponent.nextId++}`;
  private readonly width = observeWidth(600);
  protected readonly hoverIndex = signal<number | null>(null);

  protected readonly geometry = computed(() => {
    const points = this.points();
    const width = Math.max(this.width(), 260);
    const height = this.height();
    const left = 44;
    const right = width - 12;
    const top = 12;
    const bottom = height - 26;
    const max = niceMax(Math.max(1, ...points.map((p) => p.value)) * 1.08);
    const count = Math.max(points.length, 2);
    const x = (i: number) => left + (i * (right - left)) / (count - 1);
    const y = (v: number) => top + (1 - v / max) * (bottom - top);
    const coords = points.map((p, i) => [x(i), y(p.value)] as const);
    const line = coords.length
      ? 'M' + coords.map(([cx, cy]) => `${cx.toFixed(1)},${cy.toFixed(1)}`).join('L')
      : '';
    const area = coords.length
      ? `${line}L${x(coords.length - 1)},${bottom}L${x(0)},${bottom}Z`
      : '';
    const ticks = [0, 1, 2, 3, 4].map((k) => ({
      y: y((max * k) / 4),
      label: formatCompact((max * k) / 4),
    }));
    const step = Math.max(1, Math.ceil(points.length / 6));
    const labels = points
      .map((p, i) => ({ x: x(i), text: p.label, i }))
      .filter((l) => l.i % step === 0 || l.i === points.length - 1);
    return { width, left, right, top, bottom, line, area, ticks, labels, x, y };
  });

  protected readonly hover = computed(() => {
    const index = this.hoverIndex();
    const point = index === null ? undefined : this.points()[index];
    if (index === null || !point) {
      return null;
    }
    const g = this.geometry();
    const px = g.x(index);
    return {
      x: px,
      y: g.y(point.value),
      label: point.label,
      text: this.format()(point.value),
      tipX: px + 160 > g.width ? px - 150 : px + 12,
    };
  });

  protected move(event: MouseEvent): void {
    const g = this.geometry();
    const target = event.currentTarget as SVGRectElement;
    const box = target.getBoundingClientRect();
    const count = Math.max(this.points().length, 2);
    const ratio = (event.clientX - box.left) / Math.max(box.width, 1);
    const index = Math.round(ratio * (count - 1));
    this.hoverIndex.set(Math.min(Math.max(index, 0), this.points().length - 1));
    void g;
  }
}

@Component({
  selector: 'app-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="donut">
      <svg
        [attr.width]="size()"
        [attr.height]="size()"
        viewBox="0 0 160 160"
        role="img"
        [attr.aria-label]="centerLabel()"
      >
        <circle cx="80" cy="80" r="62" fill="none" stroke="var(--surface-2)" stroke-width="20" />
        @for (arc of arcs(); track arc.label) {
          <circle
            cx="80"
            cy="80"
            r="62"
            fill="none"
            [attr.stroke]="arc.color"
            stroke-width="20"
            [attr.stroke-dasharray]="arc.dash"
            [attr.stroke-dashoffset]="arc.offset"
            transform="rotate(-90 80 80)"
          >
            <title>{{ arc.label }}: {{ arc.display }}</title>
          </circle>
        }
        <text x="80" y="74" text-anchor="middle" font-size="11" fill="var(--muted)">
          {{ centerLabel() }}
        </text>
        <text
          x="80"
          y="96"
          text-anchor="middle"
          font-size="18"
          font-weight="700"
          fill="var(--text)"
        >
          {{ centerValue() }}
        </text>
      </svg>
      @if (showLegend()) {
        <ul class="legend">
          @for (segment of segments(); track segment.label) {
            <li>
              <i [style.background]="segment.color"></i>{{ segment.label
              }}<b>{{ segment.display ?? segment.value }}</b>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    .donut {
      display: flex;
      align-items: center;
      gap: 18px;
      flex-wrap: wrap;
    }
    svg {
      flex-shrink: 0;
    }
  `,
})
export class DonutComponent {
  readonly segments = input.required<DonutSegment[]>();
  readonly centerLabel = input('Total');
  readonly centerValue = input('');
  readonly size = input(150);
  readonly showLegend = input(true);

  protected readonly arcs = computed(() => {
    const circumference = 2 * Math.PI * 62;
    const total = this.segments().reduce((sum, s) => sum + Math.max(s.value, 0), 0);
    let offset = 0;
    return this.segments()
      .filter((s) => s.value > 0 && total > 0)
      .map((s) => {
        const length = (s.value / total) * circumference;
        const arc = {
          label: s.label,
          color: s.color,
          display: s.display ?? String(s.value),
          dash: `${Math.max(length - 1.5, 0)} ${circumference - Math.max(length - 1.5, 0)}`,
          offset: -offset,
        };
        offset += length;
        return arc;
      });
  });
}

@Component({
  selector: 'app-bar-chart',
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  template: `
    @if (geometry(); as g) {
      <svg
        [attr.width]="g.width"
        [attr.height]="height()"
        role="img"
        [attr.aria-label]="'ui.chart.bar' | t"
      >
        @for (tick of g.ticks; track tick.y) {
          <line
            [attr.x1]="g.left"
            [attr.x2]="g.right"
            [attr.y1]="tick.y"
            [attr.y2]="tick.y"
            stroke="var(--border)"
          />
          <text
            [attr.x]="g.left - 8"
            [attr.y]="tick.y + 4"
            text-anchor="end"
            font-size="10.5"
            fill="var(--faint)"
          >
            {{ tick.label }}
          </text>
        }
        @for (bar of g.bars; track bar.key) {
          <rect
            [attr.x]="bar.x"
            [attr.y]="bar.y"
            [attr.width]="bar.w"
            [attr.height]="bar.h"
            rx="3"
            [attr.fill]="bar.color"
          >
            <title>{{ bar.title }}</title>
          </rect>
        }
        @for (label of g.labels; track label.key) {
          <text
            [attr.x]="label.x"
            [attr.y]="height() - 6"
            text-anchor="middle"
            font-size="10.5"
            fill="var(--faint)"
          >
            {{ label.text }}
          </text>
        }
      </svg>
    }
  `,
  styles: `
    svg {
      display: block;
    }
  `,
})
export class BarChartComponent {
  readonly labels = input.required<string[]>();
  readonly series = input.required<BarSeries[]>();
  readonly height = input(260);
  private readonly width = observeWidth(600);

  protected readonly geometry = computed(() => {
    const labels = this.labels();
    const series = this.series();
    const width = Math.max(this.width(), 260);
    const height = this.height();
    const left = 48;
    const right = width - 8;
    const top = 10;
    const bottom = height - 26;
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)) * 1.05);
    const y = (v: number) => top + (1 - v / max) * (bottom - top);
    const group = (right - left) / Math.max(labels.length, 1);
    const barWidth = Math.max(3, Math.min(18, (group * 0.72) / Math.max(series.length, 1)));
    const bars = labels.flatMap((label, i) => {
      const centre = left + group * i + group / 2;
      const start = centre - (barWidth * series.length + 2 * (series.length - 1)) / 2;
      return series.map((s, j) => {
        const value = s.values[i] ?? 0;
        return {
          key: `${i}-${j}`,
          x: start + j * (barWidth + 2),
          y: y(value),
          w: barWidth,
          h: Math.max(bottom - y(value), 0),
          color: s.color,
          title: `${s.name} · ${label}: ${formatCompact(value)}`,
        };
      });
    });
    const step = Math.max(1, Math.ceil(labels.length / 12));
    const textLabels = labels
      .map((text, i) => ({ key: i, text, x: left + group * i + group / 2 }))
      .filter((l) => l.key % step === 0);
    const ticks = [0, 1, 2, 3, 4].map((k) => ({
      y: y((max * k) / 4),
      label: formatCompact((max * k) / 4),
    }));
    return { width, left, right, ticks, bars, labels: textLabels };
  });
}

export const CHARTS = [LineChartComponent, DonutComponent, BarChartComponent] as const;

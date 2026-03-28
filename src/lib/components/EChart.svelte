<script lang="ts">
  import { BarChart, HeatmapChart, LineChart, SankeyChart, ScatterChart } from 'echarts/charts.js';
  import { GridComponent, LegendComponent, TooltipComponent, VisualMapComponent } from 'echarts/components.js';
  import { init, use, type ECharts } from 'echarts/core.js';
  import { SVGRenderer } from 'echarts/renderers.js';
  import { onMount } from 'svelte';

  use([
    BarChart,
    HeatmapChart,
    LineChart,
    SankeyChart,
    ScatterChart,
    GridComponent,
    LegendComponent,
    TooltipComponent,
    VisualMapComponent,
    SVGRenderer
  ]);

  export let options: Record<string, unknown>;
  export let height = 360;

  let container: HTMLDivElement;
  let chart: ECharts | null = null;
  let resizeObserver: ResizeObserver | null = null;

  function renderChart(): void {
    if (!container) {
      return;
    }

    if (!chart) {
      chart = init(container, undefined, { renderer: 'svg' });
    }

    chart.setOption(options, true);
  }

  onMount(() => {
    renderChart();

    resizeObserver = new ResizeObserver(() => {
      chart?.resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver?.disconnect();
      chart?.dispose();
      chart = null;
    };
  });

  $: if (chart && options) {
    chart.setOption(options, true);
  }
</script>

<div class="chart-shell" bind:this={container} style={`height:${height}px`}></div>

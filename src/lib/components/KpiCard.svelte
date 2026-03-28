<script lang="ts">
  export let title: string;
  export let value: string;
  export let subtitle = '';
</script>

<div class="kpi-card">
  <div class="kpi-card__title">{title}</div>
  <div class="kpi-card__value">{value}</div>
  {#if subtitle}
    <div class="kpi-card__subtitle">{subtitle}</div>
  {/if}
</div>

<script lang="ts">
  export let title: string;
  export let description = '';
</script>

<section class="section-card">
  <div class="section-card__header">
    <div>
      <h2>{title}</h2>
      {#if description}
        <p>{description}</p>
      {/if}
    </div>
    <slot name="actions" />
  </div>

  <div class="section-card__content">
    <slot />
  </div>
</section>

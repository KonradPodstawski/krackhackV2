<script lang="ts">
  import { onMount } from 'svelte';
  import 'bpmn-js/dist/assets/diagram-js.css';
  import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

  export let xml: string;

  let container: HTMLDivElement;
  let error = '';
  let viewer: any = null;

  async function load(): Promise<void> {
    if (!container || !xml) {
      return;
    }

    const { default: NavigatedViewer } = await import('bpmn-js/lib/NavigatedViewer');

    viewer = new NavigatedViewer({
      container,
      height: 560,
      width: '100%'
    });

    try {
      await viewer.importXML(xml);
      const canvas = viewer.get('canvas');
      canvas.zoom('fit-viewport', 'auto');
      error = '';
    } catch (err) {
      console.error(err);
      error = 'Nie udało się załadować modelu BPMN.';
    }
  }

  onMount(() => {
    void load();

    return () => {
      if (viewer) {
        viewer.destroy();
        viewer = null;
      }
    };
  });
</script>

<div class="bpmn-shell">
  {#if error}
    <div class="bpmn-shell__error">{error}</div>
  {/if}
  <div class="bpmn-shell__canvas" bind:this={container}></div>
</div>

<script>

  import { _ } from 'svelte-i18n'
  import { Stage, Layer, Rect } from '../../../../../../../../node_modules/svelte-konva/dist'
  let { node } = $props()
</script>

<Stage config={{ width: 400, height: 200 }}>
  <!-- <Stage width={400} height={200} config={{ width: 400, height: 200 }}> -->
  <Layer>
    <Rect config={{ x: 50, y: 50, width: 100, height: 100, fill: 'green', draggable: true }} />
    <!-- <Rect x={50} y={50} width={100} height={100} fill="green" draggable /> -->
  </Layer>
</Stage>

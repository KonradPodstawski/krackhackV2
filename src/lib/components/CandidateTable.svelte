<script lang="ts">
  import { formatHours, formatNumber, formatPercent } from '../format';
  import type { AutomationCandidate } from '../types';

  export let items: AutomationCandidate[] = [];
</script>

<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Opportunity</th>
        <th>Priority</th>
        <th>Reach</th>
        <th>Friction signal</th>
        <th>Why now</th>
      </tr>
    </thead>
    <tbody>
      {#each items as item}
        <tr>
          <td>
            <div class="candidate-name">{item.processStep}</div>
            <div class="table-sub">{item.application}</div>
            <span class:operational={item.classification === 'operational'} class="pill">
              {item.classification === 'operational' ? 'operational' : 'context / communication'}
            </span>
          </td>
          <td>
            <div class="score-badge">{item.score.toFixed(1)}</div>
            <div class="table-sub">{formatNumber(item.instances)} instances</div>
          </td>
          <td>
            <div class="metric-stack">
              <strong>{formatHours(item.activeHours)}</strong>
              <span>{formatNumber(item.userCount)} users</span>
            </div>
          </td>
          <td>
            <div class="metric-stack">
              <strong>{formatNumber(item.clipboardOps)} clipboard</strong>
              <span>{formatPercent(item.passiveSharePct)} passive</span>
            </div>
          </td>
          <td>
            <ul class="reason-list">
              {#each item.reasoning as reason}
                <li>{reason}</li>
              {/each}
            </ul>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<script lang="ts">
  import { formatHours, formatNumber, formatPercent } from '../format';
  import type { AutomationCandidate } from '../types';

  type CandidateRow = AutomationCandidate & {
    explainableScore?: number;
    referenceScore?: number;
    explanationSummary?: string[];
    directFit?: boolean;
  };

  export let items: CandidateRow[] = [];
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
              {item.directFit === false
                ? 'watchlist / gated'
                : item.classification === 'operational'
                  ? 'operational'
                  : 'context / communication'}
            </span>
          </td>
          <td>
            <div class="score-badge">{(item.explainableScore ?? item.score).toFixed(1)}</div>
            <div class="table-sub">XAI score</div>
            <div class="table-sub">source score {(item.referenceScore ?? item.score).toFixed(1)}</div>
          </td>
          <td>
            <div class="metric-stack">
              <strong>{formatHours(item.activeHours)}</strong>
              <span>{formatNumber(item.userCount)} users</span>
              <span>{formatNumber(item.instances)} instances</span>
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
              {#each item.explanationSummary ?? item.reasoning as reason}
                <li>{reason}</li>
              {/each}
            </ul>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

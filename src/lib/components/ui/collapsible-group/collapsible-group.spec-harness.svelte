<script lang="ts">
import CollapsibleGroup from './collapsible-group.svelte';

// Test harness: CollapsibleGroup takes a snippet, which a spec cannot build
// from plain JavaScript, so the children live here. The applied state is
// echoed back so a spec can observe what a click wrote through the binding.
let {
	title = 'Filter',
	id = 'group',
	testid = 'group-toggle',
	badge = 0,
	expanded = $bindable(true)
} = $props();
</script>

<CollapsibleGroup title={title} id={id} testid={testid} badge={badge} bind:expanded={expanded}>
	<p data-testid="group-child">Group content</p>
</CollapsibleGroup>

<p data-testid="applied-expanded">{expanded}</p>

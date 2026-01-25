<script lang="ts">
import { Dialog as SheetPrimitive } from 'bits-ui';
import { cn } from '$lib/utils.js';

let {
	ref = $bindable(null),
	class: className,
	...restProps
}: SheetPrimitive.DescriptionProps = $props();
</script>

<SheetPrimitive.Description
	bind:ref={ref}
	data-slot="sheet-description"
	class={cn("text-sm text-muted-foreground", className)}
	{...restProps}
/>

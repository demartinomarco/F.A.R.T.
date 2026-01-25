<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import { cn } from '$lib/utils.js';

let {
	ref = $bindable(null),
	class: className,
	...restProps
}: DialogPrimitive.DescriptionProps = $props();
</script>

<DialogPrimitive.Description
	bind:ref={ref}
	data-slot="dialog-description"
	class={cn("text-sm text-muted-foreground", className)}
	{...restProps}
/>

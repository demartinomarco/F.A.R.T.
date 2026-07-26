<script lang="ts">
import { RadioGroup as RadioGroupPrimitive } from 'bits-ui';
import { cn } from '$lib/utils.js';

let {
	ref = $bindable(null),
	class: className,
	value = $bindable(''),
	...restProps
}: RadioGroupPrimitive.RootProps = $props();
</script>

<RadioGroupPrimitive.Root
	bind:ref={ref}
	bind:value={value}
	data-slot="radio-group"
	class={cn("grid gap-3", className)}
	{...restProps}
/>

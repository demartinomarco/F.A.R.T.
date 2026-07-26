<script lang="ts">
import { translations } from '$lib/i18n';
</script>

<div class="flex flex-row items-center gap-4 bg-[#c30a37] p-4">
	<h1 class="text-2xl font-bold text-white">{$translations.error.title}</h1>
</div>

<div class="p-4">
	{$translations.error.genericMessage}
</div>

<script lang="ts">
import { translations } from '$lib/i18n';
</script>

<article class="space-y-6 p-4">
	<header class="space-y-3">
		<p>{$translations.about.intro}</p>
		<p>{$translations.about.motivation}</p>
		<p>
			<strong>{$translations.about.arrivalColorsLabel}</strong>
			{$translations.about.arrivalColorsDescription}
		</p>
	</header>

	<section aria-labelledby="features" class="space-y-3">
		<h2 id="features" class="text-lg font-semibold">{$translations.about.featuresTitle}</h2>
		<ul class="list-disc space-y-1 pl-5">
			<li><strong>{$translations.about.featureStopSearchLabel}</strong> {$translations.about.featureStopSearchDescription}</li>
			<li><strong>{$translations.about.featureRealtimeLabel}</strong> {$translations.about.featureRealtimeDescription}</li>
			<li><strong>{$translations.about.featurePlatformFilterLabel}</strong> {$translations.about.featurePlatformFilterDescription}</li>
			<li><strong>{$translations.about.featureToggleLabel}</strong> {$translations.about.featureToggleDescription}</li>
			<li><strong>{$translations.about.featureReliabilityLabel}</strong> {$translations.about.featureReliabilityDescription}</li>
		</ul>
	</section>

	<section aria-labelledby="usage" class="space-y-3">
		<h2 id="usage" class="text-lg font-semibold">{$translations.about.howToTitle}</h2>
		<ol class="list-decimal space-y-1 pl-5">
			<li>{$translations.about.howToStep1}</li>
			<li>{$translations.about.howToStep2}</li>
			<li>{$translations.about.howToStep3}</li>
			<li>{$translations.about.howToStep4}</li>
		</ol>
		<p class="text-sm opacity-80">{$translations.about.howToTip}</p>
	</section>

	<section aria-labelledby="reliability" class="space-y-3">
		<h2 id="reliability" class="text-lg font-semibold">{$translations.about.uptimeTitle}</h2>
		<p>{$translations.about.uptimeDescription}</p>
	</section>

	<section aria-labelledby="legal" class="space-y-3">
		<h2 id="legal" class="text-lg font-semibold">{$translations.about.legalTitle}</h2>
		<p>{$translations.about.legalDescription}</p>
	</section>

	<footer>
		<p>
			{$translations.about.sourceCodeLabel}
			<br />
			<a
				href="https://github.com/demartinomarco/F.A.R.T."
				class="underline"
				target="_blank"
				rel="noopener noreferrer"
			>
				https://github.com/demartinomarco/F.A.R.T.
			</a>
		</p>
	</footer>
</article>

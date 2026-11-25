<!-- [bd-file:store] -->
<script setup lang="ts">
/** One option group (Size, Colour…): a button per value, the chosen value's name beside the title. */
import type { OptionGroup } from "#shared/bd/shop";

defineProps<{ group: OptionGroup; chosen?: string }>();
const emit = defineEmits<{ pick: [valueId: string] }>();
</script>

<template>
	<fieldset class="choice">
		<legend class="bd-label">
			{{ group.title }}
			<span v-if="chosen" class="choice__picked">
				{{ group.values.find((v) => v.id === chosen)?.value }}
			</span>
		</legend>
		<div class="choice__values">
			<button
				v-for="value in group.values"
				:key="value.id"
				type="button"
				class="choice__value"
				:class="{ 'choice__value--on': chosen === value.id }"
				:aria-pressed="chosen === value.id"
				:disabled="!value.available"
				:title="value.available ? undefined : 'Sold out'"
				@click="emit('pick', value.id)"
			>
				{{ value.value }}
			</button>
		</div>
	</fieldset>
</template>

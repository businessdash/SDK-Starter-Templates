<!-- [bd-file:store] -->
<script setup lang="ts">
/**
 * The applied coupon with Remove, or a code box with Apply. `apply` sends a
 * code and says whether it took; the box empties when it did.
 */
import { ref } from "vue";

const props = withDefaults(
	defineProps<{ code?: string | null; busy?: boolean; apply: (code: string) => Promise<boolean> }>(),
	{ code: null, busy: false },
);
const emit = defineEmits<{ remove: [] }>();
const typed = ref("");

async function submit() {
	if (!typed.value.trim()) return;
	if (await props.apply(typed.value.trim())) typed.value = "";
}
</script>

<template>
	<div class="cart__coupon">
		<template v-if="code">
			<span class="bd-badge">Coupon: {{ code }}</span>
			<button class="bd-btn bd-btn--ghost" :disabled="busy" type="button" @click="emit('remove')">
				Remove coupon
			</button>
		</template>
		<template v-else>
			<input v-model="typed" class="bd-input" placeholder="Coupon code" />
			<button
				class="bd-btn bd-btn--ghost"
				:disabled="busy || !typed.trim()"
				type="button"
				@click="submit"
			>
				Apply
			</button>
		</template>
	</div>
</template>

<!-- [bd-file:store] -->
<script lang="ts">
	/** The search box; `onSearch` gets what was typed (trimmed) when it's sent. */
	let { value = '', onSearch }: { value?: string; onSearch: (q: string) => void } = $props();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		onSearch(String(fd.get('q') ?? '').trim());
	}
</script>

<form onsubmit={submit}>
	<label class="bd-label" for="store-search">Search</label>
	<input
		id="store-search"
		class="bd-input"
		type="search"
		name="q"
		placeholder="Search products…"
		{value}
		autocomplete="off"
	/>
</form>

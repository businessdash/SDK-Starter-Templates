// [bd-file:store]
import { ChangeDetectionStrategy, Component, effect, input, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, distinctUntilChanged } from "rxjs";

/** The search box; `search` fires as typing pauses. */
@Component({
	selector: "bd-store-search",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	styles: ":host { display: contents; }",
	template: `
		<div role="search">
			<label class="bd-label" for="store-search">Search</label>
			<input
				autocomplete="off"
				class="bd-input"
				id="store-search"
				placeholder="Search products…"
				type="search"
				[formControl]="control"
			/>
		</div>
	`,
})
export class StoreSearchComponent {
	readonly value = input("");
	readonly search = output<string>();
	readonly control = new FormControl("", { nonNullable: true });
	/** What this last told the page, so it follows only the page's own changes. */
	#sent = "";

	constructor() {
		// Follow the page (a shared link, Clear all filters), not what's being typed.
		effect(() => {
			const value = this.value();
			if (value === this.#sent) return;
			this.#sent = value;
			this.control.setValue(value, { emitEvent: false });
		});
		this.control.valueChanges
			.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
			.subscribe((value) => {
				this.#sent = value.trim();
				this.search.emit(this.#sent);
			});
	}
}

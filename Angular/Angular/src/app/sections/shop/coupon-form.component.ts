// [bd-file:store]
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";

/** The cart's coupon: a code box with Apply, and Remove for the applied code. */
@Component({
	selector: "bd-coupon-form",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule],
	styles: ":host { display: contents; }",
	template: `
		<form class="coupon" [formGroup]="form" (ngSubmit)="submit()">
			<label>
				Coupon
				<input formControlName="code" placeholder="Code" />
			</label>
			<button class="bd-btn bd-btn--ghost" type="submit" [disabled]="form.invalid">Apply</button>
			@if (code()) {
				<button class="bd-btn bd-btn--ghost" type="button" (click)="remove.emit()">Remove “{{ code() }}”</button>
			}
		</form>
	`,
})
export class CouponFormComponent {
	/** The applied code, if there is one. */
	readonly code = input<string | null>(null);
	readonly apply = output<string>();
	readonly remove = output();

	readonly form = new FormGroup({
		code: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
	});

	submit() {
		const code = this.form.controls.code.value.trim();
		if (code) this.apply.emit(code);
	}
}

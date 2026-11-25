// [bd-file:store]
import { el } from "/bd.js";

/**
 * The cart's coupon: a code box with Apply, or the applied code with
 * Remove. `onApply(code)` returns a promise; when it fails, its message
 * shows ("Invalid code").
 */
export function couponForm(couponCode, { onApply, onRemove }) {
	if (couponCode) {
		return el("div", { class: "coupon coupon--applied" }, [
			el("span", {}, [`Coupon ${couponCode} applied`]),
			el("button", { class: "btn btn--ghost btn--sm", type: "button", onClick: () => onRemove() }, ["Remove"]),
		]);
	}
	const input = el("input", {
		class: "coupon__input",
		type: "text",
		placeholder: "Coupon code",
		"aria-label": "Coupon code",
	});
	const msg = el("span", { class: "coupon__msg" }, []);
	const apply = el(
		"button",
		{
			class: "btn btn--ghost btn--sm",
			type: "button",
			onClick: async () => {
				const code = input.value.trim();
				if (!code) return;
				msg.textContent = "Applying…";
				try {
					await onApply(code);
				} catch (err) {
					msg.textContent = err?.message ?? "Invalid code";
				}
			},
		},
		["Apply"],
	);
	return el("div", { class: "coupon" }, [input, apply, msg]);
}

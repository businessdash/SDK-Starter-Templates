// [bd-file:ordering]
/**
 * The vegetarian / vegan mark menus print beside a dish. Vegan wins when a
 * dish is both, since it says more.
 */
export function DietMark({ flags }: { flags: readonly string[] }) {
	if (flags.includes("vegan")) {
		return (
			<span className="order-diet order-diet--vegan" title="Vegan">
				VG
			</span>
		);
	}
	if (flags.includes("vegetarian")) {
		return (
			<span className="order-diet order-diet--veg" title="Vegetarian">
				V
			</span>
		);
	}
	return null;
}

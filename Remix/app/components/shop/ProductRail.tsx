// [bd-file:store]
import { BdLink } from "../bd-link";
import { formatCents, type SavedProduct } from "./shop";

/** A row of small product cards: related products, recently viewed. */
export function ProductRail({
	title,
	products,
}: {
	title: string;
	products: SavedProduct[];
}) {
	if (products.length === 0) return null;
	return (
		<section className="product-rail">
			<h2 className="product-rail__title">{title}</h2>
			<ul className="product-rail__row">
				{products.map((product) => (
					<li key={product.id}>
						<BdLink
							className="bd-card product-rail__card"
							href={`/store/${product.id}`}
						>
							{product.image ? (
								<img
									alt=""
									loading="lazy"
									referrerPolicy="no-referrer"
									src={product.image}
								/>
							) : (
								<span aria-hidden="true" className="product-rail__noimg" />
							)}
							<span className="product-rail__name">{product.name}</span>
							{product.priceCents != null && (
								<span className="product-rail__price">
									{formatCents(product.priceCents)}
								</span>
							)}
						</BdLink>
					</li>
				))}
			</ul>
		</section>
	);
}

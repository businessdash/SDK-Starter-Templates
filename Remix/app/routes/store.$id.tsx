import {
	Form,
	Link,
	useActionData,
	useLoaderData,
	useNavigation,
} from "react-router";
import { redirect } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import { formatCents } from "~/lib/format";
import {
	addToCart,
	getCartSnapshot,
	getStoreProduct,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
} from "~/lib/biab-store.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: data?.product ? `${data.product.name} — Store` : "Product" },
];

export async function loader({ params, request }: LoaderFunctionArgs) {
	const id = params["id"]!;
	const [product, reviews, related, addons, cart] = await Promise.all([
		getStoreProduct(id),
		getStoreProductReviews(id),
		getStoreRelatedProducts(id),
		getStoreProductAddons(id),
		getCartSnapshot(request),
	]);
	if (!product) {
		return { product: null, cartCount: cart?.itemCount ?? 0 } as const;
	}
	const extra = product as Record<string, unknown>;
	const variants = Array.isArray(product.variants) ? product.variants : [];
	return {
		product: {
			id: product.id,
			name: product.name,
			description:
				typeof extra["description"] === "string"
					? (extra["description"] as string)
					: "",
			image:
				Array.isArray(product.images) && product.images[0]
					? product.images[0]
					: null,
			priceLabel:
				typeof extra["priceCents"] === "number"
					? formatCents(extra["priceCents"] as number)
					: null,
			variants: variants.map((v) => {
				const vv = v as Record<string, unknown>;
				return {
					id: typeof vv["id"] === "string" ? (vv["id"] as string) : "",
					title:
						typeof vv["title"] === "string"
							? (vv["title"] as string)
							: "Default",
				};
			}),
		},
		reviews: reviews
			? {
					avgRating: reviews.avgRating,
					totalCount: reviews.totalCount,
					items: reviews.items.map((r) => ({
						id: r.id,
						rating: r.rating,
						reviewerName: r.reviewerName ?? "Customer",
						text: r.body ?? r.content ?? "",
						title: r.title ?? null,
					})),
				}
			: null,
		related: (related ?? []).map((r) => ({
			id: r.id,
			name: r.name,
			image: r.coverImageUrl,
			priceLabel:
				r.minPriceDollars != null
					? formatCents(Math.round(r.minPriceDollars * 100))
					: "View",
		})),
		addons: (addons?.items ?? []).map((a) => ({
			id: a.id,
			productId: a.addonProductId,
			name: a.addonName,
			description: a.addonDescription,
			groupLabel: a.groupLabel,
			image: a.imageUrl,
			priceLabel: a.priceCents != null ? formatCents(a.priceCents) : null,
		})),
		cartCount: cart?.itemCount ?? 0,
	} as const;
}

export async function action({ params, request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const variantId = (fd.get("variantId") as string) || null;
	const quantity = Number.parseInt(String(fd.get("quantity") ?? "1"), 10) || 1;
	const result = await addToCart(request, {
		productId: params["id"]!,
		variantId,
		quantity,
	});
	if (!result.ok) return { ok: false as const, error: result.error };
	// On success, redirect to the cart (carrying the visitor cookie if minted).
	const headers = new Headers();
	if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
	return redirect("/store/cart", { headers });
}

export default function ProductDetail() {
	const { product, reviews, related, addons, cartCount } =
		useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const nav = useNavigation();
	const adding = nav.state === "submitting";

	if (!product) {
		return (
			<>
				<SiteHeader cartCount={cartCount} />
				<main>
					<section className="section">
						<p className="muted">Product not found.</p>
						<Link className="muted" to="/store">
							← Back to store
						</Link>
					</section>
				</main>
			</>
		);
	}

	return (
		<>
			<SiteHeader cartCount={cartCount} />
			<main>
				<section className="section">
					<Link className="muted" to="/store">
						← Back to store
					</Link>
					<div className="product">
						{product.image ? (
							<img
								className="product__img"
								src={product.image}
								alt={product.name}
							/>
						) : null}
						<div>
							<h1 className="section__title">{product.name}</h1>
							{product.priceLabel ? (
								<p className="price price--lg">{product.priceLabel}</p>
							) : null}
							{reviews && reviews.totalCount > 0 ? (
								<p className="reviews-agg">
									<span className="stars">
										{"★".repeat(Math.round(reviews.avgRating))}
									</span>{" "}
									<strong>{reviews.avgRating.toFixed(1)}</strong> ·{" "}
									{reviews.totalCount} review
									{reviews.totalCount === 1 ? "" : "s"}
								</p>
							) : null}
							{product.description ? <p>{product.description}</p> : null}
							<Form method="post">
								{product.variants.length > 1 ? (
									<label>
										Option
										<select name="variantId">
											{product.variants.map((v) => (
												<option value={v.id} key={v.id}>
													{v.title}
												</option>
											))}
										</select>
									</label>
								) : product.variants[0] ? (
									<input
										type="hidden"
										name="variantId"
										value={product.variants[0].id}
									/>
								) : null}
								<label>
									Quantity
									<input type="number" name="quantity" min={1} defaultValue={1} />
								</label>
								<button className="biab-btn" type="submit" disabled={adding}>
									{adding ? "Adding…" : "Add to cart"}
								</button>
								{actionData && actionData.ok === false ? (
									<p className="error">{actionData.error}</p>
								) : null}
							</Form>
						</div>
					</div>

					{/* Companion / cross-sell addons ("complete your X"). */}
					{addons.length > 0 ? (
						<>
							<h2 className="section__subtitle">Complete your order</h2>
							<ul className="addon-list">
								{addons.map((a) => (
									<li className="addon" key={a.id}>
										{a.image ? <img src={a.image} alt={a.name} /> : null}
										<div className="addon__body">
											{a.groupLabel ? (
												<span className="addon__group">{a.groupLabel}</span>
											) : null}
											<div>
												<Link to={`/store/${a.productId}`}>
													<strong>{a.name}</strong>
												</Link>
											</div>
											{a.description ? (
												<p className="muted">{a.description}</p>
											) : null}
										</div>
										{a.priceLabel ? (
											<span className="price">{a.priceLabel}</span>
										) : null}
									</li>
								))}
							</ul>
						</>
					) : null}

					{/* Customer reviews. */}
					{reviews && reviews.items.length > 0 ? (
						<>
							<h2 className="section__subtitle">Reviews</h2>
							<ul className="review-list">
								{reviews.items.map((r) => (
									<li className="review" key={r.id}>
										<div className="review__head">
											<strong>{r.reviewerName}</strong>
											<span className="stars">
												{"★".repeat(Math.round(r.rating))}
											</span>
										</div>
										{r.title ? <strong>{r.title}</strong> : null}
										{r.text ? <p>{r.text}</p> : null}
									</li>
								))}
							</ul>
						</>
					) : null}

					{/* You may also like. */}
					{related.length > 0 ? (
						<>
							<h2 className="section__subtitle">You may also like</h2>
							<div className="grid">
								{related.map((r) => (
									<Link
										className="card card--link"
										to={`/store/${r.id}`}
										key={r.id}
									>
										{r.image ? (
											<img className="card__img" src={r.image} alt={r.name} />
										) : null}
										<h3>{r.name}</h3>
										<span className="price">{r.priceLabel}</span>
									</Link>
								))}
							</div>
						</>
					) : null}
				</section>
			</main>
		</>
	);
}

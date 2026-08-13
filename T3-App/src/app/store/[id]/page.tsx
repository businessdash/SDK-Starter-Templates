import Link from "next/link";

import { getStoreProduct } from "@/server/lib/biab-store";

import { AddToCart } from "../_components/AddToCart";
import { Notice } from "../_components/Notice";
import { asString, firstImage, toVariant } from "../_components/store-utils";

export const dynamic = "force-dynamic";

export default async function ProductPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const product = await getStoreProduct(id);

	if (!product) {
		return (
			<div>
				<Notice
					body={`storefront.getProduct("${id}") returned nothing (not found, not live, or the SDK call failed).`}
					title="Product unavailable"
				/>
				<p style={{ marginTop: "1rem" }}>
					<Link href="/store">← Back to products</Link>
				</p>
			</div>
		);
	}

	const img = firstImage(product.images);
	const desc = asString((product as Record<string, unknown>).description);
	const variants = (product.variants ?? [])
		.map(toVariant)
		.filter((v) => v.isLive);

	return (
		<div className="store-detail">
			<div className="store-detail__media biab-card">
				{img ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img alt={product.name} src={img} />
				) : (
					<span className="store-card__noimg">No image</span>
				)}
			</div>

			<div className="store-detail__info">
				<Link className="store-detail__back" href="/store">
					← Products
				</Link>
				<h1 className="biab-section__title">{product.name}</h1>
				{desc ? <p className="biab-section__sub">{desc}</p> : null}

				{variants.length === 0 ? (
					<Notice
						body={`No live variants on this product. (Detail returned ${(product.variants ?? []).length} variant(s) total.)`}
						title="Nothing to add"
					/>
				) : (
					<AddToCart productId={product.id} variants={variants} />
				)}
			</div>
		</div>
	);
}

// [bd-file:store]
"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

import { CompareTable } from "@/app/_components/bd/shop/CompareTable";

/** The shared compare table; changing the products changes the URL. */
export function CompareClient(
	props: Omit<ComponentProps<typeof CompareTable>, "onIdsChange">,
) {
	const router = useRouter();
	return (
		<CompareTable
			{...props}
			onIdsChange={(ids) =>
				router.replace(
					ids.length > 0
						? `/store/compare?ids=${ids.join(",")}`
						: "/store/compare",
					{
						scroll: false,
					},
				)
			}
		/>
	);
}

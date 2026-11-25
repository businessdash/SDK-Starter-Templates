// [bd-file:blog]
import { BdFooter } from "@/app/_components/bd/Footer";
import { BdHeader } from "@/app/_components/bd/Header";

/** Every page under /blog: the site header and footer around the posts. */
export default function BlogLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<BdHeader />
			<main className="bd-section">{children}</main>
			<BdFooter />
		</>
	);
}

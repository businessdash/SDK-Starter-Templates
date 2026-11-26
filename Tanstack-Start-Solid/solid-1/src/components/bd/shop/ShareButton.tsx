// [bd-file:store]
/** ↗ Share: the share sheet, or the link copied ("Link copied"). */
export function ShareButton(props: { title: string }) {
	return (
		<bd-share attr:data-title={props.title}>
			<button class="share" data-bd-share type="button">
				<span aria-hidden="true">↗</span> Share
			</button>
			{/* biome-ignore lint/a11y/useSemanticElements: says the link was copied; not the result of a calculation (<output>) */}
			<span class="share__note" data-bd-share-note hidden role="status" />
		</bd-share>
	);
}

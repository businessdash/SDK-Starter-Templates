<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * The blog: posts newest first (pinned ones lead), filtered by category or
 * tag, with "Older posts" paging. Filters live in the URL (?category,
 * ?tag, ?cursor), and the list is fetched on the server. The page is laid
 * out from the blog's parts in `components/bd/blog/`: the filters and a post
 * card per post.
 */
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BlogFilters from "~/components/bd/blog/BlogFilters.vue";
import PostCard from "~/components/bd/blog/PostCard.vue";
import type { BlogIndexResult } from "../../../server/api/bd/blog/posts.get";

const route = useRoute();
const param = (key: string) =>
	typeof route.query[key] === "string" ? (route.query[key] as string) : "";
const categoryId = computed(() => param("category"));
const tag = computed(() => param("tag"));
const paged = computed(() => param("cursor") !== "");

const { data } = await useFetch<BlogIndexResult>("/api/bd/blog/posts", {
	query: computed(() => ({
		...(categoryId.value ? { category: categoryId.value } : {}),
		...(tag.value ? { tag: tag.value } : {}),
		...(paged.value ? { cursor: param("cursor") } : {}),
	})),
});

const activeCategory = computed(() =>
	data.value?.categories.find((c) => c.id === categoryId.value),
);

/** This page with one filter changed and the paging reset. */
function filterLink(key: "category" | "tag", value: string | null) {
	const query: Record<string, string> = {};
	if (categoryId.value) query.category = categoryId.value;
	if (tag.value) query.tag = tag.value;
	if (value) query[key] = value;
	else delete query[key];
	return { path: "/blog", query };
}

useHead(() => ({
	title: activeCategory.value ? `${activeCategory.value.name} · Blog` : "Blog — Your Business",
	meta: [{ name: "description", content: "News, guides and stories from the team." }],
}));
</script>

<template>
	<div>
		<BdHeader />
		<main class="bd-section">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Blog</span>
				<h1 class="bd-section__title">{{ activeCategory?.name ?? "From the blog" }}</h1>
				<p v-if="activeCategory?.description" class="bd-section__sub">
					{{ activeCategory.description }}
				</p>
			</div>

			<BlogFilters
				v-if="data"
				:categories="data.categories"
				:tags="data.tags"
				:category="categoryId"
				:tag="tag"
				:link="filterLink"
			/>

			<div v-if="!data?.posts.length" class="bd-empty">
				{{
					tag || categoryId
						? "No posts here yet."
						: "No posts published yet. Write one in Business Dash and it'll appear here."
				}}
			</div>
			<template v-else>
				<ul class="posts">
					<PostCard
						v-for="(post, i) in data.posts"
						:key="post.id"
						:post="post"
						:lead="i === 0 && !paged"
					/>
				</ul>
				<p v-if="data.nextCursor !== null" class="posts__more">
					<NuxtLink
						class="bd-btn bd-btn--ghost"
						:to="{ path: '/blog', query: { ...route.query, cursor: String(data.nextCursor) } }"
					>
						Older posts
					</NuxtLink>
				</p>
			</template>
		</main>
		<BdFooter />
	</div>
</template>

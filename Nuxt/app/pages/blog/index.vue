<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * The blog: posts newest first (pinned ones lead), filtered by category or
 * tag, with "Older posts" paging. Filters live in the URL (?category,
 * ?tag, ?cursor), and the list is fetched on the server.
 */
import { computed } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import { formatPostDate, readingMinutes } from "#shared/bd/blog";
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

			<nav
				v-if="data && (data.categories.length > 0 || data.tags.length > 0)"
				class="blog-filters"
				aria-label="Blog topics"
			>
				<ul v-if="data.categories.length > 0">
					<li>
						<NuxtLink :to="filterLink('category', null)" :aria-current="!categoryId">All</NuxtLink>
					</li>
					<li v-for="category in data.categories" :key="category.id">
						<NuxtLink
							:to="filterLink('category', category.id)"
							:aria-current="categoryId === category.id"
						>
							{{ category.name }}
						</NuxtLink>
					</li>
				</ul>
				<ul v-if="data.tags.length > 0" class="blog-filters__tags">
					<li v-for="t in data.tags" :key="t">
						<NuxtLink :to="filterLink('tag', tag === t ? null : t)" :aria-current="tag === t">
							#{{ t }}
						</NuxtLink>
					</li>
				</ul>
			</nav>

			<div v-if="!data?.posts.length" class="bd-empty">
				{{
					tag || categoryId
						? "No posts here yet."
						: "No posts published yet. Write one in Business Dash and it'll appear here."
				}}
			</div>
			<template v-else>
				<ul class="posts">
					<li
						v-for="(post, i) in data.posts"
						:key="post.id"
						class="bd-card post-card"
						:class="{ 'post-card--lead': i === 0 && !paged }"
					>
						<NuxtLink :to="`/blog/${post.slug}`" class="post-card__link">
							<img
								v-if="post.imageUrl"
								class="post-card__img"
								:src="post.imageUrl"
								alt=""
								loading="lazy"
								referrerpolicy="no-referrer"
							/>
							<div class="post-card__body">
								<p class="post-card__meta">
									<span v-if="post.isPinned" class="bd-badge">Pinned</span>
									<span>{{ formatPostDate(post.publishedAt) }}</span>
									<span>· {{ readingMinutes(post.content || post.excerpt || "") }} min read</span>
								</p>
								<h2>{{ post.title }}</h2>
								<p v-if="post.excerpt" class="post-card__excerpt">{{ post.excerpt }}</p>
								<p v-if="post.authorName" class="post-card__author">{{ post.authorName }}</p>
							</div>
						</NuxtLink>
					</li>
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

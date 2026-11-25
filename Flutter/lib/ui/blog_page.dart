import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'bd_scope.dart';
import 'post_page.dart';
import 'shop_parts.dart';

const _pageSize = 12;

/// The blog: category and tag filters, pinned posts first, older posts on
/// demand. The API filters by category only, so a tag is matched here, over
/// the newest 50 posts — the same rule as the web, Swift and React Native
/// starters.
class BlogTab extends StatefulWidget {
  const BlogTab({super.key});

  @override
  State<BlogTab> createState() => _BlogTabState();
}

class _BlogTabState extends State<BlogTab> {
  BdClient? _client;
  List<BlogCategory> _categories = const [];
  List<String> _tags = const [];
  String? _categoryId;
  String? _tag;

  List<BlogPost>? _posts;
  bool _failed = false;
  int? _cursor;
  bool _loadingMore = false;
  int _ticket = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    if (client == null) return;
    client.blogCategories().then((items) {
      if (mounted) setState(() => _categories = items);
    }, onError: (Object _) {});
    client.blogTags().then((items) {
      if (mounted) setState(() => _tags = items);
    }, onError: (Object _) {});
    _load();
  }

  Future<void> _load() async {
    final client = _client;
    if (client == null) return;
    final ticket = ++_ticket;
    final tag = _tag;
    setState(() {
      _posts = null;
      _failed = false;
    });
    try {
      final page = await client.blogPage(limit: tag != null ? 50 : _pageSize, categoryId: _categoryId);
      if (!mounted || ticket != _ticket) return;
      final matched = page.items.where((post) => tag == null || post.tags.contains(tag));
      setState(() {
        // Pinned first; the rest keep their order.
        _posts = [...matched.where((post) => post.isPinned), ...matched.where((post) => !post.isPinned)];
        _cursor = tag != null ? null : page.nextCursor;
      });
    } on Exception {
      if (mounted && ticket == _ticket) setState(() => _failed = true);
    }
  }

  Future<void> _loadOlder() async {
    final client = _client;
    final posts = _posts;
    final cursor = _cursor;
    if (client == null || posts == null || cursor == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await client.blogPage(limit: _pageSize, cursor: cursor, categoryId: _categoryId);
      if (!mounted) return;
      final shown = posts.map((post) => post.id).toSet();
      setState(() {
        _posts = [...posts, ...page.items.where((post) => !shown.contains(post.id))];
        _cursor = page.nextCursor;
      });
    } on Exception {
      // The button stays; trying again is the answer.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final active = _categories.where((category) => category.id == _categoryId).firstOrNull;
    final posts = _posts;
    final filtered = _categoryId != null || _tag != null;
    return Scaffold(
      appBar: AppBar(title: Text(active?.name ?? 'Blog')),
      body: _client == null
          ? const Center(child: Text("The blog isn't connected yet."))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                if (_categories.isNotEmpty)
                  _Chips(
                    children: [
                      ChoiceChip(
                        label: const Text('All'),
                        selected: _categoryId == null,
                        onSelected: (_) => setState(() {
                          _categoryId = null;
                          _load();
                        }),
                      ),
                      for (final category in _categories)
                        ChoiceChip(
                          label: Text(category.name),
                          selected: _categoryId == category.id,
                          onSelected: (_) => setState(() {
                            _categoryId = category.id;
                            _load();
                          }),
                        ),
                    ],
                  ),
                if (_tags.isNotEmpty)
                  _Chips(
                    children: [
                      for (final tag in _tags)
                        FilterChip(
                          label: Text('#$tag'),
                          selected: _tag == tag,
                          showCheckmark: false,
                          onSelected: (_) => setState(() {
                            _tag = _tag == tag ? null : tag;
                            _load();
                          }),
                        ),
                    ],
                  ),
                if (active?.description?.isNotEmpty ?? false)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(active!.description!, style: theme.textTheme.bodyMedium?.copyWith(color: theme.hintColor)),
                  ),
                if (_failed)
                  const _Empty("The blog isn't available right now. Please check back soon.")
                else if (posts == null)
                  const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
                else if (posts.isEmpty)
                  _Empty('No posts here yet', detail: filtered ? 'Try another topic.' : null)
                else ...[
                  for (final post in posts) _PostCard(post: post),
                  if (_cursor != null)
                    OutlinedButton(
                      onPressed: _loadingMore ? null : _loadOlder,
                      child: Text(_loadingMore ? 'Loading…' : 'Older posts'),
                    ),
                ],
              ],
            ),
    );
  }
}

class _Chips extends StatelessWidget {
  const _Chips({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(spacing: 8, children: children),
        ),
      );
}

class _Empty extends StatelessWidget {
  const _Empty(this.title, {this.detail});

  final String title;
  final String? detail;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          spacing: 6,
          children: [
            Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleMedium),
            if (detail != null) Text(detail!, textAlign: TextAlign.center),
          ],
        ),
      );
}

class _PostCard extends StatelessWidget {
  const _PostCard({required this.post});

  final BlogPost post;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = theme.textTheme.bodySmall?.copyWith(color: theme.hintColor);
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => PostPage(slug: post.slug))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          spacing: 6,
          children: [
            if (post.imageUrl?.isNotEmpty ?? false)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: AspectRatio(aspectRatio: 16 / 9, child: Photo(post.imageUrl)),
              ),
            if (post.isPinned)
              Text('Pinned', style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary)),
            Text(post.title, style: theme.textTheme.titleMedium),
            if (post.excerpt?.isNotEmpty ?? false) Text(post.excerpt!, maxLines: 3, overflow: TextOverflow.ellipsis),
            Text('${PostHtml.date(post.publishedAt)} · ${PostHtml.readingMinutes(post.content)} min read', style: muted),
          ],
        ),
      ),
    );
  }
}

import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'bd_scope.dart';
import 'blog_parts.dart';
import 'shop_parts.dart';

const _pageSize = 12;

/// The blog: category and tag filters, pinned posts first, older posts on
/// demand. The API filters by category only, so a tag is matched here, over
/// the newest 50 posts — the same rule as the web, Swift and React Native
/// starters.
///
/// It's laid out from [BlogFilters] and a [PostCard] per post
/// (blog_parts.dart).
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
      final page = await client.blogPage(
          limit: tag != null ? 50 : _pageSize, categoryId: _categoryId);
      if (!mounted || ticket != _ticket) return;
      final matched =
          page.items.where((post) => tag == null || post.tags.contains(tag));
      setState(() {
        // Pinned first; the rest keep their order.
        _posts = [
          ...matched.where((post) => post.isPinned),
          ...matched.where((post) => !post.isPinned)
        ];
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
      final page = await client.blogPage(
          limit: _pageSize, cursor: cursor, categoryId: _categoryId);
      if (!mounted) return;
      final shown = posts.map((post) => post.id).toSet();
      setState(() {
        _posts = [
          ...posts,
          ...page.items.where((post) => !shown.contains(post.id))
        ];
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
    final active =
        _categories.where((category) => category.id == _categoryId).firstOrNull;
    final posts = _posts;
    final filtered = _categoryId != null || _tag != null;
    return Scaffold(
      appBar: AppBar(title: Text(active?.name ?? 'Blog')),
      body: _client == null
          ? const Center(child: Text("The blog isn't connected yet."))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
              children: [
                BlogFilters(
                  categories: _categories,
                  tags: _tags,
                  categoryId: _categoryId,
                  tag: _tag,
                  onCategory: (id) => setState(() {
                    _categoryId = id;
                    _load();
                  }),
                  onTag: (tag) => setState(() {
                    _tag = tag;
                    _load();
                  }),
                ),
                if (active?.description?.isNotEmpty ?? false)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(active!.description!,
                        style: theme.textTheme.bodyMedium
                            ?.copyWith(color: theme.hintColor)),
                  ),
                if (_failed)
                  const EmptyNote(
                      "The blog isn't available right now. Please check back soon.")
                else if (posts == null)
                  const Padding(
                      padding: EdgeInsets.all(32),
                      child: Center(child: CircularProgressIndicator()))
                else if (posts.isEmpty)
                  EmptyNote('No posts here yet',
                      detail: filtered ? 'Try another topic.' : null)
                else ...[
                  for (final post in posts) PostCard(post: post),
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

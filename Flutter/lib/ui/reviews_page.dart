import 'package:businessdash_sdk/businessdash_sdk.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';

import 'bd_scope.dart';
import 'review_parts.dart';
import 'shop_parts.dart';

/// The business's reviews: the rating and a bar per star over all of them,
/// a filter by platform, the reviews a page at a time, and "Write a review"
/// for a signed-in customer.
///
/// It's laid out from the parts in review_parts.dart: [ReviewSummaryCard]
/// (with [ReviewWriter]), [ReviewSourceFilter] and a [ReviewCard] per review.
class ReviewsPage extends StatefulWidget {
  const ReviewsPage({super.key});

  @override
  State<ReviewsPage> createState() => _ReviewsPageState();
}

class _ReviewsPageState extends State<ReviewsPage> {
  BdClient? _client;
  ReviewTotals? _totals;
  List<String> _sources = const [];
  String? _source;

  List<Review>? _reviews;
  int? _nextOffset;
  int _total = 0;
  bool _failed = false;
  bool _loadingMore = false;
  int _ticket = 0;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final client = BdScope.of(context).client;
    if (client == _client) return;
    _client = client;
    if (client == null) return;
    client.reviewTotals().then((totals) {
      if (mounted) setState(() => _totals = totals);
    }, onError: (Object _) {});
    _load();
  }

  Future<void> _load() async {
    final client = _client;
    if (client == null) return;
    final ticket = ++_ticket;
    final source = _source;
    setState(() {
      _reviews = null;
      _failed = false;
    });
    try {
      final page = await client.reviewPage(source: source);
      if (!mounted || ticket != _ticket) return;
      setState(() {
        _reviews = page.items;
        _nextOffset = page.nextOffset;
        _total = page.totalCount;
        // The platforms come from the unfiltered list, and stay put while
        // one is picked.
        if (source == null) _sources = Reviews.sourcesIn(page.items);
      });
    } on Exception {
      if (mounted && ticket == _ticket) setState(() => _failed = true);
    }
  }

  Future<void> _loadMore() async {
    final client = _client;
    final reviews = _reviews;
    final offset = _nextOffset;
    if (client == null || reviews == null || offset == null) return;
    setState(() => _loadingMore = true);
    try {
      final page = await client.reviewPage(offset: offset, source: _source);
      if (!mounted) return;
      final shown = reviews.map((review) => review.id).toSet();
      setState(() {
        _reviews = [...reviews, ...page.items.where((review) => !shown.contains(review.id))];
        _nextOffset = page.nextOffset;
      });
    } on Exception {
      // The button stays; trying again is the answer.
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reviews = _reviews;
    return Scaffold(
      appBar: AppBar(title: const Text('Reviews')),
      body: _client == null
          ? const Center(child: Text('Not connected to BD.'))
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                ReviewSummaryCard(summary: Reviews.summarize(_totals, fallbackTotal: _total)),
                const SizedBox(height: 16),
                if (_sources.length > 1 || _source != null)
                  ReviewSourceFilter(
                    sources: _sources,
                    selected: _source,
                    onSelect: (source) => setState(() {
                      _source = source;
                      _load();
                    }),
                  ),
                const SizedBox(height: 8),
                if (_failed)
                  const EmptyNote("Reviews aren't available right now. Please check back soon.")
                else if (reviews == null)
                  const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
                else if (reviews.isEmpty)
                  const EmptyNote('No reviews yet', detail: "Write one in Business Dash and it'll appear here.")
                else ...[
                  for (final review in reviews) ReviewCard(review: review),
                  if (_nextOffset != null)
                    OutlinedButton(
                      onPressed: _loadingMore ? null : _loadMore,
                      child: Text(_loadingMore ? 'Loading…' : 'Show more'),
                    ),
                ],
              ],
            ),
    );
  }
}

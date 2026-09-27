import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/app_widgets.dart';
import '../state/notifications_controller.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsControllerProvider);

    return notifications.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) =>
          const Center(child: Text('Notifications could not load.')),
      data: (items) => RefreshIndicator(
        onRefresh: () => ref.refresh(notificationsControllerProvider.future),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Row(
              children: [
                const Expanded(
                  child: StatusPill(label: 'IN-APP NOTIFICATIONS'),
                ),
                TextButton(
                  onPressed: items.isEmpty
                      ? null
                      : () => ref
                            .read(notificationsControllerProvider.notifier)
                            .markAllRead(),
                  child: const Text('Mark all read'),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (items.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'No notifications yet. Shift and onboarding updates will appear here.',
                  ),
                ),
              )
            else
              ...items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Card(
                    child: ListTile(
                      leading: Icon(
                        item.unread
                            ? Icons.notifications_active
                            : Icons.notifications_none,
                      ),
                      title: Text(item.title),
                      subtitle: Text(
                        '${item.body}\n${DateFormat.MMMd().add_jm().format(item.createdAt)}',
                      ),
                      isThreeLine: true,
                      trailing: item.unread
                          ? const Icon(Icons.circle, size: 10)
                          : null,
                      onTap: () => ref
                          .read(notificationsControllerProvider.notifier)
                          .markRead(item.id),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

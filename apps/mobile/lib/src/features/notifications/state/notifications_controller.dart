import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../data/notification_repository.dart';

class NotificationsController extends AsyncNotifier<List<NotificationSummary>> {
  @override
  Future<List<NotificationSummary>> build() {
    return ref.watch(notificationRepositoryProvider).list();
  }

  Future<void> markRead(String id) async {
    await ref.read(notificationRepositoryProvider).markRead(id);
    state = AsyncData(await ref.read(notificationRepositoryProvider).list());
  }

  Future<void> markAllRead() async {
    await ref.read(notificationRepositoryProvider).markAllRead();
    state = AsyncData(await ref.read(notificationRepositoryProvider).list());
  }
}

final notificationsControllerProvider =
    AsyncNotifierProvider<NotificationsController, List<NotificationSummary>>(
      NotificationsController.new,
    );

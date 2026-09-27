import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/widgets/app_widgets.dart';
import '../state/shift_board_controller.dart';
import 'shift_board_screen.dart';

class MyWorkScreen extends ConsumerWidget {
  const MyWorkScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(shiftBoardControllerProvider);

    return board.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) =>
          const Center(child: Text('Unable to load your work.')),
      data: (state) {
        final upcoming = state.myShifts
            .where((shift) => shift.status != ShiftStatus.completed)
            .toList();
        final completed = state.myShifts
            .where((shift) => shift.status == ShiftStatus.completed)
            .toList();

        return RefreshIndicator(
          onRefresh: () =>
              ref.read(shiftBoardControllerProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const StatusPill(label: 'MY ASSIGNMENTS'),
              const SizedBox(height: 14),
              Text(
                'Upcoming',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (upcoming.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No upcoming accepted shifts.'),
                  ),
                )
              else
                ...upcoming.map(
                  (shift) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ShiftCard(shift: shift),
                  ),
                ),
              const SizedBox(height: 18),
              Text(
                'Completed',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (completed.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Completed shifts will appear here.'),
                  ),
                )
              else
                ...completed.map(
                  (shift) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ShiftCard(shift: shift),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

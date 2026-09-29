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
                    child: Text('No upcoming confirmed shifts.'),
                  ),
                )
              else
                ...upcoming.map(
                  (shift) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ScheduleShiftCard(shift: shift),
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
                    child: _ScheduleShiftCard(shift: shift),
                  ),
                ),
              const SizedBox(height: 18),
              Text(
                'Timesheets',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 10),
              if (state.timesheets.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Submitted timesheets will appear here.'),
                  ),
                )
              else
                ...state.timesheets.map(
                  (timesheet) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.receipt_long_outlined),
                      title: Text(readableEnum(timesheet.status.name)),
                      subtitle: Text(
                        '${timesheet.workedMinutes} minutes · shift ${timesheet.shiftId}',
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _ScheduleShiftCard extends ConsumerWidget {
  const _ScheduleShiftCard({required this.shift});

  final ShiftSummary shift;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ShiftCard(shift: shift),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
          ),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: () => _record(
                  context,
                  ref,
                  AttendanceEventType.clockIn,
                  'Clock-in recorded.',
                ),
                icon: const Icon(Icons.login),
                label: const Text('Clock in'),
              ),
              OutlinedButton.icon(
                onPressed: () => _record(
                  context,
                  ref,
                  AttendanceEventType.breakStart,
                  'Break started.',
                ),
                icon: const Icon(Icons.pause_circle_outline),
                label: const Text('Break'),
              ),
              OutlinedButton.icon(
                onPressed: () => _record(
                  context,
                  ref,
                  AttendanceEventType.breakEnd,
                  'Break ended.',
                ),
                icon: const Icon(Icons.play_circle_outline),
                label: const Text('Resume'),
              ),
              OutlinedButton.icon(
                onPressed: () => _record(
                  context,
                  ref,
                  AttendanceEventType.clockOut,
                  'Clock-out recorded.',
                ),
                icon: const Icon(Icons.logout),
                label: const Text('Clock out'),
              ),
              ElevatedButton.icon(
                onPressed: () async {
                  try {
                    await ref
                        .read(shiftBoardControllerProvider.notifier)
                        .submitTimesheet(shift);
                    if (context.mounted) {
                      showAppSnack(context, 'Timesheet submitted.');
                    }
                  } catch (error) {
                    if (context.mounted) {
                      showAppSnack(
                        context,
                        'Timesheet could not be submitted.',
                        isError: true,
                      );
                    }
                  }
                },
                icon: const Icon(Icons.receipt_long_outlined),
                label: const Text('Timesheet'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _record(
    BuildContext context,
    WidgetRef ref,
    AttendanceEventType type,
    String message,
  ) async {
    try {
      await ref
          .read(shiftBoardControllerProvider.notifier)
          .recordAttendance(shift.id, type);
      if (context.mounted) {
        showAppSnack(context, message);
      }
    } catch (error) {
      if (context.mounted) {
        showAppSnack(
          context,
          'Attendance could not be recorded.',
          isError: true,
        );
      }
    }
  }
}

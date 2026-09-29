import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../shifts/state/shift_board_controller.dart';

class HomeOverviewScreen extends ConsumerWidget {
  const HomeOverviewScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(shiftBoardControllerProvider);

    return board.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => const Center(child: Text('Unable to load home.')),
      data: (state) {
        final nextShift = state.myShifts.where((shift) {
          return shift.endTime.isAfter(DateTime.now()) &&
              shift.status != ShiftStatus.cancelled;
        }).toList()..sort((a, b) => a.startTime.compareTo(b.startTime));
        final weeklyHours = state.myShifts
            .where(
              (shift) => shift.startTime.isAfter(
                DateTime.now().subtract(const Duration(days: 7)),
              ),
            )
            .fold<double>(
              0,
              (total, shift) =>
                  total +
                  shift.endTime.difference(shift.startTime).inMinutes / 60,
            );
        final estimatedEarnings = state.myShifts.fold<double>(
          0,
          (total, shift) =>
              total +
              (shift.endTime.difference(shift.startTime).inMinutes / 60) *
                  shift.hourlyRate,
        );

        return RefreshIndicator(
          onRefresh: () =>
              ref.read(shiftBoardControllerProvider.notifier).refresh(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const StatusPill(label: 'LIVE MARKETPLACE'),
              const SizedBox(height: 14),
              Text(
                'Today',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  _MetricTile(
                    label: 'Applications',
                    value: '${state.applications.length}',
                  ),
                  _MetricTile(
                    label: 'Invites',
                    value: '${state.invitations.length}',
                  ),
                  _MetricTile(
                    label: 'Hours',
                    value: weeklyHours.toStringAsFixed(1),
                  ),
                  _MetricTile(
                    label: 'Est. earnings',
                    value: '\$${estimatedEarnings.toStringAsFixed(0)}',
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: nextShift.isEmpty
                      ? const Text('No confirmed upcoming shift yet.')
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Next shift',
                              style: TextStyle(
                                color: AppColors.muted,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              nextShift.first.facilityName ??
                                  'Healthcare facility',
                              style: Theme.of(context).textTheme.titleLarge
                                  ?.copyWith(fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              DateFormat.yMMMd().add_jm().format(
                                nextShift.first.startTime,
                              ),
                            ),
                          ],
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

class EarningsScreen extends ConsumerWidget {
  const EarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final board = ref.watch(shiftBoardControllerProvider);

    return board.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) =>
          const Center(child: Text('Unable to load earnings.')),
      data: (state) {
        final approved = state.timesheets
            .where((timesheet) => timesheet.status == TimesheetStatus.approved)
            .fold<int>(
              0,
              (total, timesheet) => total + timesheet.workedMinutes,
            );
        final estimated = state.myShifts.fold<double>(
          0,
          (total, shift) =>
              total +
              (shift.endTime.difference(shift.startTime).inMinutes / 60) *
                  shift.hourlyRate,
        );
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const StatusPill(label: 'ESTIMATED ONLY'),
            const SizedBox(height: 14),
            _MetricTile(
              label: 'Estimated earnings',
              value: '\$${estimated.toStringAsFixed(0)}',
            ),
            const SizedBox(height: 10),
            _MetricTile(label: 'Approved minutes', value: '$approved'),
            const SizedBox(height: 16),
            ...state.timesheets.map(
              (timesheet) => Card(
                child: ListTile(
                  leading: const Icon(Icons.receipt_long_outlined),
                  title: Text(readableEnum(timesheet.status.name)),
                  subtitle: Text('${timesheet.workedMinutes} minutes'),
                ),
              ),
            ),
            if (state.timesheets.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: Text(
                    'Timesheet earnings will appear here after shifts.',
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 156,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.black.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 8),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

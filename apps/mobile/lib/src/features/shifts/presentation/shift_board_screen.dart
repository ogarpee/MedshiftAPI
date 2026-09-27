import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/models/medshift_models.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../state/shift_board_controller.dart';

class ShiftBoardScreen extends ConsumerStatefulWidget {
  const ShiftBoardScreen({super.key});

  @override
  ConsumerState<ShiftBoardScreen> createState() => _ShiftBoardScreenState();
}

class _ShiftBoardScreenState extends ConsumerState<ShiftBoardScreen> {
  bool _mapMode = false;

  @override
  Widget build(BuildContext context) {
    final board = ref.watch(shiftBoardControllerProvider);

    return board.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => _ErrorState(
        message: apiErrorMessage(error, 'Shift board could not load.'),
        onRetry: () => ref.refresh(shiftBoardControllerProvider),
      ),
      data: (state) => RefreshIndicator(
        onRefresh: () =>
            ref.read(shiftBoardControllerProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _StatusBanner(state: state),
            const SizedBox(height: 14),
            ShiftFilterPanel(state: state),
            const SizedBox(height: 14),
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  icon: Icon(Icons.view_agenda_outlined),
                  label: Text('List'),
                ),
                ButtonSegment(
                  value: true,
                  icon: Icon(Icons.map_outlined),
                  label: Text('Map'),
                ),
              ],
              selected: {_mapMode},
              onSelectionChanged: (value) =>
                  setState(() => _mapMode = value.first),
            ),
            const SizedBox(height: 14),
            if (_mapMode)
              ShiftMapFallback(shifts: state.openShifts)
            else if (state.openShifts.isEmpty)
              const _EmptyBoard()
            else
              ...state.openShifts.map(
                (shift) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ShiftCard(
                    shift: shift,
                    onTap: () => _showDetails(
                      context,
                      shift,
                      state.onboarding.canAcceptShifts,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _showDetails(BuildContext context, ShiftSummary shift, bool canAccept) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => ShiftDetailsSheet(
        shift: shift,
        canAccept: canAccept,
        onAccept: () async {
          try {
            await ref
                .read(shiftBoardControllerProvider.notifier)
                .acceptShift(shift.id);
            if (context.mounted) {
              Navigator.of(context).pop();
              showAppSnack(context, 'Shift accepted.');
            }
          } catch (error) {
            if (context.mounted) {
              showAppSnack(
                context,
                apiErrorMessage(error, 'Shift could not be accepted.'),
                isError: true,
              );
            }
          }
        },
      ),
    );
  }
}

class ShiftFilterPanel extends ConsumerStatefulWidget {
  const ShiftFilterPanel({super.key, required this.state});

  final ShiftBoardState state;

  @override
  ConsumerState<ShiftFilterPanel> createState() => _ShiftFilterPanelState();
}

class _ShiftFilterPanelState extends ConsumerState<ShiftFilterPanel> {
  late final TextEditingController _radius;
  late final TextEditingController _maxHours;
  late final TextEditingController _minRate;
  ClinicalRole? _role;
  FacilityType? _facilityType;
  ShiftSearchSort _sort = ShiftSearchSort.distance;

  @override
  void initState() {
    super.initState();
    final filters = widget.state.filters;
    _role = filters.roleRequired;
    _facilityType = filters.facilityType;
    _sort = filters.sort;
    _radius = TextEditingController(
      text: filters.radiusKm?.toStringAsFixed(0) ?? '',
    );
    _maxHours = TextEditingController(
      text: filters.maxShiftHours?.toStringAsFixed(0) ?? '',
    );
    _minRate = TextEditingController(
      text: filters.minHourlyRate?.toStringAsFixed(0) ?? '',
    );
  }

  @override
  void dispose() {
    _radius.dispose();
    _maxHours.dispose();
    _minRate.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filters = widget.state.filters;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Search filters',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                if (filters.hasActiveFilters)
                  TextButton(onPressed: _reset, child: const Text('Reset')),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                SizedBox(
                  width: 150,
                  child: DropdownButtonFormField<ClinicalRole?>(
                    initialValue: _role,
                    decoration: const InputDecoration(labelText: 'Role'),
                    items: [
                      const DropdownMenuItem<ClinicalRole?>(
                        value: null,
                        child: Text('Any role'),
                      ),
                      ...ClinicalRole.values.map(
                        (role) => DropdownMenuItem<ClinicalRole?>(
                          value: role,
                          child: Text(clinicalRoleToApi(role)),
                        ),
                      ),
                    ],
                    onChanged: (value) => setState(() => _role = value),
                  ),
                ),
                SizedBox(
                  width: 190,
                  child: DropdownButtonFormField<FacilityType?>(
                    initialValue: _facilityType,
                    decoration: const InputDecoration(labelText: 'Facility'),
                    items: [
                      const DropdownMenuItem<FacilityType?>(
                        value: null,
                        child: Text('Any facility'),
                      ),
                      ...FacilityType.values.map(
                        (type) => DropdownMenuItem<FacilityType?>(
                          value: type,
                          child: Text(readableEnum(facilityTypeToApi(type))),
                        ),
                      ),
                    ],
                    onChanged: (value) => setState(() => _facilityType = value),
                  ),
                ),
                SizedBox(
                  width: 120,
                  child: TextField(
                    controller: _radius,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Km'),
                  ),
                ),
                SizedBox(
                  width: 140,
                  child: TextField(
                    controller: _maxHours,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Max hrs'),
                  ),
                ),
                SizedBox(
                  width: 140,
                  child: TextField(
                    controller: _minRate,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Min pay'),
                  ),
                ),
                SizedBox(
                  width: 170,
                  child: DropdownButtonFormField<ShiftSearchSort>(
                    initialValue: _sort,
                    decoration: const InputDecoration(labelText: 'Sort'),
                    items: const [
                      DropdownMenuItem(
                        value: ShiftSearchSort.distance,
                        child: Text('Distance'),
                      ),
                      DropdownMenuItem(
                        value: ShiftSearchSort.startTime,
                        child: Text('Start time'),
                      ),
                      DropdownMenuItem(
                        value: ShiftSearchSort.hourlyRate,
                        child: Text('Pay'),
                      ),
                    ],
                    onChanged: (value) => setState(
                      () => _sort = value ?? ShiftSearchSort.distance,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: _apply,
              icon: const Icon(Icons.search),
              label: Text(
                'Search ${widget.state.openShifts.length} result${widget.state.openShifts.length == 1 ? "" : "s"}',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _apply() {
    final filters = ShiftSearchFilters(
      roleRequired: _role,
      facilityType: _facilityType,
      radiusKm: double.tryParse(_radius.text),
      maxShiftHours: double.tryParse(_maxHours.text),
      minHourlyRate: double.tryParse(_minRate.text),
      sort: _sort,
    );

    return ref
        .read(shiftBoardControllerProvider.notifier)
        .applyFilters(filters);
  }

  Future<void> _reset() {
    setState(() {
      _role = null;
      _facilityType = null;
      _sort = ShiftSearchSort.distance;
      _radius.clear();
      _maxHours.clear();
      _minRate.clear();
    });

    return ref
        .read(shiftBoardControllerProvider.notifier)
        .applyFilters(const ShiftSearchFilters());
  }
}

class ShiftCard extends StatelessWidget {
  const ShiftCard({super.key, required this.shift, this.onTap});

  final ShiftSummary shift;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final time = DateFormat('MMM d · h:mm a').format(shift.startTime);
    final duration = _shiftDurationHours(shift);
    final estimatedPay = duration * shift.hourlyRate;
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    height: 42,
                    width: 42,
                    decoration: BoxDecoration(
                      color: AppColors.navy,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      clinicalRoleToApi(shift.roleRequired),
                      style: const TextStyle(
                        color: AppColors.lightGold,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          shift.facilityName ?? 'Healthcare facility',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w900),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${readableEnum(clinicalRoleToApi(shift.roleRequired))} coverage',
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ),
                  ),
                  StatusPill(
                    label: readableEnum(_shiftStatusApi(shift.status)),
                    tone: _shiftStatusTone(shift.status),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _ShiftMetaPill(
                    icon: Icons.calendar_today_outlined,
                    label: time,
                  ),
                  _ShiftMetaPill(
                    icon: Icons.schedule_outlined,
                    label: '$duration hr',
                  ),
                  _ShiftMetaPill(
                    icon: Icons.location_on_outlined,
                    label: shift.distanceKm == null
                        ? (shift.facilityCity ?? 'Calgary area')
                        : '${shift.distanceKm!.toStringAsFixed(1)} km',
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.offWhite,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Colors.black.withValues(alpha: 0.05),
                  ),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '\$${shift.hourlyRate.toStringAsFixed(0)}/hr',
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      '\$${estimatedPay.toStringAsFixed(0)} est.',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        color: AppColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ShiftDetailsSheet extends StatelessWidget {
  const ShiftDetailsSheet({
    super.key,
    required this.shift,
    required this.canAccept,
    required this.onAccept,
  });

  final ShiftSummary shift;
  final bool canAccept;
  final Future<void> Function() onAccept;

  @override
  Widget build(BuildContext context) {
    final duration = shift.endTime.difference(shift.startTime).inHours;
    final safeDuration = _shiftDurationHours(shift);
    final estimatedPay = safeDuration * shift.hourlyRate;
    return Padding(
      padding: EdgeInsets.fromLTRB(
        20,
        8,
        20,
        20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    StatusPill(
                      label: readableEnum(_shiftStatusApi(shift.status)),
                      tone: _shiftStatusTone(shift.status),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      shift.facilityName ?? 'Shift details',
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${readableEnum(clinicalRoleToApi(shift.roleRequired))} coverage',
                      style: const TextStyle(color: AppColors.muted),
                    ),
                  ],
                ),
              ),
              Text(
                '\$${estimatedPay.toStringAsFixed(0)}',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  color: AppColors.navy,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _ShiftDetailGrid(
            items: [
              ('Start', DateFormat.yMMMd().add_jm().format(shift.startTime)),
              ('Duration', '${duration <= 0 ? safeDuration : duration} hours'),
              ('Rate', '\$${shift.hourlyRate.toStringAsFixed(0)}/hr'),
              ('Location', shift.facilityCity ?? 'Calgary area'),
            ],
          ),
          if (shift.facilityRating != null)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: StatusPill(
                label:
                    'Facility ${shift.facilityRating!.toStringAsFixed(1)} rating',
                tone: AppColors.navy,
              ),
            ),
          const SizedBox(height: 16),
          Text(
            shift.description ??
                'Facility details and arrival notes will appear here when available.',
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: canAccept ? onAccept : null,
            child: Text(canAccept ? 'Accept Shift' : 'Approval required'),
          ),
        ],
      ),
    );
  }
}

class _ShiftMetaPill extends StatelessWidget {
  const _ShiftMetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: AppColors.navy.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppColors.navy),
          const SizedBox(width: 5),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _ShiftDetailGrid extends StatelessWidget {
  const _ShiftDetailGrid({required this.items});

  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      childAspectRatio: 2.45,
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: items
          .map(
            (item) => Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.offWhite,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.black.withValues(alpha: 0.05)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    item.$1,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.navy,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }
}

class ShiftMapFallback extends StatelessWidget {
  const ShiftMapFallback({super.key, required this.shifts});

  final List<ShiftSummary> shifts;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SizedBox(
        height: 320,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Map view',
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
              ),
              const SizedBox(height: 8),
              const Text(
                'Mapbox is native-ready for configured builds. Coordinates remain visible as a fallback.',
              ),
              const SizedBox(height: 16),
              Expanded(
                child: ListView(
                  children: shifts
                      .map(
                        (shift) => ListTile(
                          leading: const Icon(Icons.place_outlined),
                          title: Text(shift.facilityName ?? 'Open shift'),
                          subtitle: Text(
                            '${shift.location.latitude}, ${shift.location.longitude}',
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.state});

  final ShiftBoardState state;

  @override
  Widget build(BuildContext context) {
    final status = state.onboarding.verificationStatus;
    final approved = status == OnboardingStatus.approved;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: approved
            ? AppColors.success.withValues(alpha: 0.12)
            : AppColors.gold.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          Icon(
            approved ? Icons.verified_outlined : Icons.hourglass_bottom,
            color: approved ? AppColors.success : AppColors.navy,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              state.message ?? 'Worker status loaded.',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyBoard extends StatelessWidget {
  const _EmptyBoard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Text(
          'No nearby open shifts are available yet. Pull to refresh.',
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}

int _shiftDurationHours(ShiftSummary shift) {
  final hours = shift.endTime.difference(shift.startTime).inHours;
  return hours <= 0 ? 1 : hours;
}

String _shiftStatusApi(ShiftStatus status) {
  return switch (status) {
    ShiftStatus.matched => 'MATCHED',
    ShiftStatus.inProgress => 'IN_PROGRESS',
    ShiftStatus.completed => 'COMPLETED',
    ShiftStatus.cancelled => 'CANCELLED',
    ShiftStatus.open => 'OPEN',
  };
}

Color _shiftStatusTone(ShiftStatus status) {
  return switch (status) {
    ShiftStatus.cancelled => AppColors.danger,
    ShiftStatus.completed => AppColors.success,
    ShiftStatus.open => AppColors.gold,
    _ => AppColors.navy,
  };
}

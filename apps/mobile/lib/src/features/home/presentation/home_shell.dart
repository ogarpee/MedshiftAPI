import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_widgets.dart';
import '../../auth/state/auth_controller.dart';
import '../../notifications/presentation/notifications_screen.dart';
import '../../settings/presentation/settings_screen.dart';
import '../../shifts/presentation/my_work_screen.dart';
import '../../shifts/presentation/shift_board_screen.dart';
import 'home_overview_screen.dart';

class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, this.testScreens});

  final List<Widget>? testScreens;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authControllerProvider).value?.user;
    final screens =
        widget.testScreens ??
        const [
          HomeOverviewScreen(),
          ShiftBoardScreen(),
          MyWorkScreen(),
          EarningsScreen(),
          SettingsScreen(),
        ];
    const titles = ['Home', 'Shifts', 'Schedule', 'Earnings', 'Profile'];

    return Scaffold(
      appBar: AppBar(
        title: Text(titles[_index]),
        actions: [
          IconButton(
            tooltip: 'Notifications',
            icon: const Icon(Icons.notifications_none),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => Scaffold(
                  appBar: AppBar(title: const Text('Notifications')),
                  body: const NotificationsScreen(),
                ),
              ),
            ),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                color: AppColors.navy,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const MedShiftLogo(compact: true),
                    const SizedBox(height: 18),
                    Text(
                      user?.email ?? 'Worker account',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const StatusPill(label: 'CAREGIVER APP'),
                  ],
                ),
              ),
              const Padding(
                padding: EdgeInsets.fromLTRB(20, 18, 20, 6),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    'Caregiver workspace',
                    style: TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
              ListTile(
                leading: const Icon(Icons.dashboard_outlined),
                title: const Text('Home'),
                selected: _index == 0,
                onTap: () => _selectDrawerTab(0),
              ),
              ListTile(
                leading: const Icon(Icons.search),
                title: const Text('Shifts'),
                selected: _index == 1,
                onTap: () => _selectDrawerTab(1),
              ),
              ListTile(
                leading: const Icon(Icons.event_available_outlined),
                title: const Text('Schedule'),
                selected: _index == 2,
                onTap: () => _selectDrawerTab(2),
              ),
              ListTile(
                leading: const Icon(Icons.payments_outlined),
                title: const Text('Earnings'),
                selected: _index == 3,
                onTap: () => _selectDrawerTab(3),
              ),
              ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('Profile'),
                selected: _index == 4,
                onTap: () => _selectDrawerTab(4),
              ),
              ListTile(
                leading: const Icon(Icons.notifications_none),
                title: const Text('Notifications'),
                onTap: () {
                  Navigator.of(context).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => Scaffold(
                        appBar: AppBar(title: const Text('Notifications')),
                        body: const NotificationsScreen(),
                      ),
                    ),
                  );
                },
              ),
              const Divider(height: 18),
              ListTile(
                leading: const Icon(Icons.help_outline),
                title: const Text('Support'),
                subtitle: const Text('Help center coming soon'),
                onTap: () => Navigator.of(context).pop(),
              ),
              const Spacer(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Logout'),
                onTap: () async {
                  await ref.read(authControllerProvider.notifier).logout();
                  if (context.mounted) {
                    context.go('/login');
                  }
                },
              ),
            ],
          ),
        ),
      ),
      body: screens[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (index) => setState(() => _index = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            label: 'Home',
          ),
          BottomNavigationBarItem(icon: Icon(Icons.search), label: 'Shifts'),
          BottomNavigationBarItem(
            icon: Icon(Icons.event_available_outlined),
            label: 'Schedule',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.payments_outlined),
            label: 'Earnings',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: 'Profile',
          ),
        ],
      ),
    );
  }

  void _selectDrawerTab(int index) {
    Navigator.of(context).pop();
    setState(() => _index = index);
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/widgets/app_widgets.dart';
import 'auth_page_layout.dart';
import '../data/auth_repository.dart';
import '../state/auth_controller.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _password = TextEditingController();
  int _step = 0;
  String _completionToken = '';
  bool _loading = false;

  @override
  void dispose() {
    _email.dispose();
    _otp.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AuthPageLayout(
      title: _step == 0
          ? 'Start worker registration'
          : _step == 1
          ? 'Verify your email'
          : 'Set password',
      caption:
          'MedShift uses email OTP verification before profile onboarding.',
      children: [
        if (_step == 0)
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
        if (_step == 1)
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            decoration: const InputDecoration(
              labelText: 'Six digit code',
              counterText: '',
            ),
          ),
        if (_step == 2)
          TextField(
            controller: _password,
            obscureText: true,
            decoration: const InputDecoration(labelText: 'Password'),
          ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: _loading ? null : _next,
          child: _loading
              ? const CircularProgressIndicator()
              : Text(_step == 2 ? 'Create account' : 'Continue'),
        ),
        TextButton(
          onPressed: () => context.go('/login'),
          child: const Text('Back to sign in'),
        ),
      ],
    );
  }

  Future<void> _next() async {
    setState(() => _loading = true);
    try {
      final repository = ref.read(authRepositoryProvider);
      if (_step == 0) {
        await repository.startRegistration(_email.text);
        setState(() => _step = 1);
      } else if (_step == 1) {
        _completionToken = await repository.verifyRegistrationOtp(
          email: _email.text,
          otp: _otp.text,
        );
        setState(() => _step = 2);
      } else {
        await ref
            .read(authControllerProvider.notifier)
            .completeRegistration(
              email: _email.text,
              password: _password.text,
              completionToken: _completionToken,
            );
        if (mounted) {
          context.go('/onboarding');
        }
      }
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          apiErrorMessage(error, 'Registration could not continue.'),
          isError: true,
        );
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }
}

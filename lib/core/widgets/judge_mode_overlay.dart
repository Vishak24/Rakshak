import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_text.dart';
import 'rk_button.dart';
import '../../features/intelligence/presentation/intelligence_controller.dart';
import '../../features/sentinel/presentation/sentinel_controller.dart';
import '../../core/models/risk_prediction_request.dart';
import '../../core/constants/pincode_map.dart';

// ── Providers ─────────────────────────────────────────────────────────────────

/// Whether the Judge Mode panel is open.
final judgePanelOpenProvider = StateProvider<bool>((ref) => false);

/// Selected hour override (0–23).
final judgeHourProvider = StateProvider<int>((ref) => 14);

/// Selected pincode from the Judge Mode dropdown (null = nothing selected).
/// Read by score_screen.dart to show the simulation context banner.
final judgePincodeProvider = StateProvider<int?>((ref) => null);

// ── Constants ─────────────────────────────────────────────────────────────────

const double _kPanelWidth = 260.0;

// ── Dropdown items — built once at compile time ───────────────────────────────

const _kPincodeItems = <DropdownMenuItem<int>>[
  DropdownMenuItem(value: 600001, child: Text('600001 · Parrys Corner')),
  DropdownMenuItem(value: 600002, child: Text('600002 · Sowcarpet')),
  DropdownMenuItem(value: 600003, child: Text('600003 · Park Town')),
  DropdownMenuItem(value: 600004, child: Text('600004 · Mylapore')),
  DropdownMenuItem(value: 600005, child: Text('600005 · Chintadripet')),
  DropdownMenuItem(value: 600006, child: Text('600006 · Chepauk')),
  DropdownMenuItem(value: 600007, child: Text('600007 · Perambur')),
  DropdownMenuItem(value: 600008, child: Text('600008 · Chepauk')),
  DropdownMenuItem(value: 600009, child: Text('600009 · Kilpauk')),
  DropdownMenuItem(value: 600010, child: Text('600010 · Vepery')),
  DropdownMenuItem(value: 600011, child: Text('600011 · Royapuram')),
  DropdownMenuItem(value: 600012, child: Text('600012 · Tondiarpet')),
  DropdownMenuItem(value: 600013, child: Text('600013 · Tiruvottiyur')),
  DropdownMenuItem(value: 600015, child: Text('600015 · Padi')),
  DropdownMenuItem(value: 600017, child: Text('600017 · T. Nagar')),
  DropdownMenuItem(value: 600018, child: Text('600018 · Kodambakkam')),
  DropdownMenuItem(value: 600019, child: Text('600019 · Ennore')),
  DropdownMenuItem(value: 600020, child: Text('600020 · Anna Nagar')),
  DropdownMenuItem(value: 600024, child: Text('600024 · Ashok Nagar')),
  DropdownMenuItem(value: 600028, child: Text('600028 · Nungambakkam')),
  DropdownMenuItem(value: 600029, child: Text('600029 · Aminjikarai')),
  DropdownMenuItem(value: 600032, child: Text('600032 · Vadapalani')),
  DropdownMenuItem(value: 600033, child: Text('600033 · Saidapet')),
  DropdownMenuItem(value: 600034, child: Text('600034 · Teynampet')),
  DropdownMenuItem(value: 600035, child: Text('600035 · Alandur')),
  DropdownMenuItem(value: 600036, child: Text('600036 · St. Thomas Mount')),
  DropdownMenuItem(value: 600040, child: Text('600040 · Virugambakkam')),
  DropdownMenuItem(value: 600042, child: Text('600042 · Thiruvanmiyur')),
  DropdownMenuItem(value: 600044, child: Text('600044 · Tambaram')),
  DropdownMenuItem(value: 600045, child: Text('600045 · Pallavaram')),
  DropdownMenuItem(value: 600050, child: Text('600050 · Arumbakkam')),
  DropdownMenuItem(value: 600053, child: Text('600053 · Ambattur')),
  DropdownMenuItem(value: 600056, child: Text('600056 · Porur')),
  DropdownMenuItem(value: 600058, child: Text('600058 · Washermanpet')),
  DropdownMenuItem(value: 600061, child: Text('600061 · Chromepet')),
  DropdownMenuItem(value: 600064, child: Text('600064 · Vandalur')),
  DropdownMenuItem(value: 600078, child: Text('600078 · Valasaravakkam')),
  DropdownMenuItem(value: 600081, child: Text('600081 · Manali')),
  DropdownMenuItem(value: 600082, child: Text('600082 · Madhavaram')),
  DropdownMenuItem(value: 600083, child: Text('600083 · Villivakkam')),
  DropdownMenuItem(value: 600090, child: Text('600090 · Velachery')),
  DropdownMenuItem(value: 600096, child: Text('600096 · OMR')),
  DropdownMenuItem(value: 600099, child: Text('600099 · Poonamallee')),
  DropdownMenuItem(value: 600118, child: Text('600118 · Kathivakkam')),
];

// ── Overlay ───────────────────────────────────────────────────────────────────

/// Wraps any screen. Renders a persistent teal pull-tab on the right edge
/// and a slide-in Judge Mode panel.
/// No BackdropFilter — avoids blur/compositing errors.
class JudgeModeOverlay extends ConsumerWidget {
  final Widget child;
  const JudgeModeOverlay({super.key, required this.child});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOpen = ref.watch(judgePanelOpenProvider);

    return Stack(
      children: [
        // ── App content ────────────────────────────────────────────────
        child,

        // ── Scrim — tap outside to close ───────────────────────────────
        if (isOpen)
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () =>
                  ref.read(judgePanelOpenProvider.notifier).state = false,
              child: const ColoredBox(color: Colors.transparent),
            ),
          ),

        // ── Pull-tab ───────────────────────────────────────────────────
        Positioned(
          right: isOpen ? _kPanelWidth : 0,
          top: 0,
          bottom: 0,
          child: Center(
            child: GestureDetector(
              onTap: () =>
                  ref.read(judgePanelOpenProvider.notifier).state = !isOpen,
              child: Container(
                width: 22,
                height: 64,
                decoration: const BoxDecoration(
                  color: AppColors.accentBright,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(AppSpacing.radiusMd),
                    bottomLeft: Radius.circular(AppSpacing.radiusMd),
                  ),
                ),
                child: Center(
                  child: RotatedBox(
                    quarterTurns: 1,
                    child: Text(
                      'JM',
                      style: AppText.labelSmallCaps.copyWith(
                        color: AppColors.accentDark,
                        fontSize: 9,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),

        // ── Slide-in panel ─────────────────────────────────────────────
        AnimatedPositioned(
          duration: const Duration(milliseconds: 240),
          curve: Curves.easeOutCubic,
          right: isOpen ? 0 : -_kPanelWidth,
          top: 0,
          bottom: 0,
          width: _kPanelWidth,
          child: const _JudgePanel(),
        ),
      ],
    );
  }
}

// ── Panel ─────────────────────────────────────────────────────────────────────

class _JudgePanel extends ConsumerStatefulWidget {
  const _JudgePanel();

  @override
  ConsumerState<_JudgePanel> createState() => _JudgePanelState();
}

class _JudgePanelState extends ConsumerState<_JudgePanel> {
  // Selected pincode from the dropdown — null means nothing chosen yet
  int? _selectedPincode;
  bool _isSimulating = false;

  Future<void> _simulate(BuildContext context) async {
    // ── Step 1: Validate ────────────────────────────────────────────────
    if (_selectedPincode == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select a pincode.'),
          backgroundColor: Color(0xFF93000A),
        ),
      );
      return;
    }

    final pincode = _selectedPincode!;
    final hour = ref.read(judgeHourProvider);

    // Read current lat/lon from sentinel state (fallback if pincode has no coords)
    final sentinelState = ref.read(sentinelControllerProvider);
    final lat = sentinelState.latitude;
    final lng = sentinelState.longitude;

    // Build the Judge Mode request — forJudge uses pincode coords when available
    final request = RiskPredictionRequest.forJudge(lat, lng, pincode, hour);

    // ── Step 2: Close panel ─────────────────────────────────────────────
    ref.read(judgePanelOpenProvider.notifier).state = false;

    // ── Step 3: Reset intelligence state so the analyzing screen starts fresh
    ref.read(intelligenceControllerProvider.notifier).reset();

    // ── Step 4: Navigate to the analyzing screen ────────────────────────
    if (!context.mounted) return;
    GoRouter.of(context).push('/intelligence');

    // ── Step 5: Call the backend with the full Judge Mode request ────────
    setState(() => _isSimulating = true);
    try {
      await ref
          .read(intelligenceControllerProvider.notifier)
          .scanWithRequest(request);

      // Also refresh the sentinel home screen score
      ref.read(sentinelControllerProvider.notifier).loadRiskScore();
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Simulation failed. Check connection.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSimulating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hour = ref.watch(judgeHourProvider);
    final screenHeight = MediaQuery.of(context).size.height;

    return GestureDetector(
      onTap: () {},
      child: Align(
        alignment: Alignment.centerRight,
        child: Material(
          type: MaterialType.transparency,
          child: Container(
            width: _kPanelWidth,
            constraints: BoxConstraints(maxHeight: screenHeight * 0.75),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainer.withValues(alpha: 0.97),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(AppSpacing.radiusLg),
                bottomLeft: Radius.circular(AppSpacing.radiusLg),
              ),
              border: const Border(
                left: BorderSide(color: AppColors.accentBright, width: 2),
              ),
            ),
            child: SafeArea(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // ── Header ─────────────────────────────────────────
                    Text(
                      'JUDGE MODE',
                      style: AppText.labelSmallCaps.copyWith(
                        color: AppColors.accentBright,
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    const Divider(color: AppColors.ghostBorder, height: 1),
                    const SizedBox(height: AppSpacing.md),

                    // ── HOUR label + current value ─────────────────────
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'HOUR',
                          style: AppText.labelSmallCaps
                              .copyWith(color: AppColors.textSecondary),
                        ),
                        Text(
                          '${hour.toString().padLeft(2, '0')}:00',
                          style: GoogleFonts.inter(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.accentBright,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),

                    // ── Hour slider ────────────────────────────────────
                    SliderTheme(
                      data: SliderThemeData(
                        activeTrackColor: AppColors.accentBright,
                        inactiveTrackColor: AppColors.surfaceHigh,
                        thumbColor: AppColors.accentBright,
                        overlayColor:
                            AppColors.accentBright.withValues(alpha: 0.15),
                        trackHeight: 2,
                        thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 6),
                      ),
                      child: Slider(
                        value: hour.toDouble(),
                        min: 0,
                        max: 23,
                        divisions: 23,
                        onChanged: (v) =>
                            ref.read(judgeHourProvider.notifier).state =
                                v.round(),
                      ),
                    ),

                    // Tick labels
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: ['0', '6', '12', '18', '23']
                          .map((t) => Text(
                                t,
                                style: AppText.labelSmallCaps
                                    .copyWith(fontSize: 9),
                              ))
                          .toList(),
                    ),

                    const SizedBox(height: AppSpacing.lg),

                    // ── Pincode dropdown ───────────────────────────────
                    DropdownButtonFormField<int>(
                      value: _selectedPincode,
                      dropdownColor: const Color(0xFF0D1B2A),
                      iconEnabledColor: AppColors.accentBright,
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 13,
                        letterSpacing: 0.5,
                      ),
                      decoration: InputDecoration(
                        labelText: 'SELECT PINCODE',
                        labelStyle: GoogleFonts.inter(
                          color: AppColors.accentBright.withValues(alpha: 0.7),
                          fontSize: 11,
                          letterSpacing: 1.5,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusSm),
                          borderSide: BorderSide(
                            color:
                                AppColors.accentBright.withValues(alpha: 0.3),
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius:
                              BorderRadius.circular(AppSpacing.radiusSm),
                          borderSide: const BorderSide(
                            color: AppColors.accentBright,
                            width: 1.5,
                          ),
                        ),
                        filled: true,
                        fillColor: const Color(0xFF0D1B2A),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 12),
                      ),
                      hint: Text(
                        'SELECT PINCODE · AREA',
                        style: GoogleFonts.inter(
                          color: Colors.white.withValues(alpha: 0.3),
                          fontSize: 11,
                          letterSpacing: 1.2,
                        ),
                      ),
                      isExpanded: true,
                      menuMaxHeight: 320,
                      items: _kPincodeItems,
                      onChanged: (value) {
                        setState(() => _selectedPincode = value);
                        // Sync to provider so score_screen can show the banner
                        ref.read(judgePincodeProvider.notifier).state = value;
                      },
                    ),

                    const SizedBox(height: AppSpacing.xl),

                    // ── SIMULATE button ────────────────────────────────
                    RkButton(
                      label: _isSimulating ? 'SIMULATING...' : 'SIMULATE',
                      isLoading: _isSimulating,
                      onPressed:
                          _isSimulating ? null : () => _simulate(context),
                    ),

                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Developer simulation tool for testing geo-fenced activity triggers.',
                      style: AppText.labelSmallCaps.copyWith(
                        fontSize: 9,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

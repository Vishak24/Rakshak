import 'dart:async';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
// geocoding is not supported on web — imported conditionally at runtime
import 'package:geocoding/geocoding.dart'
    if (dart.library.html) '../../../core/stubs/geocoding_stub.dart';
import '../../../core/models/risk_score.dart';
import '../data/sentinel_repository.dart';

/// Sentinel state — exposed to the UI
class SentinelState {
  final RiskScore? riskScore;
  final bool isLoading;
  final bool nightWatchActive;
  final String? error;
  final double latitude;
  final double longitude;
  final int pincode;
  final String areaName;

  const SentinelState({
    this.riskScore,
    this.isLoading = false,
    this.nightWatchActive = false,
    this.error,
    this.latitude = 13.0827,
    this.longitude = 80.2707,
    this.pincode = 600001,
    this.areaName = 'Parrys Corner',
  });

  SentinelState copyWith({
    RiskScore? riskScore,
    bool? isLoading,
    bool? nightWatchActive,
    String? error,
    double? latitude,
    double? longitude,
    int? pincode,
    String? areaName,
  }) {
    return SentinelState(
      riskScore: riskScore ?? this.riskScore,
      isLoading: isLoading ?? this.isLoading,
      nightWatchActive: nightWatchActive ?? this.nightWatchActive,
      error: error,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      pincode: pincode ?? this.pincode,
      areaName: areaName ?? this.areaName,
    );
  }
}

/// Sentinel controller — GPS + live /predict + 60s auto-refresh
class SentinelController extends StateNotifier<SentinelState> {
  final SentinelRepository _repo;
  Timer? _refreshTimer;

  SentinelController(this._repo) : super(const SentinelState()) {
    _init();
  }

  Future<void> _init() async {
    await _acquireLocation();
    await loadRiskScore();
    // Auto-refresh every 60 seconds
    _refreshTimer = Timer.periodic(
      const Duration(seconds: 60),
      (_) => loadRiskScore(),
    );
  }

  /// Acquire GPS + reverse geocode to get pincode
  Future<void> _acquireLocation() async {
    try {
      // Check / request permission
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.deniedForever ||
          permission == LocationPermission.denied) {
        // Fall back to defaults
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 10));

      final lat = position.latitude;
      final lng = position.longitude;

      // Reverse geocode to get pincode + area name
      int pincode = 600001;
      String areaName = 'Chennai';
      if (!kIsWeb) {
        try {
          final placemarks = await placemarkFromCoordinates(lat, lng)
              .timeout(const Duration(seconds: 5));
          if (placemarks.isNotEmpty) {
            final pm = placemarks.first;
            pincode = int.tryParse(pm.postalCode ?? '') ?? 600001;
            areaName = pm.subLocality?.isNotEmpty == true
                ? pm.subLocality!
                : pm.locality ?? 'Chennai';
          }
        } catch (_) {
          // Geocoding failed — keep defaults
        }
      }

      // Update repository + state
      _repo.updateLocation(
        lat: lat,
        lng: lng,
        pincode: pincode,
        areaName: areaName,
      );

      state = state.copyWith(
        latitude: lat,
        longitude: lng,
        pincode: pincode,
        areaName: areaName,
      );
    } catch (_) {
      // GPS failed — keep defaults, don't crash
    }
  }

  /// Call /predict and update state
  Future<void> loadRiskScore() async {
    state = state.copyWith(isLoading: true, error: null);

    try {
      final riskScore = await _repo.getCurrentRiskScore();
      state = state.copyWith(
        riskScore: riskScore,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString(),
      );
    }
  }

  Future<void> toggleNightWatch() async {
    final isActive = state.nightWatchActive;
    try {
      if (isActive) {
        await _repo.deactivateNightWatch();
        state = state.copyWith(nightWatchActive: false);
      } else {
        await _repo.activateNightWatch();
        state = state.copyWith(nightWatchActive: true);
      }
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }
}

/// Sentinel repository provider (concrete type so we can access location)
final sentinelRepositoryProvider = Provider<SentinelRepository>((ref) {
  return SentinelRepository();
});

/// Sentinel controller provider
final sentinelControllerProvider =
    StateNotifierProvider<SentinelController, SentinelState>((ref) {
  return SentinelController(ref.watch(sentinelRepositoryProvider));
});

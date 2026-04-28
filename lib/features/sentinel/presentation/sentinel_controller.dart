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

  /// Override pincode from Judge Mode — propagates to SOS flow and UI.
  void overridePincode(int pincode) {
    final coords = _pincodeCoords[pincode];
    state = state.copyWith(
      pincode: pincode,
      areaName: _pincodeNames[pincode] ?? 'Chennai',
      latitude:  coords?[0] ?? state.latitude,
      longitude: coords?[1] ?? state.longitude,
    );
    _repo.updateLocation(
      lat:      state.latitude,
      lng:      state.longitude,
      pincode:  pincode,
      areaName: state.areaName,
    );
  }

  // Pincode → [lat, lng] for the 44 Chennai zones used in Judge Mode
  static const Map<int, List<double>> _pincodeCoords = {
    600001: [13.0827, 80.2707], 600002: [13.0878, 80.2785],
    600003: [13.0950, 80.2866], 600004: [13.0732, 80.2609],
    600005: [13.0569, 80.2787], 600006: [13.0715, 80.2740],
    600007: [13.1127, 80.2966], 600008: [13.1186, 80.2487],
    600009: [13.1483, 80.2355], 600010: [13.1675, 80.2617],
    600011: [13.0827, 80.2487], 600012: [13.0950, 80.2193],
    600013: [13.0732, 80.2193], 600015: [13.0339, 80.2707],
    600017: [13.0067, 80.2570], 600018: [13.0521, 80.2193],
    600019: [13.0475, 80.2030], 600020: [13.0521, 80.2118],
    600024: [12.9815, 80.2209], 600028: [12.9995, 80.2666],
    600029: [12.9845, 80.2657], 600032: [13.0350, 80.2323],
    600033: [13.0521, 80.2030], 600034: [13.0339, 80.2193],
    600035: [13.0402, 80.2091], 600036: [13.0883, 80.2105],
    600040: [13.0850, 80.2101], 600042: [13.0883, 80.1762],
    600044: [13.0339, 80.1575], 600045: [13.0237, 80.1762],
    600050: [12.9673, 80.1501], 600053: [12.9515, 80.1438],
    600056: [12.9625, 80.2387], 600058: [13.1127, 80.2966],
    600061: [12.9000, 80.2277], 600064: [12.9240, 80.1958],
    600078: [13.1144, 80.1606], 600081: [13.1675, 80.2617],
    600082: [13.1675, 80.2355], 600083: [13.1483, 80.2355],
    600090: [12.9815, 80.2209], 600096: [12.9625, 80.2387],
    600099: [13.1186, 80.2091], 600118: [12.9065, 80.1958],
  };

  static const Map<int, String> _pincodeNames = {
    600001: 'Parrys Corner',  600002: 'Sowcarpet',
    600003: 'Park Town',      600004: 'Mylapore',
    600005: 'Chintadripet',   600006: 'Chepauk',
    600007: 'Perambur',       600008: 'Chepauk',
    600009: 'Kilpauk',        600010: 'Vepery',
    600011: 'Royapuram',      600012: 'Tondiarpet',
    600013: 'Tiruvottiyur',   600015: 'Padi',
    600017: 'T. Nagar',       600018: 'Kodambakkam',
    600019: 'Ennore',         600020: 'Anna Nagar',
    600024: 'Ashok Nagar',    600028: 'Nungambakkam',
    600029: 'Aminjikarai',    600032: 'Vadapalani',
    600033: 'Saidapet',       600034: 'Teynampet',
    600035: 'Alandur',        600036: 'St. Thomas Mount',
    600040: 'Virugambakkam',  600042: 'Thiruvanmiyur',
    600044: 'Tambaram',       600045: 'Pallavaram',
    600050: 'Arumbakkam',     600053: 'Ambattur',
    600056: 'Porur',          600058: 'Washermanpet',
    600061: 'Chromepet',      600064: 'Vandalur',
    600078: 'Valasaravakkam', 600081: 'Manali',
    600082: 'Madhavaram',     600083: 'Villivakkam',
    600090: 'Velachery',      600096: 'OMR',
    600099: 'Poonamallee',    600118: 'Kathivakkam',
  };

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

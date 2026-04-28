import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import '../models/sos_alert.dart';
import '../services/api_service.dart';
import '../services/location_service.dart';
import 'sos_detail_screen.dart';
import 'optimised_route_screen.dart';
import 'monitor_screen.dart';

// ── Nominatim pincode boundary fetcher ───────────────────────────────────────
// Fetches polygon boundaries from OSM Nominatim — no file assets needed.

Future<List<Polygon>> fetchPincodePolygon(String pincode, String risk) async {
  try {
    final url = Uri.parse(
      'https://nominatim.openstreetmap.org/search'
      '?q=$pincode,Chennai,Tamil+Nadu,India'
      '&format=geojson&polygon_geojson=1&limit=1',
    );
    final res = await http
        .get(url, headers: {'User-Agent': 'Rakshak/1.0'})
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return [];

    final geo      = jsonDecode(res.body) as Map<String, dynamic>;
    final features = geo['features'] as List<dynamic>;
    if (features.isEmpty) return [];

    final fillColor = risk == 'HIGH'
        ? const Color(0xFFef4444).withValues(alpha: 0.40)
        : risk == 'MEDIUM'
            ? const Color(0xFFf59e0b).withValues(alpha: 0.35)
            : const Color(0xFF22c55e).withValues(alpha: 0.25);

    final borderColor = risk == 'HIGH'
        ? const Color(0xFFef4444)
        : risk == 'MEDIUM'
            ? const Color(0xFFf59e0b)
            : const Color(0xFF22c55e);

    final polygons = <Polygon>[];
    final geom     = features[0]['geometry'] as Map<String, dynamic>;
    final type     = geom['type'] as String;
    final coords   = geom['coordinates'] as List<dynamic>;

    final rings = <List<dynamic>>[];
    if (type == 'Polygon') {
      rings.add(coords[0] as List<dynamic>);
    } else if (type == 'MultiPolygon') {
      for (final p in coords) {
        rings.add((p as List<dynamic>)[0] as List<dynamic>);
      }
    }

    for (final ring in rings) {
      final points = ring.map((c) {
        final coord = c as List<dynamic>;
        return LatLng(
          (coord[1] as num).toDouble(),
          (coord[0] as num).toDouble(),
        );
      }).toList();
      if (points.length >= 3) {
        polygons.add(Polygon(
          points:            points,
          color:             fillColor,
          borderColor:       borderColor,
          borderStrokeWidth: 1.5,
          isFilled:          true,
        ));
      }
    }
    return polygons;
  } catch (_) {
    return [];
  }
}

// ── MapScreen ─────────────────────────────────────────────────────────────────

class MapScreen extends StatefulWidget {
  final String officerBadge;
  final String officerName;

  const MapScreen({
    super.key,
    required this.officerBadge,
    required this.officerName,
  });

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> with TickerProviderStateMixin {
  static const _bg      = Color(0xFF0d1117);
  static const _surface = Color(0xFF161b22);
  static const _teal    = Color(0xFF00d4b4);
  static const _red     = Color(0xFFef4444);
  static const _textPri = Color(0xFFf0f6fc);
  static const _textMut = Color(0xFF8b949e);

  // Zone risk — seeded with defaults, updated every 60s from /score/refresh
  Map<String, String> _zoneRisk = {
    '600017': 'HIGH',
    '600081': 'HIGH',
    '600006': 'MEDIUM',
    '600004': 'MEDIUM',
    '600058': 'LOW',
  };

  // Cached polygon ring geometry per pincode (avoids re-fetching Nominatim)
  final Map<String, List<List<LatLng>>> _polygonRings = {};

  int _tab = 0;
  LatLng _officerPos = const LatLng(13.0827, 80.2707);
  List<SosAlert> _alerts    = [];
  List<Polygon>  _kmlPolygons = [];
  bool _zonesLoading = true;
  Timer? _pollTimer;
  Timer? _riskTimer;
  late AnimationController _pulseCtrl;
  late Animation<double>   _pulseAnim;
  final MapController _mapController = MapController();

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.4, end: 1.0).animate(_pulseCtrl);

    _initLocation();
    _loadZones();
    _pollSos();
    _pollTimer = Timer.periodic(const Duration(seconds: 10), (_) => _pollSos());
    // Refresh zone risk scores every 60 seconds from /score/refresh
    _riskTimer = Timer.periodic(const Duration(seconds: 60), (_) => _refreshRisk());
  }

  Future<void> _initLocation() async {
    final pos = await LocationService.getCurrentLocation();
    if (mounted) setState(() => _officerPos = pos);
  }

  Future<void> _loadZones() async {
    final all = <Polygon>[];
    for (final entry in _zoneRisk.entries) {
      final polys = await fetchPincodePolygon(entry.key, entry.value);
      all.addAll(polys);
      // Cache ring geometry so we can recolor without re-fetching Nominatim
      _polygonRings[entry.key] = polys.map((p) => p.points).toList();
      // Nominatim rate limit: 1 req/sec
      await Future.delayed(const Duration(milliseconds: 300));
    }
    if (mounted) setState(() { _kmlPolygons = all; _zonesLoading = false; });
  }

  /// Poll /score/refresh every 60s and recolor zones if risk levels change.
  Future<void> _refreshRisk() async {
    final zones = _zoneRisk.keys.map((code) => {
      'pincode': code,
      'hour': DateTime.now().hour,
      'day_of_week': DateTime.now().weekday % 7,
    }).toList();

    final result = await ApiService.refreshScores(zones);
    if (result.isEmpty || !mounted) return;

    final raw = result['results'] ?? result['zones'] ?? result;
    if (raw is! List) return;

    bool changed = false;
    for (final r in raw) {
      final code  = r['pincode']?.toString() ?? '';
      final level = (r['risk_level'] ?? r['riskLevel'])?.toString().toUpperCase() ?? '';
      if (code.isNotEmpty && level.isNotEmpty && _zoneRisk[code] != level) {
        _zoneRisk[code] = level;
        changed = true;
      }
    }

    if (changed) _rebuildPolygons();
  }

  /// Rebuild Polygon objects from cached ring geometry with updated risk colors.
  void _rebuildPolygons() {
    final all = <Polygon>[];
    for (final entry in _polygonRings.entries) {
      final risk        = _zoneRisk[entry.key] ?? 'LOW';
      final fillColor   = risk == 'HIGH'
          ? const Color(0xFFef4444).withValues(alpha: 0.40)
          : risk == 'MEDIUM'
              ? const Color(0xFFf59e0b).withValues(alpha: 0.35)
              : const Color(0xFF22c55e).withValues(alpha: 0.25);
      final borderColor = risk == 'HIGH'
          ? const Color(0xFFef4444)
          : risk == 'MEDIUM'
              ? const Color(0xFFf59e0b)
              : const Color(0xFF22c55e);
      for (final points in entry.value) {
        if (points.length >= 3) {
          all.add(Polygon(
            points:            points,
            color:             fillColor,
            borderColor:       borderColor,
            borderStrokeWidth: 1.5,
            isFilled:          true,
          ));
        }
      }
    }
    if (mounted) setState(() => _kmlPolygons = all);
  }

  Future<void> _pollSos() async {
    final alerts = await ApiService.fetchActiveSos(
      officerLat: _officerPos.latitude,
      officerLng: _officerPos.longitude,
    );
    if (mounted) setState(() => _alerts = alerts);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _riskTimer?.cancel();
    _pulseCtrl.dispose();
    super.dispose();
  }

  void _openSosDetail(SosAlert alert) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => SosDetailScreen(alert: alert),
    );
  }

  // ── Zoom button ───────────────────────────────────────────────────────────
  Widget _zoomBtn(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 36, height: 36,
        decoration: BoxDecoration(
          color: const Color(0xFF1c2128),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: Colors.white12),
        ),
        child: Icon(icon, color: Colors.white70, size: 18),
      ),
    );
  }

  Widget _buildMap() {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: const MapOptions(
            initialCenter: LatLng(13.0827, 80.2707),
            initialZoom: 11.0,
            minZoom: 9.0,
            maxZoom: 16.0,
            backgroundColor: Color(0xFF0d1117),
          ),
          children: [
            TileLayer(
              urlTemplate:
                  'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
              userAgentPackageName: 'com.rakshak.police',
            ),
            // Zone polygons from Nominatim
            if (_kmlPolygons.isNotEmpty)
              PolygonLayer(polygons: _kmlPolygons),
            // SOS alert markers
            MarkerLayer(
              markers: _alerts.map((alert) {
                final idx = _alerts.indexOf(alert);
                final lat = alert.lat ?? 13.0827 + (idx * 0.01);
                final lng = alert.lng ?? 80.2707 + (idx * 0.01);
                return Marker(
                  point: LatLng(lat, lng),
                  width: 40, height: 40,
                  child: GestureDetector(
                    onTap: () => _openSosDetail(alert),
                    child: AnimatedBuilder(
                      animation: _pulseAnim,
                      builder: (_, __) => Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _red.withValues(alpha: _pulseAnim.value * 0.3),
                          border: Border.all(color: _red, width: 2),
                        ),
                        child: const Icon(Icons.warning_rounded, color: _red, size: 20),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
            // Officer position marker
            MarkerLayer(
              markers: [
                Marker(
                  point: _officerPos,
                  width: 48, height: 48,
                  child: AnimatedBuilder(
                    animation: _pulseAnim,
                    builder: (_, __) => Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFF3b82f6)
                            .withValues(alpha: _pulseAnim.value * 0.25),
                        border: Border.all(
                            color: const Color(0xFF3b82f6), width: 2.5),
                      ),
                      child: const Icon(Icons.person_pin_circle,
                          color: Color(0xFF3b82f6), size: 24),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),

        // Zoom buttons
        Positioned(
          bottom: 100, right: 12,
          child: Column(
            children: [
              _zoomBtn(Icons.add, () => _mapController.move(
                _mapController.camera.center,
                _mapController.camera.zoom + 1,
              )),
              const SizedBox(height: 4),
              _zoomBtn(Icons.remove, () => _mapController.move(
                _mapController.camera.center,
                _mapController.camera.zoom - 1,
              )),
            ],
          ),
        ),

        // Loading indicator while zones fetch
        if (_zonesLoading)
          Positioned(
            top: 12, left: 0, right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _surface.withValues(alpha: 0.9),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      width: 10, height: 10,
                      child: CircularProgressIndicator(
                          strokeWidth: 1.5, color: Color(0xFF00d4b4)),
                    ),
                    SizedBox(width: 6),
                    Text('Loading zones…',
                        style: TextStyle(color: Color(0xFF8b949e), fontSize: 11)),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildAlertsTab() {
    if (_alerts.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_outline, color: Color(0xFF22c55e), size: 48),
            SizedBox(height: 12),
            Text('No active SOS alerts',
                style: TextStyle(color: Color(0xFF8b949e))),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _alerts.length,
      itemBuilder: (_, i) {
        final a = _alerts[i];
        return GestureDetector(
          onTap: () => _openSosDetail(a),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _surface,
              borderRadius: BorderRadius.circular(8),
              border: const Border(left: BorderSide(color: _red, width: 3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_rounded, color: _red, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(a.zoneName,
                          style: const TextStyle(
                              color: _textPri, fontWeight: FontWeight.w600)),
                      Text(a.riskLevel,
                          style: const TextStyle(color: _red, fontSize: 12)),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: _textMut),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final activeAlerts = _alerts.where((a) => a.status == 'dispatched').length;

    return Scaffold(
      backgroundColor: _bg,
      body: SafeArea(
        child: Column(
          children: [
            // ── Top bar ──────────────────────────────────────────────────
            Container(
              color: _surface,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  const Icon(Icons.shield, color: _teal, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.officerName,
                            style: const TextStyle(
                                color: _textPri,
                                fontSize: 14,
                                fontWeight: FontWeight.w600)),
                        Text(widget.officerBadge,
                            style: const TextStyle(
                                color: _textMut,
                                fontSize: 11,
                                fontFamily: 'monospace')),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: const Color(0xFF22c55e).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                          color: const Color(0xFF22c55e).withValues(alpha: 0.4)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.circle, color: Color(0xFF22c55e), size: 8),
                        SizedBox(width: 4),
                        Text('ON DUTY',
                            style: TextStyle(
                                color: Color(0xFF22c55e),
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1)),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            // ── Content ──────────────────────────────────────────────────
            Expanded(
              child: IndexedStack(
                index: _tab,
                children: [
                  // MAP tab
                  Stack(
                    children: [
                      _buildMap(),
                      if (activeAlerts > 0)
                        Positioned(
                          bottom: 0, left: 0, right: 0,
                          child: Container(
                            color: _red.withValues(alpha: 0.9),
                            padding: const EdgeInsets.symmetric(
                                vertical: 10, horizontal: 16),
                            child: Text(
                              '$activeAlerts ACTIVE SOS ALERT${activeAlerts > 1 ? 'S' : ''}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 13,
                                  letterSpacing: 1),
                            ),
                          ),
                        ),
                      Positioned(
                        bottom: activeAlerts > 0 ? 52 : 16,
                        right: 56,
                        child: FloatingActionButton.extended(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => OptimisedRouteScreen(
                                officerPos: _officerPos,
                                alerts: _alerts,
                              ),
                            ),
                          ),
                          backgroundColor: _teal,
                          foregroundColor: const Color(0xFF00382e),
                          icon: const Icon(Icons.bolt, size: 18),
                          label: const Text('GET OPTIMISED ROUTE',
                              style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.5)),
                        ),
                      ),
                    ],
                  ),
                  _buildAlertsTab(),
                  const Center(
                      child: Text('Patrol Management',
                          style: TextStyle(color: Color(0xFF8b949e)))),
                  const MonitorScreen(),
                ],
              ),
            ),

            // ── Bottom nav ───────────────────────────────────────────────
            Container(
              color: _surface,
              child: Row(
                children: [
                  _navItem(0, Icons.map_outlined, 'MAP'),
                  _navItem(1, Icons.warning_amber_outlined, 'ALERTS',
                      badge: activeAlerts > 0 ? activeAlerts.toString() : null),
                  _navItem(2, Icons.directions_car_outlined, 'PATROL'),
                  _navItem(3, Icons.monitor_heart_outlined, 'MONITOR'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navItem(int index, IconData icon, String label, {String? badge}) {
    final active = _tab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          color: Colors.transparent,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, color: active ? _teal : _textMut, size: 22),
                  if (badge != null)
                    Positioned(
                      top: -4, right: -6,
                      child: Container(
                        padding: const EdgeInsets.all(3),
                        decoration: const BoxDecoration(
                            color: _red, shape: BoxShape.circle),
                        child: Text(badge,
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                fontWeight: FontWeight.w700)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 3),
              Text(label,
                  style: TextStyle(
                      color: active ? _teal : _textMut,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5)),
            ],
          ),
        ),
      ),
    );
  }
}

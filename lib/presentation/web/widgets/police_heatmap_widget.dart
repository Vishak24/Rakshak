import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../../../domain/models/zone_risk.dart';
import '../../../domain/providers/heatmap_data_provider.dart';
import '../../../domain/providers/patrol_manager_provider.dart';
import '../../../shared/constants.dart';

class PoliceHeatmapWidget extends ConsumerStatefulWidget {
  const PoliceHeatmapWidget({super.key});

  @override
  ConsumerState<PoliceHeatmapWidget> createState() =>
      _PoliceHeatmapWidgetState();
}

class _PoliceHeatmapWidgetState extends ConsumerState<PoliceHeatmapWidget> {
  GoogleMapController? _mapController;
  Set<Circle> _circles = {};
  Set<Marker> _markers = {};

  @override
  Widget build(BuildContext context) {
    final heatmapDataAsync = ref.watch(heatmapDataProvider);
    final patrolRecords = ref.watch(patrolManagerProvider);

    return heatmapDataAsync.when(
      data: (zones) {
        _updateHeatmapOverlays(zones, patrolRecords);

        return GoogleMap(
          initialCameraPosition: const CameraPosition(
            target: LatLng(MapConstants.chennaiLat, MapConstants.chennaiLng),
            zoom: MapConstants.defaultZoom,
          ),
          onMapCreated: (controller) {
            _mapController = controller;
          },
          circles: _circles,
          markers: _markers,
          zoomControlsEnabled: true,
          compassEnabled: true,
        );
      },
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, stack) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 48, color: Colors.red),
            const SizedBox(height: 16),
            Text('Error loading heatmap: $error'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => ref.read(heatmapDataProvider.notifier).refresh(),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  void _updateHeatmapOverlays(
    List<ZoneRisk> zones,
    Map<String, DateTime> patrolRecords,
  ) {
    final circles = <Circle>{};
    final markers = <Marker>{};

    for (final zone in zones) {
      final latLng = LatLng(zone.latitude, zone.longitude);
      final isPatrolled = patrolRecords.containsKey(zone.zoneId);

      // Determine weight/opacity based on risk level
      double weight;
      switch (zone.assessment.riskLevel) {
        case 'High':
          weight = RiskConstants.highWeight;
          break;
        case 'Medium':
          weight = RiskConstants.mediumWeight;
          break;
        case 'Low':
          weight = RiskConstants.lowWeight;
          break;
        default:
          weight = 0.1;
      }

      // Create circle for each zone
      circles.add(
        Circle(
          circleId: CircleId(zone.zoneId),
          center: latLng,
          radius: MapConstants.heatmapRadius * 10, // Scale for visibility
          fillColor: zone.assessment.displayColor
              .withValues(alpha: MapConstants.heatmapOpacity * weight),
          strokeColor: zone.assessment.displayColor,
          strokeWidth: 1,
        ),
      );

      // Add marker for high-risk zones
      if (zone.isHighRisk) {
        markers.add(
          Marker(
            markerId: MarkerId(zone.zoneId),
            position: latLng,
            icon: BitmapDescriptor.defaultMarkerWithHue(
              isPatrolled
                  ? BitmapDescriptor.hueGreen
                  : BitmapDescriptor.hueRed,
            ),
            infoWindow: InfoWindow(
              title: zone.assessment.riskLevel,
              snippet:
                  '${(zone.assessment.confidence * 100).toStringAsFixed(0)}% confidence',
            ),
          ),
        );
      }
    }

    setState(() {
      _circles = circles;
      _markers = markers;
    });
  }

  @override
  void dispose() {
    _mapController?.dispose();
    super.dispose();
  }
}

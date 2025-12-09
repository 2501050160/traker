// Vehicle Controller Script
// Controls vehicle movement, speed, and path

class VehicleController {
    constructor() {
        this.map = null;
        this.selectedVehicle = null;
        this.vehicles = [];
        this.currentPath = [];
        this.pathFollowing = false;
        this.currentPathIndex = 0;
        this.controlInterval = null;
        this.markers = {};
        this.routePolyline = null;
        this.customVehicleIcon = null;
        this.statusUpdateInterval = null;
        this.alertQueue = [];
        this.savedRoutes = {}; // Store multiple routes
        this.routeManager = null;
        this.speedLimit = 60; // Default speed limit
        this.isStoppedAtWaypoint = false;
        this.stopTimer = null;
        this.roadSnappedPath = null; // Store road-snapped path from Directions Service
        this.roadPathIndex = 0; // Current index in road-snapped path
        
        this.init();
    }

    init() {
        this.initMap();
        this.loadVehicles();
        this.setupEventListeners();
        this.loadFromLocalStorage();
        this.startLiveStatusUpdates();
        this.createAlertContainer();
        this.startControllerArrivalTimeUpdates();
        this.loadSavedRoutesFromStorage();
    }

    initMap() {
        const defaultCenter = { lat: 17.6868, lng: 83.2185 };
        
        this.map = new google.maps.Map(document.getElementById('controllerMap'), {
            zoom: 13,
            center: defaultCenter,
            mapTypeId: 'roadmap',
            styles: [
                {
                    featureType: 'all',
                    elementType: 'geometry',
                    stylers: [{ color: '#1e293b' }]
                },
                {
                    featureType: 'all',
                    elementType: 'labels.text.fill',
                    stylers: [{ color: '#94a3b8' }]
                }
            ]
        });

        // Initialize Directions Service for road snapping
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#4A90E2',
                strokeWeight: 4,
                strokeOpacity: 0.8
            }
        });

        // Create coordinate display element
        this.createCoordinateDisplay();
        
        // Add mouse move listener for coordinate display
        this.map.addListener('mousemove', (e) => {
            this.updateCoordinateDisplay(e.latLng);
        });

        // Add click listener for setting position
        this.map.addListener('click', (e) => {
            if (this.isSettingPosition && this.selectedVehicle) {
                this.setPositionFromMap(e.latLng);
            } else if (this.isSettingPosition) {
                this.showAlert('warning', 'Please select a vehicle first!');
            }
        });
    }

    createCoordinateDisplay() {
        // Create coordinate display div
        this.coordinateDisplay = document.createElement('div');
        this.coordinateDisplay.id = 'coordinateDisplay';
        this.coordinateDisplay.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 20px;
            background: rgba(30, 41, 59, 0.9);
            color: #f1f5f9;
            padding: 10px 15px;
            border-radius: 8px;
            font-size: 0.9rem;
            font-family: monospace;
            z-index: 1000;
            border: 1px solid #334155;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        `;
        this.coordinateDisplay.innerHTML = 'Move mouse over map to see coordinates';
        
        const mapContainer = document.getElementById('controllerMap');
        mapContainer.style.position = 'relative';
        mapContainer.appendChild(this.coordinateDisplay);
    }

    updateCoordinateDisplay(latLng) {
        if (this.coordinateDisplay && latLng) {
            this.coordinateDisplay.innerHTML = `
                <div><strong>Lat:</strong> ${latLng.lat().toFixed(6)}</div>
                <div><strong>Lng:</strong> ${latLng.lng().toFixed(6)}</div>
                ${this.isSettingPosition ? '<div style="color: #10b981; margin-top: 5px;">Click to set position</div>' : ''}
            `;
        }
    }

    setPositionFromMap(latLng) {
        if (!this.selectedVehicle) {
            this.showAlert('warning', 'Please select a vehicle first!');
            this.isSettingPosition = false;
            return;
        }

        // Update vehicle position
        this.selectedVehicle.lat = latLng.lat();
        this.selectedVehicle.lng = latLng.lng();
        
        // Update manual position inputs
        document.getElementById('manualLat').value = latLng.lat().toFixed(6);
        document.getElementById('manualLng').value = latLng.lng().toFixed(6);

        // Update marker
        if (this.markers.vehicle) {
            this.markers.vehicle.setPosition(latLng);
        } else {
            this.addVehicleMarker();
        }

        // Center map on new position
        this.map.setCenter(latLng);
        this.map.setZoom(15);
        
        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        this.isSettingPosition = false;
        
        // Update button state
        document.getElementById('setPositionBtn').textContent = '📍 Click Map to Set Position';
        document.getElementById('setPositionBtn').style.background = '#2563eb';
        
        this.showAlert('success', `Position set! Lat: ${latLng.lat().toFixed(6)}, Lng: ${latLng.lng().toFixed(6)}`);
        this.addLog('success', `Position set to ${latLng.lat().toFixed(6)}, ${latLng.lng().toFixed(6)}`);
        
        // If path exists, ask if user wants to start
        if (this.currentPath.length > 0) {
            setTimeout(() => {
                if (confirm('Path is loaded. Do you want to start following the path now?')) {
                    this.startFollowingPath();
                }
            }, 500);
        }
    }

    loadVehicles() {
        // Load vehicles from localStorage or use defaults
        const savedVehicles = localStorage.getItem('controlledVehicles');
        if (savedVehicles) {
            try {
                this.vehicles = JSON.parse(savedVehicles);
            } catch (e) {
                this.vehicles = this.getDefaultVehicles();
            }
        } else {
            this.vehicles = this.getDefaultVehicles();
        }
    }

    getDefaultVehicles() {
        return [
            {
                id: 'BUS-001',
                name: 'School Bus 1',
                lat: 17.6868,
                lng: 83.2185,
                speed: 0,
                status: 'stopped',
                engineStatus: 'off'
            },
            {
                id: 'BUS-002',
                name: 'School Bus 2',
                lat: 17.6900,
                lng: 83.2200,
                speed: 0,
                status: 'stopped',
                engineStatus: 'off'
            },
            {
                id: 'BUS-003',
                name: 'School Bus 3',
                lat: 17.6800,
                lng: 83.2150,
                speed: 0,
                status: 'stopped',
                engineStatus: 'off'
            }
        ];
    }

    setupEventListeners() {
        // Vehicle selection
        document.getElementById('vehicleSelect').addEventListener('change', (e) => {
            this.selectVehicle(e.target.value);
        });

        // Add custom vehicle
        document.getElementById('addVehicleBtn').addEventListener('click', () => {
            this.addCustomVehicle();
        });

        // Speed control - real-time updates
        document.getElementById('speedSlider').addEventListener('input', (e) => {
            const speed = parseInt(e.target.value);
            document.getElementById('currentSpeedDisplay').textContent = speed;
            if (this.selectedVehicle) {
                // Don't allow speed change if engine is locked
                if (this.selectedVehicle.engineStatus === 'locked') {
                    e.target.value = 0;
                    document.getElementById('currentSpeedDisplay').textContent = 0;
                    this.showAlert('warning', 'Engine is locked! Unlock engine first to change speed.');
                    return;
                }
                this.setSpeed(speed);
            }
        });

        // Speed buttons
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!this.selectedVehicle) {
                    this.showAlert('warning', 'Please select a vehicle first');
                    return;
                }
                
                // Don't allow speed change if engine is locked
                if (this.selectedVehicle.engineStatus === 'locked') {
                    this.showAlert('warning', 'Engine is locked! Unlock engine first to change speed.');
                    return;
                }
                
                const speed = parseInt(btn.dataset.speed);
                document.getElementById('speedSlider').value = speed;
                document.getElementById('currentSpeedDisplay').textContent = speed;
                this.setSpeed(speed);
            });
        });

        // Movement controls
        document.getElementById('startBtn').addEventListener('click', () => this.startVehicle());
        document.getElementById('stopBtn').addEventListener('click', () => this.stopVehicle());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseVehicle());

        // Engine controls
        document.getElementById('engineLockBtn').addEventListener('click', () => this.lockEngine());
        document.getElementById('engineUnlockBtn').addEventListener('click', () => this.unlockEngine());

        // Path controls
        document.getElementById('loadPathBtn').addEventListener('click', () => this.loadPathFromExcel());
        document.getElementById('clearPathBtn').addEventListener('click', () => this.clearPath());
        document.getElementById('startPathBtn').addEventListener('click', () => this.startFollowingPath());
        document.getElementById('stopPathBtn').addEventListener('click', () => this.stopFollowingPath());
        
        // Route management
        document.getElementById('saveRouteBtn').addEventListener('click', () => this.saveCurrentRoute());
        document.getElementById('loadRouteBtn').addEventListener('click', () => this.showRouteSelector());
        
        // Speed limit
        document.getElementById('setSpeedLimitBtn').addEventListener('click', () => this.setSpeedLimit());
        document.getElementById('speedLimitInput').addEventListener('change', () => {
            this.speedLimit = parseFloat(document.getElementById('speedLimitInput').value);
            document.getElementById('speedLimitStatus').textContent = `Current: ${this.speedLimit} km/h`;
        });

        // Position control - Click map to set
        document.getElementById('setPositionBtn').addEventListener('click', () => {
            if (!this.selectedVehicle) {
                this.showAlert('warning', 'Please select a vehicle first!');
                return;
            }
            
            if (this.isSettingPosition) {
                // Cancel setting position
                this.isSettingPosition = false;
                document.getElementById('setPositionBtn').textContent = '📍 Click Map to Set Position';
                document.getElementById('setPositionBtn').style.background = '#2563eb';
                this.addLog('info', 'Position setting cancelled');
            } else {
                // Enable map click to set position
                this.isSettingPosition = true;
                document.getElementById('setPositionBtn').textContent = '✖️ Cancel (Click Map to Set)';
                document.getElementById('setPositionBtn').style.background = '#ef4444';
                this.showAlert('info', 'Click anywhere on the map to set vehicle position');
                this.addLog('info', 'Click on map to set vehicle position');
            }
        });

        // Manual position set button
        document.getElementById('setManualPositionBtn').addEventListener('click', () => {
            this.setManualPosition();
        });
        
        // Manual position input (alternative method)
        document.getElementById('manualLat').addEventListener('change', () => {
            const lat = parseFloat(document.getElementById('manualLat').value);
            const lng = parseFloat(document.getElementById('manualLng').value);
            if (lat && lng && this.selectedVehicle) {
                this.selectedVehicle.lat = lat;
                this.selectedVehicle.lng = lng;
                if (this.markers.vehicle) {
                    this.markers.vehicle.setPosition({ lat, lng });
                }
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
            }
        });
        
        document.getElementById('manualLng').addEventListener('change', () => {
            const lat = parseFloat(document.getElementById('manualLat').value);
            const lng = parseFloat(document.getElementById('manualLng').value);
            if (lat && lng && this.selectedVehicle) {
                this.selectedVehicle.lat = lat;
                this.selectedVehicle.lng = lng;
                if (this.markers.vehicle) {
                    this.markers.vehicle.setPosition({ lat, lng });
                }
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
            }
        });

        // Map controls
        document.getElementById('centerMapBtn').addEventListener('click', () => this.centerMap());
        document.getElementById('clearMapBtn').addEventListener('click', () => this.clearMap());
        document.getElementById('drawRouteBtn').addEventListener('click', () => {
            if (this.drawingMode) {
                this.disableRouteDrawing();
            } else {
                this.enableRouteDrawing();
            }
        });

        // Other buttons
        document.getElementById('loadExcelBtn').addEventListener('click', () => this.loadPathFromExcel());
        document.getElementById('saveToExcelBtn').addEventListener('click', () => this.saveToExcel());
        document.getElementById('dashboardBtn').addEventListener('click', () => {
            window.open('transport-dashboard.html', '_blank');
        });

        // Vehicle icon upload
        document.getElementById('uploadIconBtn').addEventListener('click', () => {
            document.getElementById('vehicleIconInput').click();
        });
        document.getElementById('vehicleIconInput').addEventListener('change', (e) => {
            this.handleIconUpload(e);
        });
    }

    selectVehicle(vehicleId) {
        if (!vehicleId) {
            this.selectedVehicle = null;
            this.updateStatusDisplay();
            return;
        }

        this.selectedVehicle = this.vehicles.find(v => v.id === vehicleId);
        if (this.selectedVehicle) {
            this.updateStatusDisplay();
            this.centerMap();
            this.addVehicleMarker();
            this.addLog('success', `Selected vehicle: ${vehicleId}`);
        }
    }

    addCustomVehicle() {
        const vehicleId = prompt('Enter Vehicle ID (e.g., BUS-004):');
        if (!vehicleId) return;
        
        const vehicleName = prompt('Enter Vehicle Name:') || vehicleId;
        
        // Check if vehicle already exists
        if (this.vehicles.find(v => v.id === vehicleId)) {
            this.addLog('warning', `Vehicle ${vehicleId} already exists`);
            return;
        }
        
        const newVehicle = {
            id: vehicleId,
            name: vehicleName,
            lat: 17.6868, // Default position
            lng: 83.2185,
            speed: 0,
            status: 'stopped',
            engineStatus: 'off'
        };
        
        this.vehicles.push(newVehicle);
        this.saveToLocalStorage();
        
        // Add to dropdown
        const select = document.getElementById('vehicleSelect');
        const option = document.createElement('option');
        option.value = vehicleId;
        option.textContent = `${vehicleId} - ${vehicleName}`;
        select.appendChild(option);
        
        // Select the new vehicle
        select.value = vehicleId;
        this.selectVehicle(vehicleId);
        
        this.addLog('success', `Custom vehicle ${vehicleId} added`);
    }

    addVehicleMarker() {
        if (!this.selectedVehicle) return;

        // Remove existing vehicle marker
        if (this.markers.vehicle) {
            this.markers.vehicle.setMap(null);
        }

        // Use custom icon if available, otherwise use default car icon
        let iconConfig;
        
        if (this.customVehicleIcon) {
            // Use uploaded custom icon
            iconConfig = {
                url: this.customVehicleIcon,
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20)
            };
        } else {
            // Use web-based car icon with SVG
            const statusColor = this.selectedVehicle.status === 'overspeed' ? '#ef4444' : 
                               this.selectedVehicle.status === 'moving' ? '#10b981' : '#6b7280';
            
            const svgIcon = `
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
                    <path fill="${statusColor}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
            `;
            
            iconConfig = {
                url: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20)
            };
        }

        this.markers.vehicle = new google.maps.Marker({
            position: { lat: this.selectedVehicle.lat, lng: this.selectedVehicle.lng },
            map: this.map,
            title: this.selectedVehicle.name,
            icon: iconConfig,
            zIndex: 1000,
            animation: this.selectedVehicle.status === 'moving' ? google.maps.Animation.BOUNCE : null
        });
    }

    handleIconUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showAlert('error', 'Please upload an image file!');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.customVehicleIcon = e.target.result;
            if (this.markers.vehicle) {
                this.addVehicleMarker(); // Recreate marker with new icon
            }
            this.showAlert('success', 'Vehicle icon uploaded successfully!');
            this.addLog('success', 'Vehicle icon updated');
        };
        reader.readAsDataURL(file);
    }

    setSpeed(speed) {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.selectedVehicle.speed = speed;
        if (speed > 0) {
            this.selectedVehicle.status = 'moving';
            this.selectedVehicle.engineStatus = 'on';
        } else {
            this.selectedVehicle.status = 'stopped';
        }

        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.addLog('success', `Speed set to ${speed} km/h for ${this.selectedVehicle.id}`);
        
        // Broadcast to dashboard
        this.broadcastVehicleUpdate();
    }

    startVehicle() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        // Don't start if engine is locked
        if (this.selectedVehicle.engineStatus === 'locked') {
            this.showAlert('warning', 'Engine is locked! Unlock engine first.');
            return;
        }

        this.selectedVehicle.engineStatus = 'on';
        this.selectedVehicle.status = 'moving';
        if (this.selectedVehicle.speed === 0) {
            this.selectedVehicle.speed = 20;
            document.getElementById('speedSlider').value = 20;
            document.getElementById('currentSpeedDisplay').textContent = 20;
        }

        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        this.showAlert('success', `Vehicle ${this.selectedVehicle.id} started`);
        this.addLog('success', `Vehicle ${this.selectedVehicle.id} started`);
    }

    stopVehicle() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.selectedVehicle.speed = 0;
        this.selectedVehicle.status = 'stopped';
        this.selectedVehicle.engineStatus = 'off';
        document.getElementById('speedSlider').value = 0;
        document.getElementById('currentSpeedDisplay').textContent = 0;

        // Stop path following
        if (this.pathFollowing) {
            this.pathFollowing = false;
        }

        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        this.showAlert('info', `Vehicle ${this.selectedVehicle.id} stopped`);
        this.addLog('success', `Vehicle ${this.selectedVehicle.id} stopped`);
    }

    pauseVehicle() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.selectedVehicle.status = 'paused';
        this.updateStatusDisplay();
        this.broadcastVehicleUpdate();
        this.addLog('info', `Vehicle ${this.selectedVehicle.id} paused`);
    }

    lockEngine() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.selectedVehicle.engineStatus = 'locked';
        this.selectedVehicle.speed = 0;
        this.selectedVehicle.status = 'stopped';
        document.getElementById('speedSlider').value = 0;
        document.getElementById('currentSpeedDisplay').textContent = 0;

        // Stop path following if active
        if (this.pathFollowing) {
            this.pathFollowing = false;
            this.showAlert('warning', 'Path following stopped - Engine locked');
        }

        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        this.showAlert('error', `Engine locked for ${this.selectedVehicle.id} - Vehicle will not move`);
        this.addLog('error', `Engine locked for ${this.selectedVehicle.id}`);
    }

    unlockEngine() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.selectedVehicle.engineStatus = 'on';
        this.updateStatusDisplay();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        this.addLog('success', `Engine unlocked for ${this.selectedVehicle.id}`);
    }

    loadPathFromExcel() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.xlsx,.xls';
        fileInput.style.display = 'none';
        
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = new Uint8Array(event.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames.find(name => 
                        name.toLowerCase().includes('path') || name.toLowerCase().includes('vehicle')
                    ) || workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    this.processPathData(jsonData);
                    this.addLog('success', 'Path loaded from Excel');
                } catch (error) {
                    this.addLog('error', 'Error loading Excel: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };
        
        fileInput.click();
    }

    processPathData(data) {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        this.currentPath = [];
        
        data.forEach(row => {
            const vehicleId = row['Vehicle ID'] || row['vehicle_id'] || row['VehicleId'];
            if (vehicleId !== this.selectedVehicle.id) return;
            
            const point = {
                order: parseInt(row['Point Order'] || row['point_order'] || 0),
                lat: parseFloat(row['Latitude'] || row['latitude'] || 0),
                lng: parseFloat(row['Longitude'] || row['longitude'] || 0),
                speed: parseFloat(row['Speed (km/h)'] || row['speed'] || 0),
                stopDuration: parseInt(row['Stop Duration (sec)'] || row['stop_duration'] || 0),
                description: row['Description'] || row['description'] || ''
            };
            
            if (point.lat && point.lng) {
                this.currentPath.push(point);
            }
        });
        
        this.currentPath.sort((a, b) => a.order - b.order);
        this.drawPathOnMap();
        this.updatePathInfo();
        this.addLog('success', `Loaded ${this.currentPath.length} path points`);
    }

    drawPathOnMap() {
        if (this.directionsRenderer) {
            this.directionsRenderer.setDirections({ routes: [] });
        }
        if (this.routePolyline) {
            this.routePolyline.setMap(null);
        }

        if (this.currentPath.length < 2) return;

        // Use Directions Service to render road-snapped path
        const waypoints = [];
        for (let i = 1; i < this.currentPath.length - 1; i++) {
            waypoints.push({
                location: new google.maps.LatLng(this.currentPath[i].lat, this.currentPath[i].lng),
                stopover: false
            });
        }

        const request = {
            origin: new google.maps.LatLng(this.currentPath[0].lat, this.currentPath[0].lng),
            destination: new google.maps.LatLng(
                this.currentPath[this.currentPath.length - 1].lat,
                this.currentPath[this.currentPath.length - 1].lng
            ),
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
        };

        this.directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                this.directionsRenderer.setDirections(result);
                
                // Extract road-snapped path points for vehicle to follow
                this.roadSnappedPath = [];
                result.routes[0].legs.forEach((leg, legIndex) => {
                    leg.steps.forEach((step, stepIndex) => {
                        step.path.forEach((point) => {
                            this.roadSnappedPath.push({
                                lat: point.lat(),
                                lng: point.lng()
                            });
                        });
                    });
                });
                
                // Reset path index to start from beginning
                this.currentPathIndex = 0;
                this.roadPathIndex = 0;
                
                // Fit bounds to show entire route
                const bounds = new google.maps.LatLngBounds();
                result.routes[0].legs.forEach(leg => {
                    bounds.extend(leg.start_location);
                    bounds.extend(leg.end_location);
                });
                this.map.fitBounds(bounds);
            } else {
                // Fallback to simple polyline if directions fail
                this.roadSnappedPath = null;
                const routePath = this.currentPath.map(p => ({ lat: p.lat, lng: p.lng }));
                this.routePolyline = new google.maps.Polyline({
                    path: routePath,
                    geodesic: true,
                    strokeColor: '#4A90E2',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    map: this.map
                });
            }
        });

        // Add markers
        if (this.currentPath.length > 0) {
            const start = this.currentPath[0];
            const end = this.currentPath[this.currentPath.length - 1];
            
            if (!this.markers.start) {
                this.markers.start = new google.maps.Marker({
                    position: { lat: start.lat, lng: start.lng },
                    map: this.map,
                    title: 'Start',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: '#10b981',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2
                    },
                    label: { text: 'S', color: 'white', fontWeight: 'bold' }
                });
            }
            
            if (!this.markers.end) {
                this.markers.end = new google.maps.Marker({
                    position: { lat: end.lat, lng: end.lng },
                    map: this.map,
                    title: 'Destination',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: '#ef4444',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2
                    },
                    label: { text: 'E', color: 'white', fontWeight: 'bold' }
                });
            }
        }

        // Fit bounds
        if (this.currentPath.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            this.currentPath.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
            this.map.fitBounds(bounds);
        }
    }

    clearPath() {
        if (this.routePolyline) {
            this.routePolyline.setMap(null);
            this.routePolyline = null;
        }
        if (this.directionsRenderer) {
            this.directionsRenderer.setDirections({ routes: [] });
        }
        Object.values(this.markers).forEach(m => {
            if (m) m.setMap(null);
        });
        this.markers = {};
        this.currentPath = [];
        this.drawnPath = [];
        this.pathFollowing = false;
        this.currentPathIndex = 0;
        this.roadSnappedPath = null;
        this.roadPathIndex = 0;
        this.disableRouteDrawing();
        this.updatePathInfo();
        this.addLog('info', 'Path cleared');
    }

    startFollowingPath() {
        if (this.currentPath.length < 2) {
            this.addLog('warning', 'No path loaded. Load from Excel or draw a path first.');
            return;
        }

        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        // Ensure we have a road-snapped path
        if (!this.roadSnappedPath || this.roadSnappedPath.length === 0) {
            // Re-draw path to get road-snapped route
            this.drawPathOnMap();
            // Wait a bit for Directions Service to complete
            setTimeout(() => {
                if (this.roadSnappedPath && this.roadSnappedPath.length > 0) {
                    this.findNearestPathPoint();
                    this.pathFollowing = true;
                    this.pathStartTime = new Date();
                    this.calculateArrivalTime();
                    this.startArrivalTimeDisplay();
                    this.followPath();
                    this.addLog('success', 'Started following path');
                } else {
                    this.addLog('warning', 'Could not generate road-snapped path. Using direct path.');
                    this.findNearestPathPoint();
                    this.pathFollowing = true;
                    this.pathStartTime = new Date();
                    this.calculateArrivalTime();
                    this.startArrivalTimeDisplay();
                    this.followPath();
                }
            }, 1000);
        } else {
            // Find nearest point on path to current position
            this.findNearestPathPoint();
            
            this.pathFollowing = true;
            this.pathStartTime = new Date();
            this.calculateArrivalTime();
            this.startArrivalTimeDisplay();
            this.followPath();
            this.addLog('success', 'Started following path');
        }
    }

    findNearestPathPoint() {
        if (this.currentPath.length === 0) return;
        
        let minDistance = Infinity;
        let nearestIndex = 0;
        
        // If we have a road-snapped path, find nearest point in that
        if (this.roadSnappedPath && this.roadSnappedPath.length > 0) {
            this.roadSnappedPath.forEach((point, index) => {
                const distance = this.calculateDistance(
                    this.selectedVehicle.lat,
                    this.selectedVehicle.lng,
                    point.lat,
                    point.lng
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    this.roadPathIndex = index;
                }
            });
            // Find corresponding waypoint index
            this.currentPathIndex = 0;
        } else {
            // Find nearest waypoint
            this.currentPath.forEach((point, index) => {
                const distance = this.calculateDistance(
                    this.selectedVehicle.lat,
                    this.selectedVehicle.lng,
                    point.lat,
                    point.lng
                );
                
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestIndex = index;
                }
            });
            
            this.currentPathIndex = nearestIndex;
        }
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    calculateArrivalTime() {
        if (this.currentPath.length === 0 || !this.selectedVehicle) return null;
        
        let totalDistance = 0;
        let totalTime = 0;
        
        // Calculate distance and time from current position to destination
        for (let i = this.currentPathIndex; i < this.currentPath.length - 1; i++) {
            const currentPoint = this.currentPath[i];
            const nextPoint = this.currentPath[i + 1];
            
            const distance = this.calculateDistance(
                currentPoint.lat,
                currentPoint.lng,
                nextPoint.lat,
                nextPoint.lng
            );
            
            totalDistance += distance;
            
            // Calculate time based on speed
            const speed = currentPoint.speed || this.selectedVehicle.speed || 40; // km/h
            const time = (distance / speed) * 3600; // Convert to seconds
            totalTime += time;
            
            // Add stop duration
            if (nextPoint.stopDuration) {
                totalTime += nextPoint.stopDuration;
            }
        }
        
        return {
            distance: totalDistance,
            time: totalTime,
            arrivalTime: new Date(Date.now() + totalTime * 1000)
        };
    }

    startArrivalTimeDisplay() {
        // Clear existing interval
        if (this.arrivalTimeInterval) {
            clearInterval(this.arrivalTimeInterval);
        }
        
        // Create or update arrival time display
        let arrivalDisplay = document.getElementById('arrivalTimeDisplay');
        if (!arrivalDisplay) {
            arrivalDisplay = document.createElement('div');
            arrivalDisplay.id = 'arrivalTimeDisplay';
            arrivalDisplay.style.cssText = `
                position: absolute;
                top: 20px;
                right: 20px;
                background: rgba(16, 185, 129, 0.9);
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                font-size: 1rem;
                z-index: 1000;
                border: 2px solid #10b981;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                min-width: 250px;
            `;
            const mapContainer = document.getElementById('controllerMap');
            mapContainer.appendChild(arrivalDisplay);
        }
        
        arrivalDisplay.style.display = 'block';
        
        // Update every second
        this.arrivalTimeInterval = setInterval(() => {
            if (this.pathFollowing && this.currentPath.length > 0) {
                const arrivalInfo = this.calculateArrivalTime();
                if (arrivalInfo) {
                    const now = new Date();
                    const elapsed = (now - this.pathStartTime) / 1000; // seconds
                    const timeRemaining = Math.max(0, arrivalInfo.time - elapsed);
                    const arrivalTime = new Date(now.getTime() + timeRemaining * 1000);
                    
                    const hours = Math.floor(timeRemaining / 3600);
                    const minutes = Math.floor((timeRemaining % 3600) / 60);
                    const seconds = Math.floor(timeRemaining % 60);
                    
                    arrivalDisplay.innerHTML = `
                        <div style="font-weight: bold; margin-bottom: 8px; font-size: 1.1rem;">📍 Estimated Arrival</div>
                        <div style="margin-bottom: 5px;"><strong>Time:</strong> ${arrivalTime.toLocaleTimeString()}</div>
                        <div style="margin-bottom: 5px;"><strong>Remaining:</strong> ${hours}h ${minutes}m ${seconds}s</div>
                        <div style="margin-bottom: 5px;"><strong>Distance:</strong> ${arrivalInfo.distance.toFixed(2)} km</div>
                        <div style="font-size: 0.85rem; opacity: 0.9;">Progress: ${this.currentPathIndex + 1}/${this.currentPath.length} points</div>
                    `;
                }
            } else {
                arrivalDisplay.innerHTML = '<div>No active route</div>';
            }
        }, 1000);
    }

    followPath() {
        if (!this.selectedVehicle) {
            this.pathFollowing = false;
            this.showAlert('warning', 'No vehicle selected');
            return;
        }
        
        if (!this.pathFollowing || this.currentPathIndex >= this.currentPath.length) {
            this.pathFollowing = false;
            if (this.arrivalTimeInterval) {
                clearInterval(this.arrivalTimeInterval);
            }
            const arrivalDisplay = document.getElementById('arrivalTimeDisplay');
            if (arrivalDisplay) {
                arrivalDisplay.innerHTML = '<div style="color: #10b981; font-weight: bold;">✓ Route Completed!</div>';
                setTimeout(() => {
                    if (arrivalDisplay) arrivalDisplay.style.display = 'none';
                }, 5000);
            }
            if (this.selectedVehicle) {
                this.selectedVehicle.status = 'stopped';
                this.selectedVehicle.speed = 0;
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
            }
            this.showAlert('success', 'Route completed successfully!');
            this.addLog('success', 'Path completed');
            return;
        }

        if (this.currentPathIndex < 0 || this.currentPathIndex >= this.currentPath.length) {
            this.pathFollowing = false;
            return;
        }

        // If we have a road-snapped route, use it; otherwise use direct path points
        if (this.roadSnappedPath && this.roadSnappedPath.length > 0) {
            // Use road-snapped path for smooth movement
            this.animateVehicleAlongRoadPath();
        } else {
            // Fallback to direct point-to-point movement
            const point = this.currentPath[this.currentPathIndex];
            if (!point || !point.lat || !point.lng) {
                this.currentPathIndex++;
                setTimeout(() => this.followPath(), 100);
                return;
            }
            this.animateVehicleToPoint(point);
        }
    }

    animateVehicleToPoint(targetPoint) {
        if (!this.selectedVehicle || !this.markers.vehicle) return;

        // Check if engine is locked - if locked, stop movement
        if (this.selectedVehicle.engineStatus === 'locked') {
            this.pathFollowing = false;
            this.selectedVehicle.status = 'stopped';
            this.selectedVehicle.speed = 0;
            this.updateStatusDisplay();
            this.broadcastVehicleUpdate();
            this.showAlert('warning', 'Movement stopped - Engine is locked!');
            return;
        }

        const startLat = this.selectedVehicle.lat;
        const startLng = this.selectedVehicle.lng;
        const endLat = targetPoint.lat;
        const endLng = targetPoint.lng;
        
        const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
        const speed = targetPoint.speed || this.selectedVehicle.speed || 40; // km/h
        
        // Don't move if engine is locked or off
        if (this.selectedVehicle.engineStatus === 'locked' || this.selectedVehicle.engineStatus === 'off') {
            this.pathFollowing = false;
            return;
        }
        
        const duration = speed > 0 ? (distance / speed) * 3600 * 1000 : 1000; // milliseconds
        const steps = Math.max(10, Math.min(50, Math.floor(duration / 100))); // 10-50 steps
        const stepTime = duration / steps;
        
        let currentStep = 0;
        
        const animate = () => {
            // Check again if engine is locked during movement
            if (this.selectedVehicle.engineStatus === 'locked') {
                this.pathFollowing = false;
                this.selectedVehicle.status = 'stopped';
                this.selectedVehicle.speed = 0;
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
                this.showAlert('warning', 'Movement stopped - Engine is locked!');
                return;
            }
            
            if (!this.pathFollowing || currentStep >= steps) {
                // Reached the point
                this.selectedVehicle.lat = endLat;
                this.selectedVehicle.lng = endLng;
                
                // Apply speed limit
                let targetSpeed = targetPoint.speed || this.selectedVehicle.speed || 40;
                if (targetSpeed > this.speedLimit) {
                    targetSpeed = this.speedLimit;
                    this.showAlert('warning', `Speed limited to ${this.speedLimit} km/h (was ${targetPoint.speed} km/h)`);
                }
                
                this.selectedVehicle.speed = targetSpeed;
                
                if (targetSpeed > 0 && this.selectedVehicle.engineStatus !== 'locked') {
                    this.selectedVehicle.status = 'moving';
                    this.selectedVehicle.engineStatus = 'on';
                } else {
                    this.selectedVehicle.status = 'stopped';
                }
                
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
                
                // Handle stop duration at waypoint
                const stopDuration = targetPoint.stopDuration || 0;
                if (stopDuration > 0) {
                    this.isStoppedAtWaypoint = true;
                    this.selectedVehicle.status = 'stopped';
                    this.selectedVehicle.speed = 0;
                    this.updateStatusDisplay();
                    this.broadcastVehicleUpdate();
                    this.showAlert('info', `Stopped at waypoint for ${stopDuration} seconds`);
                    
                    // Clear any existing stop timer
                    if (this.stopTimer) {
                        clearTimeout(this.stopTimer);
                    }
                    
                    this.stopTimer = setTimeout(() => {
                        this.isStoppedAtWaypoint = false;
                        this.currentPathIndex++;
                        if (this.pathFollowing && this.selectedVehicle.engineStatus !== 'locked') {
                            this.followPath();
                        }
                    }, stopDuration * 1000);
                } else {
                    // No stop duration, move to next point immediately
                    this.currentPathIndex++;
                    if (this.pathFollowing && this.selectedVehicle.engineStatus !== 'locked') {
                        this.followPath();
                    }
                }
                return;
            }
            
            // Interpolate position
            const progress = currentStep / steps;
            const currentLat = startLat + (endLat - startLat) * progress;
            const currentLng = startLng + (endLng - startLng) * progress;
            
            this.selectedVehicle.lat = currentLat;
            this.selectedVehicle.lng = currentLng;
            
            // Apply speed limit during movement
            let currentSpeed = targetPoint.speed || this.selectedVehicle.speed || 40;
            if (currentSpeed > this.speedLimit) {
                currentSpeed = this.speedLimit;
            }
            
            if (currentSpeed > 0 && this.selectedVehicle.engineStatus !== 'locked' && !this.isStoppedAtWaypoint) {
                this.selectedVehicle.status = 'moving';
                this.selectedVehicle.speed = currentSpeed;
            } else if (this.isStoppedAtWaypoint) {
                this.selectedVehicle.status = 'stopped';
                this.selectedVehicle.speed = 0;
            }
            
            // Calculate bearing for marker rotation
            const bearing = this.calculateBearing(startLat, startLng, endLat, endLng);
            
            // Update marker position and rotation
            if (this.markers.vehicle) {
                this.markers.vehicle.setPosition({ lat: currentLat, lng: currentLng });
                // Update icon rotation if using SVG (for future enhancement)
                const icon = this.markers.vehicle.getIcon();
                if (icon && icon.path) {
                    this.markers.vehicle.setIcon({
                        ...icon,
                        rotation: bearing
                    });
                }
            }
            
            // Update map center to follow vehicle smoothly
            if (this.map && currentStep % 3 === 0) {
                this.map.setCenter({ lat: currentLat, lng: currentLng });
            }
            
            // Update status and broadcast more frequently
            if (currentStep % 2 === 0) {
                this.updateStatusDisplay();
            }
            this.broadcastVehicleUpdate();
            
            currentStep++;
            setTimeout(animate, stepTime);
        };
        
        animate();
    }

    animateVehicleAlongRoadPath() {
        if (!this.selectedVehicle || !this.markers.vehicle || !this.roadSnappedPath) return;

        // Check if engine is locked
        if (this.selectedVehicle.engineStatus === 'locked') {
            this.pathFollowing = false;
            this.selectedVehicle.status = 'stopped';
            this.selectedVehicle.speed = 0;
            this.updateStatusDisplay();
            this.broadcastVehicleUpdate();
            this.showAlert('warning', 'Movement stopped - Engine is locked!');
            return;
        }

        // Check if we've reached the end of the road path
        if (this.roadPathIndex >= this.roadSnappedPath.length) {
            // Check if we've completed all waypoints
            if (this.currentPathIndex >= this.currentPath.length - 1) {
                this.pathFollowing = false;
                this.selectedVehicle.status = 'stopped';
                this.selectedVehicle.speed = 0;
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
                this.showAlert('success', 'Route completed successfully!');
                return;
            }
            // Move to next waypoint
            this.currentPathIndex++;
            this.roadPathIndex = 0;
            // Re-draw path to get new road-snapped segment
            this.drawPathOnMap();
            setTimeout(() => this.followPath(), 500);
            return;
        }

        const targetPoint = this.roadSnappedPath[this.roadPathIndex];
        const startLat = this.selectedVehicle.lat;
        const startLng = this.selectedVehicle.lng;
        const endLat = targetPoint.lat;
        const endLng = targetPoint.lng;

        // Get speed from current waypoint or use default
        const currentWaypoint = this.currentPath[this.currentPathIndex] || {};
        let speed = currentWaypoint.speed || this.selectedVehicle.speed || 40;
        
        // Apply speed limit
        if (speed > this.speedLimit) {
            speed = this.speedLimit;
        }

        const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
        
        // Calculate movement duration based on speed
        const duration = speed > 0 ? (distance / speed) * 3600 * 1000 : 100; // milliseconds
        const steps = Math.max(5, Math.min(30, Math.floor(duration / 50))); // 5-30 steps
        const stepTime = Math.max(50, duration / steps);

        let currentStep = 0;

        const animate = () => {
            // Check if engine is locked during movement
            if (this.selectedVehicle.engineStatus === 'locked') {
                this.pathFollowing = false;
                this.selectedVehicle.status = 'stopped';
                this.selectedVehicle.speed = 0;
                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();
                return;
            }

            if (!this.pathFollowing || currentStep >= steps) {
                // Reached the road point
                this.selectedVehicle.lat = endLat;
                this.selectedVehicle.lng = endLng;
                this.selectedVehicle.speed = speed;
                this.selectedVehicle.status = speed > 0 ? 'moving' : 'stopped';
                this.selectedVehicle.engineStatus = speed > 0 ? 'on' : 'off';

                this.updateStatusDisplay();
                this.broadcastVehicleUpdate();

                // Move to next road point
                this.roadPathIndex++;
                
                // Check if we need to stop at a waypoint
                if (this.roadPathIndex >= this.roadSnappedPath.length && this.currentPathIndex < this.currentPath.length - 1) {
                    const waypoint = this.currentPath[this.currentPathIndex];
                    const stopDuration = waypoint.stopDuration || 0;
                    
                    if (stopDuration > 0) {
                        this.isStoppedAtWaypoint = true;
                        this.selectedVehicle.status = 'stopped';
                        this.selectedVehicle.speed = 0;
                        this.updateStatusDisplay();
                        this.broadcastVehicleUpdate();
                        
                        if (this.stopTimer) clearTimeout(this.stopTimer);
                        this.stopTimer = setTimeout(() => {
                            this.isStoppedAtWaypoint = false;
                            this.currentPathIndex++;
                            this.roadPathIndex = 0;
                            this.drawPathOnMap();
                            setTimeout(() => this.followPath(), 500);
                        }, stopDuration * 1000);
                        return;
                    }
                }

                // Continue following path
                if (this.pathFollowing) {
                    setTimeout(() => this.followPath(), 50);
                }
                return;
            }

            // Interpolate position along road
            const progress = currentStep / steps;
            const currentLat = startLat + (endLat - startLat) * progress;
            const currentLng = startLng + (endLng - startLng) * progress;

            this.selectedVehicle.lat = currentLat;
            this.selectedVehicle.lng = currentLng;
            this.selectedVehicle.speed = speed;
            this.selectedVehicle.status = speed > 0 && !this.isStoppedAtWaypoint ? 'moving' : 'stopped';

            // Calculate bearing for marker rotation
            const bearing = this.calculateBearing(startLat, startLng, endLat, endLng);

            // Update marker
            if (this.markers.vehicle) {
                this.markers.vehicle.setPosition({ lat: currentLat, lng: currentLng });
                const icon = this.markers.vehicle.getIcon();
                if (icon && icon.path) {
                    this.markers.vehicle.setIcon({
                        ...icon,
                        rotation: bearing
                    });
                }
            }

            // Update map center periodically
            if (this.map && currentStep % 5 === 0) {
                this.map.setCenter({ lat: currentLat, lng: currentLng });
            }

            // Broadcast updates
            if (currentStep % 3 === 0) {
                this.updateStatusDisplay();
            }
            this.broadcastVehicleUpdate();

            currentStep++;
            setTimeout(animate, stepTime);
        };

        animate();
    }

    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        const bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    }

    setManualPosition() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        const lat = parseFloat(document.getElementById('manualLat').value);
        const lng = parseFloat(document.getElementById('manualLng').value);

        if (!lat || !lng) {
            this.addLog('warning', 'Please enter valid coordinates');
            return;
        }

        this.selectedVehicle.lat = lat;
        this.selectedVehicle.lng = lng;
        
        // Update marker
        if (this.markers.vehicle) {
            this.markers.vehicle.setPosition({ lat, lng });
        } else {
            this.addVehicleMarker();
        }
        
        this.updateStatusDisplay();
        this.centerMap();
        this.saveToLocalStorage();
        this.broadcastVehicleUpdate();
        
        // If path exists, start following it
        if (this.currentPath.length > 0) {
            this.startFollowingPath();
        }
        
        this.addLog('success', `Position set to ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }

    centerMap() {
        if (this.selectedVehicle) {
            this.map.setCenter({ lat: this.selectedVehicle.lat, lng: this.selectedVehicle.lng });
            this.map.setZoom(15);
        }
    }

    clearMap() {
        this.clearPath();
        this.addLog('info', 'Map cleared');
    }

    enableRouteDrawing() {
        if (this.drawingMode) {
            this.disableRouteDrawing();
            return;
        }

        this.drawingMode = true;
        this.drawnPath = [];
        
        // Initialize drawing manager
        if (!this.drawingManager) {
            this.drawingManager = new google.maps.drawing.DrawingManager({
                drawingMode: google.maps.drawing.OverlayType.POLYLINE,
                drawingControl: false,
                polylineOptions: {
                    strokeColor: '#FF0000',
                    strokeWeight: 3,
                    strokeOpacity: 0.6,
                    clickable: false,
                    editable: true
                }
            });
            this.drawingManager.setMap(this.map);
        }

        // Set drawing mode to polyline
        this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.POLYLINE);
        
        // Listen for polyline completion
        google.maps.event.addListener(this.drawingManager, 'overlaycomplete', (event) => {
            if (event.type === google.maps.drawing.OverlayType.POLYLINE) {
                const polyline = event.overlay;
                const path = polyline.getPath();
                
                // Get all points from the drawn path
                this.drawnPath = [];
                path.forEach((latLng, index) => {
                    this.drawnPath.push({
                        lat: latLng.lat(),
                        lng: latLng.lng(),
                        order: index + 1
                    });
                });

                // Snap to roads using Directions Service
                this.snapToRoads(this.drawnPath);
                
                // Disable drawing mode
                this.drawingManager.setDrawingMode(null);
                this.drawingMode = false;
                
                this.addLog('success', `Path drawn with ${this.drawnPath.length} points. Snapping to roads...`);
            }
        });

        this.addLog('info', 'Drawing mode enabled - Draw a path on the map');
        document.getElementById('drawRouteBtn').textContent = '✓ Finish Drawing';
    }

    disableRouteDrawing() {
        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(null);
        }
        this.drawingMode = false;
        document.getElementById('drawRouteBtn').textContent = '✏️ Draw Route';
        this.addLog('info', 'Drawing mode disabled');
    }

    snapToRoads(pathPoints) {
        if (pathPoints.length < 2) {
            this.addLog('warning', 'Need at least 2 points to snap to roads');
            return;
        }

        // Use Directions Service to get route along roads
        const waypoints = [];
        for (let i = 1; i < pathPoints.length - 1; i++) {
            waypoints.push({
                location: new google.maps.LatLng(pathPoints[i].lat, pathPoints[i].lng),
                stopover: false
            });
        }

        const request = {
            origin: new google.maps.LatLng(pathPoints[0].lat, pathPoints[0].lng),
            destination: new google.maps.LatLng(
                pathPoints[pathPoints.length - 1].lat,
                pathPoints[pathPoints.length - 1].lng
            ),
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
            optimizeWaypoints: false
        };

        this.directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                // Render the route
                this.directionsRenderer.setDirections(result);
                
                // Extract snapped path points
                const route = result.routes[0];
                const snappedPath = [];
                
                route.legs.forEach((leg, legIndex) => {
                    leg.steps.forEach((step, stepIndex) => {
                        step.path.forEach((point, pointIndex) => {
                            snappedPath.push({
                                lat: point.lat(),
                                lng: point.lng(),
                                order: snappedPath.length + 1
                            });
                        });
                    });
                });

                // Update current path with snapped coordinates
                this.currentPath = snappedPath.map((point, index) => ({
                    lat: point.lat,
                    lng: point.lng,
                    order: index + 1,
                    speed: 40, // Default speed
                    stopDuration: 0,
                    description: index === 0 ? 'Start Point' : 
                                index === snappedPath.length - 1 ? 'Destination' : 
                                `Waypoint ${index}`
                }));

                this.updatePathInfo();
                this.addLog('success', `Path snapped to roads with ${this.currentPath.length} points`);
                
                // Save to localStorage for dashboard (in format expected by dashboard)
                this.savePathToLocalStorage();
                
                // Trigger storage event to notify dashboard
                window.dispatchEvent(new Event('storage'));
            } else {
                this.addLog('error', 'Failed to snap path to roads: ' + status);
                // Fallback: use original path
                this.currentPath = this.drawnPath.map((point, index) => ({
                    lat: point.lat,
                    lng: point.lng,
                    order: index + 1,
                    speed: 40,
                    stopDuration: 0,
                    description: index === 0 ? 'Start Point' : 
                                index === this.drawnPath.length - 1 ? 'Destination' : 
                                `Waypoint ${index}`
                }));
                this.updatePathInfo();
            }
        });
    }

    savePathToLocalStorage() {
        if (this.selectedVehicle && this.currentPath.length > 0) {
            // Save in format expected by dashboard
            const routeName = 'default'; // Default route name, can be changed when saving route
            const pathKey = `${this.selectedVehicle.id}_${routeName}`;
            
            // Load existing vehiclePaths from localStorage
            let vehiclePaths = {};
            const savedPaths = localStorage.getItem('vehiclePaths');
            if (savedPaths) {
                try {
                    vehiclePaths = JSON.parse(savedPaths);
                } catch (e) {
                    console.error('Error loading vehiclePaths:', e);
                }
            }
            
            // Update or add path for this vehicle
            vehiclePaths[pathKey] = {
                vehicleId: this.selectedVehicle.id,
                routeName: routeName,
                points: this.currentPath.map(p => ({
                    order: p.order || 0,
                    lat: p.lat,
                    lng: p.lng,
                    speed: p.speed || 40,
                    stopDuration: p.stopDuration || 0,
                    description: p.description || ''
                }))
            };
            
            // Save back to localStorage
            localStorage.setItem('vehiclePaths', JSON.stringify(vehiclePaths));
            
            // Also save in old format for backward compatibility
            const pathData = {
                vehicleId: this.selectedVehicle.id,
                path: this.currentPath,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('vehiclePath_' + this.selectedVehicle.id, JSON.stringify(pathData));
        }
    }

    updateStatusDisplay() {
        if (!this.selectedVehicle) {
            document.getElementById('statusVehicle').textContent = '--';
            document.getElementById('statusStatus').textContent = '--';
            document.getElementById('statusSpeed').textContent = '0 km/h';
            document.getElementById('statusEngine').textContent = 'OFF';
            document.getElementById('statusPosition').textContent = '--';
            document.getElementById('statusPathPoints').textContent = '0';
            document.getElementById('statusPathProgress').textContent = '0%';
            document.getElementById('statusLastUpdate').textContent = '--';
            return;
        }

        const v = this.selectedVehicle;
        document.getElementById('statusVehicle').textContent = v.id;
        document.getElementById('statusStatus').textContent = v.status.toUpperCase();
        document.getElementById('statusSpeed').textContent = `${v.speed} km/h`;
        document.getElementById('statusEngine').textContent = v.engineStatus.toUpperCase();
        document.getElementById('statusPosition').textContent = `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}`;
        document.getElementById('statusPathPoints').textContent = this.currentPath.length;
        
        // Calculate path progress
        const progress = this.currentPath.length > 0 ? 
            Math.round((this.currentPathIndex / this.currentPath.length) * 100) : 0;
        document.getElementById('statusPathProgress').textContent = `${progress}%`;
        
        // Last update time
        document.getElementById('statusLastUpdate').textContent = new Date().toLocaleTimeString();
        
        // Update vehicle marker position and icon
        if (this.markers.vehicle) {
            this.markers.vehicle.setPosition({ lat: v.lat, lng: v.lng });
            
            // Update icon if not using custom icon
            if (!this.customVehicleIcon) {
                const carPath = 'M17.5,5c-0.276,0-0.5,0.224-0.5,0.5v1.5H3v-1.5C3,5.224,2.776,5,2.5,5S2,5.224,2,5.5V7H1v8h1v0.5 C3,15.776,3.224,16,3.5,16S4,15.776,4,15.5V15h12v0.5c0,0.276,0.224,0.5,0.5,0.5S17,15.776,17,15.5V15h1V7h-1V5.5 C17,5.224,16.776,5,16.5,5z M4,12.5C4,13.327,3.327,14,2.5,14S1,13.327,1,12.5S1.673,11,2.5,11S4,11.673,4,12.5z M17,12.5 c0,0.827,0.673,1.5,1.5,1.5S20,13.327,20,12.5S19.327,11,18.5,11S17,11.673,17,12.5z';
                const fillColor = v.status === 'moving' ? '#10b981' : 
                                 v.status === 'stopped' ? '#6b7280' : '#ef4444';
                this.markers.vehicle.setIcon({
                    path: carPath,
                    fillColor: fillColor,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                    scale: 1.5,
                    rotation: 0,
                    anchor: new google.maps.Point(10, 10)
                });
            }
            
            // Update animation
            if (v.status === 'moving') {
                this.markers.vehicle.setAnimation(google.maps.Animation.BOUNCE);
            } else {
                this.markers.vehicle.setAnimation(null);
            }
        }
    }

    startLiveStatusUpdates() {
        // Update status every second
        this.statusUpdateInterval = setInterval(() => {
            if (this.selectedVehicle) {
                this.updateStatusDisplay();
            }
        }, 1000);
    }

    createAlertContainer() {
        const alertContainer = document.createElement('div');
        alertContainer.id = 'alertContainer';
        alertContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
        `;
        document.body.appendChild(alertContainer);
    }

    showAlert(type, message) {
        const alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) return;

        const alert = document.createElement('div');
        alert.className = `popup-alert alert-${type}`;
        
        const colors = {
            success: { bg: '#10b981', icon: '✓' },
            warning: { bg: '#f59e0b', icon: '⚠' },
            error: { bg: '#ef4444', icon: '✕' },
            info: { bg: '#2563eb', icon: 'ℹ' }
        };
        
        const color = colors[type] || colors.info;
        
        alert.style.cssText = `
            background: ${color.bg};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 300px;
            max-width: 500px;
            animation: slideDown 0.3s ease;
            pointer-events: auto;
            font-weight: 500;
        `;
        
        alert.innerHTML = `
            <span style="font-size: 1.2rem;">${color.icon}</span>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="margin-left: auto; background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer;">✕</button>
        `;
        
        alertContainer.appendChild(alert);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'slideUp 0.3s ease';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
        
        // Play sound for important alerts
        if (type === 'error' || type === 'warning') {
            this.playAlertSound();
        }
    }

    playAlertSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (e) {
            console.log('Could not play alert sound');
        }
    }

    updatePathInfo() {
        const infoDiv = document.getElementById('pathInfo');
        if (this.currentPath.length === 0) {
            infoDiv.innerHTML = '<p>No path loaded</p>';
        } else {
            const start = this.currentPath[0];
            const end = this.currentPath[this.currentPath.length - 1];
            infoDiv.innerHTML = `
                <p><strong>Points:</strong> ${this.currentPath.length}</p>
                <p><strong>Start:</strong> ${start.lat.toFixed(6)}, ${start.lng.toFixed(6)}</p>
                <p><strong>End:</strong> ${end.lat.toFixed(6)}, ${end.lng.toFixed(6)}</p>
            `;
        }
    }

    addLog(type, message) {
        const logsContainer = document.getElementById('logsContainer');
        const log = document.createElement('div');
        log.className = `log-entry ${type}`;
        log.innerHTML = `
            <div>${message}</div>
            <div class="log-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        logsContainer.insertBefore(log, logsContainer.firstChild);
        
        while (logsContainer.children.length > 20) {
            logsContainer.removeChild(logsContainer.lastChild);
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('controlledVehicles', JSON.stringify(this.vehicles));
    }

    loadFromLocalStorage() {
        const saved = localStorage.getItem('controlledVehicles');
        if (saved) {
            try {
                this.vehicles = JSON.parse(saved);
            } catch (e) {
                console.error('Error loading from localStorage:', e);
            }
        }
    }

    broadcastVehicleUpdate() {
        if (!this.selectedVehicle) return;
        
        // Broadcast to dashboard via localStorage
        const updateData = {
            vehicle: {
                id: this.selectedVehicle.id,
                name: this.selectedVehicle.name,
                lat: this.selectedVehicle.lat,
                lng: this.selectedVehicle.lng,
                speed: this.selectedVehicle.speed,
                status: this.selectedVehicle.status,
                engineStatus: this.selectedVehicle.engineStatus,
                maxSpeed: this.selectedVehicle.maxSpeed || 0,
                avgSpeed: this.selectedVehicle.avgSpeed || 0
            },
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem('vehicleUpdate', JSON.stringify(updateData));
        
        // Trigger storage event for cross-window communication
        window.dispatchEvent(new Event('storage'));
        
        // Also update directly for same-window
        if (window.transportManager) {
            window.transportManager.updateVehicleFromController(updateData.vehicle);
        }
    }

    saveToExcel() {
        if (!this.selectedVehicle) {
            this.addLog('warning', 'Please select a vehicle first');
            return;
        }

        const data = this.currentPath.map((point, index) => ({
            'Vehicle ID': this.selectedVehicle.id,
            'Route Name': this.selectedVehicle.name,
            'Point Order': index + 1,
            'Latitude': point.lat,
            'Longitude': point.lng,
            'Speed (km/h)': point.speed,
            'Stop Duration (sec)': point.stopDuration,
            'Description': point.description
        }));

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Paths');
        XLSX.writeFile(wb, `vehicle_path_${this.selectedVehicle.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        this.addLog('success', 'Path saved to Excel');
    }

    startControllerArrivalTimeUpdates() {
        // Update arrival time table every 2 seconds
        setInterval(() => {
            this.updateControllerArrivalTimeTable();
        }, 2000);
    }

    updateControllerArrivalTimeTable() {
        const tableBody = document.getElementById('controllerArrivalTimeTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        this.vehicles.forEach(vehicle => {
            const arrivalInfo = this.calculateControllerArrivalTime(vehicle);
            
            const row = document.createElement('tr');
            
            if (arrivalInfo && this.currentPath.length > 0 && this.selectedVehicle && this.selectedVehicle.id === vehicle.id) {
                const hours = Math.floor(arrivalInfo.time / 3600);
                const minutes = Math.floor((arrivalInfo.time % 3600) / 60);
                const seconds = Math.floor(arrivalInfo.time % 60);
                
                row.innerHTML = `
                    <td>${vehicle.id}</td>
                    <td class="eta-time">${arrivalInfo.arrivalTime.toLocaleTimeString()}</td>
                    <td class="eta-distance">${arrivalInfo.distance.toFixed(2)} km</td>
                    <td class="eta-progress">${arrivalInfo.progress}%</td>
                `;
            } else {
                row.innerHTML = `
                    <td>${vehicle.id}</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                `;
            }
            
            tableBody.appendChild(row);
        });
    }

    calculateControllerArrivalTime(vehicle) {
        if (!this.currentPath.length || !this.selectedVehicle || this.selectedVehicle.id !== vehicle.id) {
            return null;
        }
        
        if (this.currentPathIndex >= this.currentPath.length) {
            return null;
        }
        
        let totalDistance = 0;
        let totalTime = 0;
        
        for (let i = this.currentPathIndex; i < this.currentPath.length - 1; i++) {
            const currentPoint = this.currentPath[i];
            const nextPoint = this.currentPath[i + 1];
            
            const distance = this.calculateDistance(
                currentPoint.lat, currentPoint.lng,
                nextPoint.lat, nextPoint.lng
            );
            
            totalDistance += distance;
            
            let speed = currentPoint.speed || vehicle.speed || 40;
            // Apply speed limit
            if (speed > this.speedLimit) {
                speed = this.speedLimit;
            }
            if (speed > 0) {
                totalTime += (distance / speed) * 3600; // seconds
            }
            
            if (nextPoint.stopDuration) {
                totalTime += nextPoint.stopDuration;
            }
        }
        
        const progress = this.currentPath.length > 0 ? 
            Math.round((this.currentPathIndex / this.currentPath.length) * 100) : 0;
        
        return {
            distance: totalDistance,
            time: totalTime,
            arrivalTime: new Date(Date.now() + totalTime * 1000),
            progress: progress
        };
    }

    stopFollowingPath() {
        this.pathFollowing = false;
        this.isStoppedAtWaypoint = false;
        if (this.stopTimer) {
            clearTimeout(this.stopTimer);
            this.stopTimer = null;
        }
        if (this.selectedVehicle) {
            this.selectedVehicle.status = 'stopped';
            this.selectedVehicle.speed = 0;
            this.updateStatusDisplay();
            this.broadcastVehicleUpdate();
        }
        this.showAlert('info', 'Path following stopped');
        this.addLog('info', 'Path following stopped by user');
    }

    setSpeedLimit() {
        const limit = parseFloat(document.getElementById('speedLimitInput').value);
        if (isNaN(limit) || limit < 20 || limit > 120) {
            this.showAlert('error', 'Please enter a valid speed limit (20-120 km/h)');
            return;
        }
        
        this.speedLimit = limit;
        document.getElementById('speedLimitStatus').textContent = `Current: ${this.speedLimit} km/h`;
        
        // Check current vehicle speed
        if (this.selectedVehicle && this.selectedVehicle.speed > this.speedLimit) {
            this.selectedVehicle.speed = this.speedLimit;
            this.updateStatusDisplay();
            this.broadcastVehicleUpdate();
            this.showAlert('warning', `Vehicle speed reduced to ${this.speedLimit} km/h`);
        }
        
        this.showAlert('success', `Speed limit set to ${this.speedLimit} km/h`);
        this.addLog('success', `Speed limit set to ${this.speedLimit} km/h`);
        
        // Save to localStorage
        localStorage.setItem('speedLimit', this.speedLimit.toString());
    }

    saveCurrentRoute() {
        if (!this.selectedVehicle) {
            this.showAlert('warning', 'Please select a vehicle first');
            return;
        }
        
        if (this.currentPath.length < 2) {
            this.showAlert('warning', 'No path to save. Load or draw a path first.');
            return;
        }
        
        const routeName = prompt('Enter route name:', `${this.selectedVehicle.id}_Route_${new Date().toISOString().split('T')[0]}`);
        if (!routeName) return;
        
        const routeKey = `${this.selectedVehicle.id}_${routeName}`;
        
        this.savedRoutes[routeKey] = {
            vehicleId: this.selectedVehicle.id,
            routeName: routeName,
            path: JSON.parse(JSON.stringify(this.currentPath)), // Deep copy
            createdAt: new Date().toISOString(),
            pointCount: this.currentPath.length
        };
        
        // Save to localStorage
        localStorage.setItem('savedRoutes', JSON.stringify(this.savedRoutes));
        
        this.updateSavedRoutesList();
        this.showAlert('success', `Route "${routeName}" saved for ${this.selectedVehicle.id}`);
        this.addLog('success', `Route "${routeName}" saved`);
    }

    showRouteSelector() {
        if (!this.selectedVehicle) {
            this.showAlert('warning', 'Please select a vehicle first');
            return;
        }
        
        // Get routes for this vehicle
        const vehicleRoutes = Object.keys(this.savedRoutes).filter(key => 
            this.savedRoutes[key].vehicleId === this.selectedVehicle.id
        );
        
        if (vehicleRoutes.length === 0) {
            this.showAlert('info', 'No saved routes for this vehicle. Save a route first.');
            return;
        }
        
        // Create route selection dialog
        const routeList = vehicleRoutes.map(key => {
            const route = this.savedRoutes[key];
            return `${route.routeName} (${route.pointCount} points)`;
        }).join('\n');
        
        const selected = prompt(`Select a route to load:\n\n${routeList}\n\nEnter route name:`);
        if (!selected) return;
        
        // Find matching route
        const routeKey = vehicleRoutes.find(key => 
            this.savedRoutes[key].routeName === selected || 
            this.savedRoutes[key].routeName.includes(selected)
        );
        
        if (routeKey) {
            this.loadSavedRoute(routeKey);
        } else {
            this.showAlert('error', 'Route not found');
        }
    }

    loadSavedRoute(routeKey) {
        if (!this.savedRoutes[routeKey]) {
            this.showAlert('error', 'Route not found');
            return;
        }
        
        const route = this.savedRoutes[routeKey];
        this.currentPath = JSON.parse(JSON.stringify(route.path)); // Deep copy
        
        this.drawPathOnMap();
        this.updatePathInfo();
        
        // Save to vehiclePaths format for dashboard
        this.savePathToLocalStorage();
        
        this.showAlert('success', `Route "${route.routeName}" loaded`);
        this.addLog('success', `Route "${route.routeName}" loaded (${route.pointCount} points)`);
    }

    updateSavedRoutesList() {
        const routesListDiv = document.getElementById('savedRoutesList');
        if (!routesListDiv) return;
        
        routesListDiv.innerHTML = '';
        
        if (Object.keys(this.savedRoutes).length === 0) {
            routesListDiv.innerHTML = '<p style="font-size: 0.8rem; color: var(--text-secondary);">No saved routes</p>';
            return;
        }
        
        // Group routes by vehicle
        const routesByVehicle = {};
        Object.keys(this.savedRoutes).forEach(key => {
            const route = this.savedRoutes[key];
            if (!routesByVehicle[route.vehicleId]) {
                routesByVehicle[route.vehicleId] = [];
            }
            routesByVehicle[route.vehicleId].push({ key, route });
        });
        
        Object.keys(routesByVehicle).forEach(vehicleId => {
            const vehicleDiv = document.createElement('div');
            vehicleDiv.style.cssText = 'margin-bottom: 0.75rem; padding: 0.5rem; background: rgba(30,41,59,0.6); border-radius: 6px;';
            
            const vehicleHeader = document.createElement('div');
            vehicleHeader.style.cssText = 'font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);';
            vehicleHeader.textContent = vehicleId;
            vehicleDiv.appendChild(vehicleHeader);
            
            routesByVehicle[vehicleId].forEach(({ key, route }) => {
                const routeItem = document.createElement('div');
                routeItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 0.4rem; margin-bottom: 0.25rem; background: rgba(37,99,235,0.2); border-radius: 4px;';
                
                const routeInfo = document.createElement('span');
                routeInfo.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary);';
                routeInfo.textContent = `${route.routeName} (${route.pointCount} pts)`;
                routeItem.appendChild(routeInfo);
                
                const btnContainer = document.createElement('div');
                btnContainer.style.cssText = 'display: flex; gap: 0.5rem;';
                
                const loadBtn = document.createElement('button');
                loadBtn.textContent = 'Load';
                loadBtn.style.cssText = 'padding: 0.25rem 0.75rem; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;';
                loadBtn.addEventListener('click', () => {
                    if (this.selectedVehicle && this.selectedVehicle.id === vehicleId) {
                        this.loadSavedRoute(key);
                    } else {
                        this.showAlert('warning', `Please select ${vehicleId} first`);
                    }
                });
                btnContainer.appendChild(loadBtn);
                
                // Add assign button to assign route to any vehicle
                const assignBtn = document.createElement('button');
                assignBtn.textContent = 'Assign';
                assignBtn.style.cssText = 'padding: 0.25rem 0.75rem; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;';
                assignBtn.title = 'Assign this route to any vehicle';
                assignBtn.addEventListener('click', () => {
                    this.showAssignRouteDialog(key, route);
                });
                btnContainer.appendChild(assignBtn);
                
                routeItem.appendChild(btnContainer);
                
                vehicleDiv.appendChild(routeItem);
            });
            
            routesListDiv.appendChild(vehicleDiv);
        });
    }

    loadSavedRoutesFromStorage() {
        const saved = localStorage.getItem('savedRoutes');
        if (saved) {
            try {
                this.savedRoutes = JSON.parse(saved);
                this.updateSavedRoutesList();
            } catch (e) {
                console.error('Error loading saved routes:', e);
            }
        }
        
        // Load speed limit
        const savedSpeedLimit = localStorage.getItem('speedLimit');
        if (savedSpeedLimit) {
            this.speedLimit = parseFloat(savedSpeedLimit);
            document.getElementById('speedLimitInput').value = this.speedLimit;
            document.getElementById('speedLimitStatus').textContent = `Current: ${this.speedLimit} km/h`;
        }
    }

    showAssignRouteDialog(routeKey, route) {
        // Create a list of available vehicles
        const vehicleList = this.vehicles.map(v => `${v.id} - ${v.name || v.id}`).join('\n');
        
        if (vehicleList.length === 0) {
            this.showAlert('warning', 'No vehicles available. Please add a vehicle first.');
            return;
        }
        
        const vehicleId = prompt(`Assign route "${route.routeName}" to which vehicle?\n\nAvailable vehicles:\n${vehicleList}\n\nEnter vehicle ID:`);
        if (!vehicleId) return;
        
        this.assignRouteToVehicle(vehicleId.trim(), routeKey);
    }

    assignRouteToVehicle(vehicleId, routeKey) {
        if (!this.savedRoutes[routeKey]) {
            this.showAlert('error', 'Route not found');
            return;
        }
        
        const route = this.savedRoutes[routeKey];
        
        // Check if vehicle exists
        let vehicle = this.vehicles.find(v => v.id === vehicleId || v.id.toLowerCase() === vehicleId.toLowerCase());
        if (!vehicle) {
            this.showAlert('warning', `Vehicle ${vehicleId} not found. Creating new vehicle.`);
            vehicle = {
                id: vehicleId,
                name: vehicleId,
                lat: route.path[0].lat,
                lng: route.path[0].lng,
                speed: 0,
                status: 'stopped',
                engineStatus: 'off'
            };
            this.vehicles.push(vehicle);
            this.saveToLocalStorage();
            
            // Add to dropdown
            const select = document.getElementById('vehicleSelect');
            const option = document.createElement('option');
            option.value = vehicleId;
            option.textContent = `${vehicleId} - ${vehicle.name}`;
            select.appendChild(option);
        }
        
        // Select the vehicle
        document.getElementById('vehicleSelect').value = vehicle.id;
        this.selectVehicle(vehicle.id);
        
        // Load the route
        this.loadSavedRoute(routeKey);
        
        this.showAlert('success', `Route "${route.routeName}" assigned to ${vehicle.id}`);
        this.addLog('success', `Route "${route.routeName}" assigned to ${vehicle.id}`);
    }
}

// Initialize controller
document.addEventListener('DOMContentLoaded', () => {
    window.vehicleController = new VehicleController();
});



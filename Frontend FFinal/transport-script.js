// School Transport Management - Smart Drive Mate
// Real-time vehicle tracking and monitoring system

class TransportManager {
    constructor() {
        this.map = null;
        this.markers = {};
        this.polylines = {};
        this.vehicles = [];
        this.selectedVehicle = null;
        this.geoFences = [];
        this.speedLimit = 60; // Default speed limit in km/h
        this.alertThreshold = 10; // Percentage above speed limit
        this.updateInterval = null;
        this.engineLockStatus = {};
        this.routePolylines = {};
        this.alertSound = null;
        this.vehiclePaths = {}; // Store paths from Excel
        this.directionsService = null;
        this.arrivalTimeTable = {};
        
        this.init();
    }

    init() {
        this.initMap();
        this.initAlertSound();
        this.loadVehicles();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.loadExcelData();
        this.createArrivalTimeTable();
        this.startArrivalTimeUpdates();
        this.setupUserInterface();
    }

    setupUserInterface() {
        // Check user role and adjust UI
        const auth = sessionStorage.getItem('auth');
        if (auth) {
            try {
                const authData = JSON.parse(auth);
                if (authData.role === 'user') {
                    // Hide admin controls
                    const quickActions = document.getElementById('quickActionsSection');
                    if (quickActions) quickActions.style.display = 'none';
                    
                    // Show user bus selection
                    const userBusSelection = document.getElementById('userBusSelection');
                    if (userBusSelection) userBusSelection.style.display = 'block';
                    
                    // Render user-friendly vehicle list
                    this.renderUserVehicleList();
                    
                    // Load and draw intended routes (not traveled path)
                    this.loadPathsForUserPanel();
                    
                    // Clear any existing traveled path polylines for normal users
                    Object.values(this.polylines).forEach(polyline => {
                        if (polyline && polyline.setMap) {
                            polyline.setMap(null);
                        }
                    });
                    this.polylines = {};
                }
            } catch (e) {
                console.error('Error setting up UI:', e);
            }
        }
    }

    renderUserVehicleList() {
        const userVehicleList = document.getElementById('userVehicleList');
        if (!userVehicleList) return;

        userVehicleList.innerHTML = '';

        this.vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.vehicleId = vehicle.id;
            
            const statusClass = vehicle.status === 'moving' ? 'status-moving' : 
                              vehicle.status === 'overspeed' ? 'status-overspeed' : 'status-stopped';
            
            card.innerHTML = `
                <div class="vehicle-card-header">
                    <span class="vehicle-id">${vehicle.id}</span>
                    <span class="vehicle-status ${statusClass}">${vehicle.status.toUpperCase()}</span>
                </div>
                <div class="vehicle-info">
                    <div><strong>${vehicle.name}</strong></div>
                    <div>Driver: ${vehicle.driver || 'N/A'}</div>
                    <div>Speed: ${vehicle.speed} km/h</div>
                    <div>Route: ${vehicle.route || 'N/A'}</div>
                </div>
            `;

            card.addEventListener('click', () => {
                this.selectVehicle(vehicle.id);
                // Center map on selected vehicle
                if (this.markers[vehicle.id]) {
                    this.map.setCenter(this.markers[vehicle.id].getPosition());
                    this.map.setZoom(15);
                }
            });
            
            userVehicleList.appendChild(card);
        });
    }

    initAlertSound() {
        // Create audio context for alert sounds
        this.alertSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZUREKSpzh8sVxJgUwgM/z2Yk3CBlo');
        // Fallback: use Web Audio API for beep sound
        if (!this.alertSound.canPlayType) {
            this.alertSound = null;
        }
    }

    playAlertSound() {
        if (this.alertSound) {
            this.alertSound.play().catch(e => {
                // Fallback: use Web Audio API
                this.playBeepSound();
            });
        } else {
            this.playBeepSound();
        }
    }

    playBeepSound() {
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

    initMap() {
        // Default center (you can change this to your school location)
        const defaultCenter = { lat: 17.6868, lng: 83.2185 }; // Visakhapatnam
        
        this.map = new google.maps.Map(document.getElementById('map'), {
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
                },
                {
                    featureType: 'water',
                    elementType: 'geometry',
                    stylers: [{ color: '#0f172a' }]
                }
            ]
        });
    }

    loadVehicles() {
        // Sample vehicle data - in production, this would come from your backend/Excel
        this.vehicles = [
            {
                id: 'BUS-001',
                name: 'School Bus 1',
                driver: 'John Doe',
                route: 'Route A',
                lat: 17.6868,
                lng: 83.2185,
                speed: 0,
                maxSpeed: 0,
                avgSpeed: 0,
                status: 'stopped',
                engineStatus: 'off',
                lastUpdate: new Date(),
                routeHistory: []
            },
            {
                id: 'BUS-002',
                name: 'School Bus 2',
                driver: 'Jane Smith',
                route: 'Route B',
                lat: 17.6900,
                lng: 83.2200,
                speed: 45,
                maxSpeed: 65,
                avgSpeed: 42,
                status: 'moving',
                engineStatus: 'on',
                lastUpdate: new Date(),
                routeHistory: []
            },
            {
                id: 'BUS-003',
                name: 'School Bus 3',
                driver: 'Mike Johnson',
                route: 'Route C',
                lat: 17.6800,
                lng: 83.2150,
                speed: 70,
                maxSpeed: 75,
                avgSpeed: 55,
                status: 'overspeed',
                engineStatus: 'on',
                lastUpdate: new Date(),
                routeHistory: []
            }
        ];

        this.renderVehicleList();
        this.updateMapMarkers();
        
        // Also render user vehicle list if user is logged in
        const auth = sessionStorage.getItem('auth');
        if (auth) {
            try {
                const authData = JSON.parse(auth);
                if (authData.role === 'user') {
                    this.renderUserVehicleList();
                }
            } catch (e) {
                console.error('Error:', e);
            }
        }
    }

    renderVehicleList() {
        const vehicleList = document.getElementById('vehicleList');
        vehicleList.innerHTML = '';

        this.vehicles.forEach(vehicle => {
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.vehicleId = vehicle.id;
            
            const statusClass = vehicle.status === 'moving' ? 'status-moving' : 
                              vehicle.status === 'overspeed' ? 'status-overspeed' : 'status-stopped';
            
            card.innerHTML = `
                <div class="vehicle-card-header">
                    <span class="vehicle-id">${vehicle.id}</span>
                    <span class="vehicle-status ${statusClass}">${vehicle.status.toUpperCase()}</span>
                </div>
                <div class="vehicle-info">
                    <div>${vehicle.name}</div>
                    <div>Driver: ${vehicle.driver}</div>
                    <div>Speed: ${vehicle.speed} km/h</div>
                </div>
            `;

            card.addEventListener('click', () => this.selectVehicle(vehicle.id));
            vehicleList.appendChild(card);
        });
    }

    updateMapMarkers() {
        // Check if user is normal user (not admin)
        const auth = sessionStorage.getItem('auth');
        let isNormalUser = false;
        if (auth) {
            try {
                const authData = JSON.parse(auth);
                isNormalUser = authData.role === 'user';
            } catch (e) {
                console.error('Error parsing auth:', e);
            }
        }
        
        this.vehicles.forEach(vehicle => {
            if (!this.markers[vehicle.id]) {
                // Create new marker
                const marker = new google.maps.Marker({
                    position: { lat: vehicle.lat, lng: vehicle.lng },
                    map: this.map,
                    title: vehicle.name,
                    icon: this.getMarkerIcon(vehicle)
                });

                // Add info window
                const infoWindow = new google.maps.InfoWindow({
                    content: this.getInfoWindowContent(vehicle)
                });

                marker.addListener('click', () => {
                    infoWindow.open(this.map, marker);
                    this.selectVehicle(vehicle.id);
                });

                this.markers[vehicle.id] = marker;
            } else {
                // Update existing marker
                this.markers[vehicle.id].setPosition({ lat: vehicle.lat, lng: vehicle.lng });
                this.markers[vehicle.id].setIcon(this.getMarkerIcon(vehicle));
            }

            // Only update route history and draw traveled path for admin users
            // Normal users should only see the vehicle icon and intended route
            if (!isNormalUser) {
                // Update route history
                vehicle.routeHistory.push({ lat: vehicle.lat, lng: vehicle.lng, time: new Date() });
                if (vehicle.routeHistory.length > 100) {
                    vehicle.routeHistory.shift();
                }

                // Update polyline (traveled path) - only for admin
                this.updateRoutePolyline(vehicle);
            }
        });
    }

    getMarkerIcon(vehicle) {
        // Use web-based car icon with SVG
        const statusColor = vehicle.status === 'overspeed' ? '#ef4444' : 
                           vehicle.status === 'moving' ? '#10b981' : '#6b7280';
        
        const svgIcon = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24">
                <path fill="${statusColor}" d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
            </svg>
        `;
        
        return {
            url: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20)
        };
    }

    getInfoWindowContent(vehicle) {
        return `
            <div style="color: #1e293b; padding: 0.5rem;">
                <h3 style="margin: 0 0 0.5rem;">${vehicle.name}</h3>
                <p style="margin: 0.25rem 0;"><strong>ID:</strong> ${vehicle.id}</p>
                <p style="margin: 0.25rem 0;"><strong>Driver:</strong> ${vehicle.driver}</p>
                <p style="margin: 0.25rem 0;"><strong>Speed:</strong> ${vehicle.speed} km/h</p>
                <p style="margin: 0.25rem 0;"><strong>Status:</strong> ${vehicle.status}</p>
                <p style="margin: 0.25rem 0;"><strong>Engine:</strong> ${vehicle.engineStatus}</p>
            </div>
        `;
    }

    updateRoutePolyline(vehicle) {
        if (vehicle.routeHistory.length < 2) return;

        if (!this.polylines[vehicle.id]) {
            this.polylines[vehicle.id] = new google.maps.Polyline({
                path: vehicle.routeHistory.map(p => ({ lat: p.lat, lng: p.lng })),
                geodesic: true,
                strokeColor: vehicle.status === 'overspeed' ? '#ef4444' : '#10b981',
                strokeOpacity: 0.6,
                strokeWeight: 3,
                map: this.map
            });
        } else {
            this.polylines[vehicle.id].setPath(
                vehicle.routeHistory.map(p => ({ lat: p.lat, lng: p.lng }))
            );
        }
    }

    selectVehicle(vehicleId) {
        this.selectedVehicle = this.vehicles.find(v => v.id === vehicleId);
        
        // Update UI
        document.querySelectorAll('.vehicle-card').forEach(card => {
            card.classList.remove('active');
        });
        document.querySelector(`[data-vehicle-id="${vehicleId}"]`).classList.add('active');

        // Center map on vehicle
        if (this.markers[vehicleId]) {
            this.map.setCenter(this.markers[vehicleId].getPosition());
            this.map.setZoom(15);
        }

        // Update vehicle details
        this.updateVehicleDetails();
        this.updateSpeedAnalytics();
        this.updateStatusIndicators();
    }

    updateVehicleDetails() {
        if (!this.selectedVehicle) return;

        const detailsContainer = document.getElementById('vehicleDetails');
        const vehicle = this.selectedVehicle;

        detailsContainer.innerHTML = `
            <div class="detail-item">
                <span class="detail-label">Vehicle ID:</span>
                <span class="detail-value">${vehicle.id}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Vehicle Name:</span>
                <span class="detail-value">${vehicle.name}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Driver:</span>
                <span class="detail-value">${vehicle.driver}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Route:</span>
                <span class="detail-value">${vehicle.route}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Coordinates:</span>
                <span class="detail-value">${vehicle.lat.toFixed(6)}, ${vehicle.lng.toFixed(6)}</span>
            </div>
        `;
    }

    updateSpeedAnalytics() {
        if (!this.selectedVehicle) return;

        const vehicle = this.selectedVehicle;
        
        document.getElementById('currentSpeed').textContent = `${vehicle.speed} km/h`;
        document.getElementById('topSpeed').textContent = `${vehicle.maxSpeed} km/h`;
        document.getElementById('avgSpeed').textContent = `${vehicle.avgSpeed} km/h`;

        const speedStatus = document.getElementById('speedStatus');
        speedStatus.className = 'speed-status';
        
        if (vehicle.status === 'overspeed') {
            speedStatus.textContent = 'OVERSPEED';
            speedStatus.classList.add('danger');
        } else if (vehicle.speed > this.speedLimit * (1 - this.alertThreshold / 100)) {
            speedStatus.textContent = 'WARNING';
            speedStatus.classList.add('warning');
        } else {
            speedStatus.textContent = 'NORMAL';
            speedStatus.classList.add('normal');
        }
    }

    updateStatusIndicators() {
        if (!this.selectedVehicle) return;

        const vehicle = this.selectedVehicle;
        
        document.getElementById('engineStatus').textContent = vehicle.engineStatus.toUpperCase();
        document.getElementById('engineStatus').className = vehicle.engineStatus === 'on' ? 'status-value online' : 'status-value offline';
        
        document.getElementById('movementStatus').textContent = vehicle.status.toUpperCase();
        
        // Check geo-fence status
        const geoFenceStatus = this.checkGeoFence(vehicle);
        document.getElementById('geoFenceStatus').textContent = geoFenceStatus;
        
        document.getElementById('lastUpdate').textContent = this.formatTime(vehicle.lastUpdate);
    }

    checkGeoFence(vehicle) {
        for (const fence of this.geoFences) {
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(vehicle.lat, vehicle.lng),
                new google.maps.LatLng(fence.lat, fence.lng)
            );
            
            if (distance > fence.radius) {
                this.addAlert('danger', `${vehicle.id} has left the geo-fence: ${fence.name}`);
                return 'Outside';
            }
        }
        return 'Inside';
    }

    startRealTimeUpdates() {
        let lastUpdateKey = null;
        
        // Listen for vehicle updates from controller
        window.addEventListener('storage', (e) => {
            if (e.key === 'vehicleUpdate' || e.key?.startsWith('vehicleUpdate_')) {
                try {
                    const updateValue = e.newValue || localStorage.getItem(e.key);
                    if (updateValue) {
                        const data = JSON.parse(updateValue);
                        if (data && data.vehicle) {
                            this.updateVehicleFromController(data.vehicle);
                            this.updateMapMarkers();
                            this.renderVehicleList();
                        }
                    }
                } catch (err) {
                    console.error('Error parsing vehicle update:', err);
                }
            }
            
            // Check for all vehicles update
            if (e.key === 'allVehicles') {
                try {
                    const allVehicles = JSON.parse(e.newValue || localStorage.getItem('allVehicles'));
                    if (Array.isArray(allVehicles)) {
                        allVehicles.forEach(vehicleData => {
                            this.updateVehicleFromController(vehicleData);
                        });
                        this.updateMapMarkers();
                        this.renderVehicleList();
                    }
                } catch (err) {
                    console.error('Error parsing all vehicles update:', err);
                }
            }
            
            // Check for vehiclePaths update (when controller saves/loads paths)
            if (e.key === 'vehiclePaths') {
                try {
                    const savedPaths = e.newValue || localStorage.getItem('vehiclePaths');
                    if (savedPaths) {
                        this.vehiclePaths = JSON.parse(savedPaths);
                        this.drawRoutesFromPaths();
                    }
                } catch (err) {
                    console.error('Error parsing vehiclePaths update:', err);
                }
            }
        });
        
        // Also check localStorage periodically (for same-window updates)
        setInterval(() => {
            // Check for new vehicle updates
            const lastKey = localStorage.getItem('lastVehicleUpdate');
            if (lastKey && lastKey !== lastUpdateKey) {
                lastUpdateKey = lastKey;
                try {
                    const updateValue = localStorage.getItem(lastKey);
                    if (updateValue) {
                        const data = JSON.parse(updateValue);
                        if (data && data.vehicle) {
                            this.updateVehicleFromController(data.vehicle);
                            this.updateMapMarkers();
                            this.renderVehicleList();
                        }
                    }
                } catch (err) {
                    console.error('Error parsing vehicle update:', err);
                }
            }
            
            // Also check main vehicleUpdate key
            const update = localStorage.getItem('vehicleUpdate');
            if (update) {
                try {
                    const data = JSON.parse(update);
                    if (data && data.vehicle) {
                        this.updateVehicleFromController(data.vehicle);
                        this.updateMapMarkers();
                        this.renderVehicleList();
                    }
                } catch (err) {
                    console.error('Error parsing vehicle update:', err);
                }
            }
            
            // Check for all vehicles
            const allVehicles = localStorage.getItem('allVehicles');
            if (allVehicles) {
                try {
                    const vehicles = JSON.parse(allVehicles);
                    if (Array.isArray(vehicles)) {
                        vehicles.forEach(vehicleData => {
                            this.updateVehicleFromController(vehicleData);
                        });
                        this.updateMapMarkers();
                        this.renderVehicleList();
                    }
                } catch (err) {
                    console.error('Error parsing all vehicles:', err);
                }
            }
            
            // Check for vehiclePaths update (when controller saves/loads paths)
            const savedPaths = localStorage.getItem('vehiclePaths');
            if (savedPaths) {
                try {
                    const paths = JSON.parse(savedPaths);
                    // Only update if paths have changed
                    if (JSON.stringify(paths) !== JSON.stringify(this.vehiclePaths)) {
                        this.vehiclePaths = paths;
                        this.drawRoutesFromPaths();
                    }
                } catch (err) {
                    console.error('Error parsing vehiclePaths:', err);
                }
            }
        }, 500); // Check more frequently
        
        // Simulate real-time updates - in production, this would connect to your backend
        this.updateInterval = setInterval(() => {
            // Check if user is normal user
            const auth = sessionStorage.getItem('auth');
            let isNormalUser = false;
            if (auth) {
                try {
                    const authData = JSON.parse(auth);
                    isNormalUser = authData.role === 'user';
                } catch (e) {
                    console.error('Error parsing auth:', e);
                }
            }
            
            // Only simulate movement for admin (or if not logged in)
            if (!isNormalUser) {
                this.simulateVehicleMovement();
            }
            
            this.updateMapMarkers();
            this.renderVehicleList();
            
            // Also update user vehicle list if user is logged in
            if (isNormalUser) {
                this.renderUserVehicleList();
            }
            
            if (this.selectedVehicle) {
                this.updateVehicleDetails();
                this.updateSpeedAnalytics();
                this.updateStatusIndicators();
            }
            
            // Update Excel file periodically (only for admin)
            if (!isNormalUser && Math.random() > 0.7) {
                this.updateExcelFile();
            }
        }, 3000); // Update every 3 seconds
    }

    updateVehicleFromController(vehicleData) {
        let vehicle = this.vehicles.find(v => v.id === vehicleData.id);
        
        // If vehicle doesn't exist, add it
        if (!vehicle) {
            vehicle = {
                id: vehicleData.id,
                name: vehicleData.name || vehicleData.id,
                driver: vehicleData.driver || 'Unknown',
                route: vehicleData.route || 'Route Unknown',
                lat: vehicleData.lat,
                lng: vehicleData.lng,
                speed: vehicleData.speed || 0,
                maxSpeed: vehicleData.maxSpeed || 0,
                avgSpeed: vehicleData.avgSpeed || 0,
                status: vehicleData.status || 'stopped',
                engineStatus: vehicleData.engineStatus || 'off',
                lastUpdate: new Date(),
                routeHistory: []
            };
            this.vehicles.push(vehicle);
        } else {
            // Update existing vehicle
            vehicle.lat = vehicleData.lat;
            vehicle.lng = vehicleData.lng;
            vehicle.speed = vehicleData.speed;
            vehicle.status = vehicleData.status;
            vehicle.engineStatus = vehicleData.engineStatus;
            vehicle.lastUpdate = new Date();
            
            // Update max speed if current speed is higher
            if (vehicleData.speed > vehicle.maxSpeed) {
                vehicle.maxSpeed = vehicleData.speed;
            }
            
            // Update average speed
            vehicle.avgSpeed = (vehicle.avgSpeed * 0.9) + (vehicleData.speed * 0.1);
        }
        
        // Update UI if this vehicle is selected
        if (this.selectedVehicle && this.selectedVehicle.id === vehicle.id) {
            this.updateVehicleDetails();
            this.updateSpeedAnalytics();
            this.updateStatusIndicators();
        }
        
        // Update map markers
        this.updateMapMarkers();
        this.renderVehicleList();
        this.updateArrivalTimeTable();
    }

    simulateVehicleMovement() {
        this.vehicles.forEach(vehicle => {
            // Check if engine is locked - if locked, vehicle should not move
            if (this.engineLockStatus[vehicle.id]) {
                vehicle.speed = 0;
                vehicle.status = 'stopped';
                vehicle.engineStatus = 'off';
                return; // Don't process movement if locked
            }
            
            if (vehicle.engineStatus === 'on') {
                // Simulate movement only if engine is on and not locked
                const speedVariation = (Math.random() - 0.5) * 10;
                vehicle.speed = Math.max(0, vehicle.speed + speedVariation);
                
                // Update max speed
                if (vehicle.speed > vehicle.maxSpeed) {
                    vehicle.maxSpeed = vehicle.speed;
                }
                
                // Calculate average speed (simplified)
                vehicle.avgSpeed = (vehicle.avgSpeed * 0.9) + (vehicle.speed * 0.1);
                
                // Check for overspeeding
                if (vehicle.speed > this.speedLimit) {
                    vehicle.status = 'overspeed';
                    this.addAlert('danger', `${vehicle.id} is overspeeding at ${vehicle.speed.toFixed(1)} km/h`);
                } else if (vehicle.speed > 0) {
                    vehicle.status = 'moving';
                } else {
                    vehicle.status = 'stopped';
                }
                
                // Simulate position change
                if (vehicle.status === 'moving') {
                    const latChange = (Math.random() - 0.5) * 0.001;
                    const lngChange = (Math.random() - 0.5) * 0.001;
                    vehicle.lat += latChange;
                    vehicle.lng += lngChange;
                }
                
                vehicle.lastUpdate = new Date();
            } else if (vehicle.engineStatus === 'off' || vehicle.engineStatus === 'locked') {
                vehicle.speed = 0;
                vehicle.status = 'stopped';
            }
        });
    }

    addAlert(type, message) {
        const alertsContainer = document.getElementById('alertsContainer');
        const alert = document.createElement('div');
        alert.className = `alert-item alert-${type}`;
        alert.innerHTML = `
            <div>${message}</div>
            <div class="alert-time">${this.formatTime(new Date())}</div>
        `;
        
        alertsContainer.insertBefore(alert, alertsContainer.firstChild);
        
        // Play alert sound for danger and warning alerts
        if (type === 'danger' || type === 'warning') {
            this.playAlertSound();
        }
        
        // Keep only last 10 alerts
        while (alertsContainer.children.length > 10) {
            alertsContainer.removeChild(alertsContainer.lastChild);
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }

    setupEventListeners() {
        // Refresh button - trigger file selection
        document.getElementById('refreshBtn').addEventListener('click', () => {
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
                        this.addAlert('info', 'Data refreshed from Excel file');
                    } catch (error) {
                        this.addAlert('danger', 'Error loading Excel file: ' + error.message);
                    }
                };
                reader.readAsArrayBuffer(file);
            };
            
            fileInput.click();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportToExcel();
        });

        // Engine lock button (admin only)
        const engineLockBtn = document.getElementById('engineLockBtn');
        if (engineLockBtn) {
            engineLockBtn.addEventListener('click', () => {
                // Check if user is admin
                const auth = sessionStorage.getItem('auth');
                if (auth) {
                    try {
                        const authData = JSON.parse(auth);
                        if (authData.role !== 'admin') {
                            alert('Access denied! Only administrators can lock/unlock engines.');
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing auth:', e);
                    }
                }
                
                if (this.selectedVehicle) {
                    this.toggleEngineLock();
                } else {
                    alert('Please select a vehicle first');
                }
            });
        }

        // Geo-fence button
        document.getElementById('geoFenceBtn').addEventListener('click', () => {
            this.openGeoFenceModal();
        });

        // Speed limit button
        document.getElementById('speedLimitBtn').addEventListener('click', () => {
            this.openSpeedLimitModal();
        });

        // Map controls
        document.getElementById('centerMapBtn').addEventListener('click', () => {
            if (this.selectedVehicle && this.markers[this.selectedVehicle.id]) {
                this.map.setCenter(this.markers[this.selectedVehicle.id].getPosition());
                this.map.setZoom(15);
            } else {
                this.map.setZoom(13);
            }
        });

        document.getElementById('clearRouteBtn').addEventListener('click', () => {
            Object.values(this.polylines).forEach(polyline => polyline.setMap(null));
            this.polylines = {};
            this.vehicles.forEach(v => v.routeHistory = []);
            this.addAlert('info', 'Route history cleared');
        });

        // Clear geo-fences button
        document.getElementById('clearGeoFenceBtn').addEventListener('click', () => {
            this.clearGeoFences();
        });

        // Show route button
        document.getElementById('showRouteBtn').addEventListener('click', () => {
            if (this.selectedVehicle && this.vehiclePaths[this.selectedVehicle.id]) {
                this.drawRoutesFromPaths();
                // Center map on route
                const path = this.vehiclePaths[this.selectedVehicle.id];
                if (path.length > 0) {
                    const bounds = new google.maps.LatLngBounds();
                    path.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
                    this.map.fitBounds(bounds);
                }
                this.addAlert('info', `Route displayed for ${this.selectedVehicle.id}`);
            } else {
                this.addAlert('warning', 'No route data available. Load from Excel first.');
            }
        });

        // Controller button (admin only)
        const controllerBtn = document.getElementById('controllerBtn');
        if (controllerBtn) {
            controllerBtn.addEventListener('click', () => {
                // Check if user is admin
                const auth = sessionStorage.getItem('auth');
                if (auth) {
                    try {
                        const authData = JSON.parse(auth);
                        if (authData.role !== 'admin') {
                            alert('Access denied! Controller is only available for administrators.');
                            return;
                        }
                    } catch (e) {
                        console.error('Error parsing auth:', e);
                    }
                }
                window.open('vehicle-controller.html', '_blank');
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('active');
            });
        });

        // Save geo-fence
        document.getElementById('saveFenceBtn').addEventListener('click', () => {
            this.saveGeoFence();
        });

        // Save speed limit
        document.getElementById('saveSpeedLimitBtn').addEventListener('click', () => {
            this.saveSpeedLimit();
        });
    }

    toggleEngineLock() {
        if (!this.selectedVehicle) return;
        
        const vehicleId = this.selectedVehicle.id;
        this.engineLockStatus[vehicleId] = !this.engineLockStatus[vehicleId];
        
        if (this.engineLockStatus[vehicleId]) {
            this.selectedVehicle.engineStatus = 'off';
            this.addAlert('warning', `Engine locked for ${vehicleId}`);
        } else {
            this.selectedVehicle.engineStatus = 'on';
            this.addAlert('info', `Engine unlocked for ${vehicleId}`);
        }
        
        this.updateStatusIndicators();
    }

    openGeoFenceModal() {
        const modal = document.getElementById('geoFenceModal');
        modal.classList.add('active');
        
        // Pre-fill with current map center if available
        if (this.selectedVehicle) {
            document.getElementById('fenceLat').value = this.selectedVehicle.lat;
            document.getElementById('fenceLng').value = this.selectedVehicle.lng;
        } else {
            const center = this.map.getCenter();
            document.getElementById('fenceLat').value = center.lat();
            document.getElementById('fenceLng').value = center.lng();
        }
    }

    saveGeoFence() {
        const name = document.getElementById('fenceName').value;
        const radius = parseFloat(document.getElementById('fenceRadius').value);
        const lat = parseFloat(document.getElementById('fenceLat').value);
        const lng = parseFloat(document.getElementById('fenceLng').value);

        if (!name || !radius || !lat || !lng) {
            alert('Please fill all fields');
            return;
        }

        const fence = { name, radius, lat, lng };
        this.geoFences.push(fence);

        // Draw circle on map
        const circle = new google.maps.Circle({
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: '#FF0000',
            fillOpacity: 0.15,
            map: this.map,
            center: { lat, lng },
            radius: radius
        });

        fence.circle = circle;

        document.getElementById('geoFenceModal').classList.remove('active');
        this.addAlert('info', `Geo-fence "${name}" created`);
    }

    openSpeedLimitModal() {
        const modal = document.getElementById('speedLimitModal');
        document.getElementById('speedLimitValue').value = this.speedLimit;
        document.getElementById('alertThreshold').value = this.alertThreshold;
        modal.classList.add('active');
    }

    saveSpeedLimit() {
        this.speedLimit = parseFloat(document.getElementById('speedLimitValue').value);
        this.alertThreshold = parseFloat(document.getElementById('alertThreshold').value);
        
        document.getElementById('speedLimitModal').classList.remove('active');
        this.addAlert('info', `Speed limit set to ${this.speedLimit} km/h`);
        
        // Re-check all vehicles
        this.vehicles.forEach(vehicle => {
            if (vehicle.speed > this.speedLimit) {
                vehicle.status = 'overspeed';
            }
        });
    }

    clearGeoFences() {
        // Remove all geo-fence circles from map
        this.geoFences.forEach(fence => {
            if (fence.circle) {
                fence.circle.setMap(null);
            }
        });
        
        this.geoFences = [];
        this.addAlert('info', 'All geo-fences cleared');
    }

    loadExcelData() {
        // Load path data from Excel file
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
                    
                    // Read from 'Vehicle Paths' sheet
                    const sheetName = workbook.SheetNames.find(name => 
                        name.toLowerCase().includes('path') || name.toLowerCase().includes('vehicle')
                    ) || workbook.SheetNames[0];
                    
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    // Process path data
                    this.processPathData(jsonData);
                    this.addAlert('info', 'Path data loaded from Excel successfully');
                } catch (error) {
                    console.error('Error reading Excel file:', error);
                    this.addAlert('danger', 'Error loading Excel file: ' + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
        };
        
        // Auto-load if file exists (for demo, we'll check localStorage)
        // This will be called for both admin and user panels
        const savedPaths = localStorage.getItem('vehiclePaths');
        if (savedPaths) {
            try {
                this.vehiclePaths = JSON.parse(savedPaths);
                this.drawRoutesFromPaths();
            } catch (e) {
                console.error('Error loading saved paths:', e);
            }
        }
    }

    processPathData(data) {
        // Group paths by vehicle ID - support multiple paths per vehicle
        this.vehiclePaths = {};
        
        data.forEach(row => {
            const vehicleId = row['Vehicle ID'] || row['vehicle_id'] || row['VehicleId'];
            const routeName = row['Route Name'] || row['route_name'] || row['RouteName'] || 'default';
            if (!vehicleId) return;
            
            // Create unique key for vehicle + route combination
            const pathKey = `${vehicleId}_${routeName}`;
            
            if (!this.vehiclePaths[pathKey]) {
                this.vehiclePaths[pathKey] = {
                    vehicleId: vehicleId,
                    routeName: routeName,
                    points: []
                };
            }
            
            const point = {
                order: parseInt(row['Point Order'] || row['point_order'] || row['PointOrder'] || 0),
                lat: parseFloat(row['Latitude'] || row['latitude'] || 0),
                lng: parseFloat(row['Longitude'] || row['longitude'] || 0),
                speed: parseFloat(row['Speed (km/h)'] || row['speed'] || 0),
                stopDuration: parseInt(row['Stop Duration (sec)'] || row['stop_duration'] || 0),
                description: row['Description'] || row['description'] || ''
            };
            
            if (point.lat && point.lng) {
                this.vehiclePaths[pathKey].points.push(point);
            }
        });
        
        // Sort by point order for each path
        Object.keys(this.vehiclePaths).forEach(pathKey => {
            this.vehiclePaths[pathKey].points.sort((a, b) => a.order - b.order);
        });
        
        // Save to localStorage
        localStorage.setItem('vehiclePaths', JSON.stringify(this.vehiclePaths));
        
        // Draw routes
        this.drawRoutesFromPaths();
        this.updateArrivalTimeTable();
    }

    drawRoutesFromPaths() {
        // Clear existing route polylines and directions renderers
        Object.values(this.routePolylines).forEach(polyline => {
            if (polyline && polyline.setMap) polyline.setMap(null);
        });
        this.routePolylines = {};
        
        // Initialize Directions Service if not exists
        if (!this.directionsService) {
            this.directionsService = new google.maps.DirectionsService();
        }
        
        // Draw routes for each vehicle/route combination using Directions Service for road-snapped paths
        Object.keys(this.vehiclePaths).forEach(pathKey => {
            const pathData = this.vehiclePaths[pathKey];
            const path = pathData.points;
            const vehicleId = pathData.vehicleId;
            
            if (path.length < 2) return;
            
            // Use Directions Service to get road-snapped route
            const waypoints = [];
            for (let i = 1; i < path.length - 1; i++) {
                waypoints.push({
                    location: new google.maps.LatLng(path[i].lat, path[i].lng),
                    stopover: false
                });
            }
            
            const request = {
                origin: new google.maps.LatLng(path[0].lat, path[0].lng),
                destination: new google.maps.LatLng(
                    path[path.length - 1].lat,
                    path[path.length - 1].lng
                ),
                waypoints: waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
                optimizeWaypoints: false
            };
            
            this.directionsService.route(request, (result, status) => {
                if (status === 'OK') {
                    // Create directions renderer for this path (support multiple paths per vehicle)
                    if (!this.routePolylines[pathKey]) {
                        this.routePolylines[pathKey] = new google.maps.DirectionsRenderer({
                            map: this.map,
                            directions: result,
                            suppressMarkers: true,
                            polylineOptions: {
                                strokeColor: '#4A90E2',
                                strokeWeight: 4,
                                strokeOpacity: 0.8
                            }
                        });
                    } else {
                        this.routePolylines[pathKey].setDirections(result);
                    }
                    
                    // Add start and end markers (use pathKey to support multiple paths)
                    const startPoint = path[0];
                    const endPoint = path[path.length - 1];
                    
                    // Start marker (green)
                    const startMarkerKey = `${pathKey}_start`;
                    if (!this.markers[startMarkerKey]) {
                        this.markers[startMarkerKey] = new google.maps.Marker({
                            position: { lat: startPoint.lat, lng: startPoint.lng },
                            map: this.map,
                            title: `${vehicleId} - ${pathData.routeName} - Start`,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 12,
                                fillColor: '#10b981',
                                fillOpacity: 1,
                                strokeColor: 'white',
                                strokeWeight: 2
                            },
                            label: {
                                text: 'S',
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        });
                    }
                    
                    // End marker (red)
                    const endMarkerKey = `${pathKey}_end`;
                    if (!this.markers[endMarkerKey]) {
                        this.markers[endMarkerKey] = new google.maps.Marker({
                            position: { lat: endPoint.lat, lng: endPoint.lng },
                            map: this.map,
                            title: `${vehicleId} - ${pathData.routeName} - Destination`,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 12,
                                fillColor: '#ef4444',
                                fillOpacity: 1,
                                strokeColor: 'white',
                                strokeWeight: 2
                            },
                            label: {
                                text: 'E',
                                color: 'white',
                                fontWeight: 'bold'
                            }
                        });
                    }
                } else {
                    // Fallback to simple polyline if directions fail
                    const routePath = path.map(p => ({ lat: p.lat, lng: p.lng }));
                    this.routePolylines[pathKey] = new google.maps.Polyline({
                        path: routePath,
                        geodesic: true,
                        strokeColor: '#4A90E2',
                        strokeOpacity: 0.8,
                        strokeWeight: 4,
                        map: this.map
                    });
                }
            });
        });
    }
    
    // Load paths from controller/localStorage for user panel
    loadPathsForUserPanel() {
        // Load paths from localStorage (saved by controller)
        const savedPaths = localStorage.getItem('vehiclePaths');
        if (savedPaths) {
            try {
                this.vehiclePaths = JSON.parse(savedPaths);
                this.drawRoutesFromPaths();
            } catch (e) {
                console.error('Error loading saved paths:', e);
            }
        }
    }

    updateExcelFile() {
        // Prepare data for Excel export
        const excelData = this.vehicles.map(vehicle => ({
            'Vehicle ID': vehicle.id,
            'Vehicle Name': vehicle.name,
            'Driver': vehicle.driver,
            'Route': vehicle.route,
            'Latitude': vehicle.lat,
            'Longitude': vehicle.lng,
            'Speed (km/h)': vehicle.speed,
            'Max Speed (km/h)': vehicle.maxSpeed,
            'Avg Speed (km/h)': vehicle.avgSpeed,
            'Status': vehicle.status,
            'Engine Status': vehicle.engineStatus,
            'Last Update': vehicle.lastUpdate.toISOString()
        }));

        // Send to Python script to update Excel file
        // In production, this would be an API call
        console.log('Updating Excel file with latest coordinates...', excelData);
    }

    exportToExcel() {
        const excelData = this.vehicles.map(vehicle => ({
            'Vehicle ID': vehicle.id,
            'Vehicle Name': vehicle.name,
            'Driver': vehicle.driver,
            'Route': vehicle.route,
            'Latitude': vehicle.lat,
            'Longitude': vehicle.lng,
            'Speed (km/h)': vehicle.speed,
            'Max Speed (km/h)': vehicle.maxSpeed,
            'Avg Speed (km/h)': vehicle.avgSpeed,
            'Status': vehicle.status,
            'Engine Status': vehicle.engineStatus,
            'Last Update': vehicle.lastUpdate.toISOString()
        }));

        // Create workbook and worksheet
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Data');

        // Export to file
        XLSX.writeFile(wb, `vehicle_tracking_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        this.addAlert('info', 'Data exported to Excel file');
    }

    createArrivalTimeTable() {
        // Table is already in HTML, just ensure it exists
        const tableBody = document.getElementById('arrivalTimeTableBody');
        if (!tableBody) return;
    }

    calculateVehicleArrivalTime(vehicle) {
        // Find paths for this vehicle
        const vehiclePaths = Object.keys(this.vehiclePaths).filter(key => 
            this.vehiclePaths[key].vehicleId === vehicle.id
        );
        
        if (vehiclePaths.length === 0) return null;
        
        // Use the first path (or could use active path)
        const pathKey = vehiclePaths[0];
        const pathData = this.vehiclePaths[pathKey];
        const path = pathData.points;
        
        if (path.length < 2) return null;
        
        // Find nearest point on path
        let nearestIndex = 0;
        let minDistance = Infinity;
        
        path.forEach((point, index) => {
            const distance = this.calculateDistance(
                vehicle.lat, vehicle.lng,
                point.lat, point.lng
            );
            if (distance < minDistance) {
                minDistance = distance;
                nearestIndex = index;
            }
        });
        
        // Calculate remaining distance and time
        let totalDistance = 0;
        let totalTime = 0;
        
        for (let i = nearestIndex; i < path.length - 1; i++) {
            const currentPoint = path[i];
            const nextPoint = path[i + 1];
            
            const distance = this.calculateDistance(
                currentPoint.lat, currentPoint.lng,
                nextPoint.lat, nextPoint.lng
            );
            
            totalDistance += distance;
            
            const speed = currentPoint.speed || vehicle.speed || 40;
            if (speed > 0) {
                totalTime += (distance / speed) * 3600; // seconds
            }
            
            if (nextPoint.stopDuration) {
                totalTime += nextPoint.stopDuration;
            }
        }
        
        const progress = path.length > 0 ? Math.round((nearestIndex / path.length) * 100) : 0;
        
        return {
            distance: totalDistance,
            time: totalTime,
            arrivalTime: new Date(Date.now() + totalTime * 1000),
            progress: progress
        };
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

    updateArrivalTimeTable() {
        const tableBody = document.getElementById('arrivalTimeTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        this.vehicles.forEach(vehicle => {
            const arrivalInfo = this.calculateVehicleArrivalTime(vehicle);
            
            const row = document.createElement('tr');
            
            if (arrivalInfo) {
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

    startArrivalTimeUpdates() {
        // Update arrival time table every 5 seconds
        setInterval(() => {
            this.updateArrivalTimeTable();
        }, 5000);
    }
}

// Initialize the transport manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.transportManager = new TransportManager();
});



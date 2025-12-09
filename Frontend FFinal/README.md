# School Transport Management System - Smart Drive Mate

A comprehensive real-time vehicle tracking and monitoring system for school buses with advanced features including speed monitoring, overspeeding detection, remote engine lock, and geo-fencing.

## Features

### 🚌 Vehicle Tracking
- Real-time GPS tracking of school buses
- Interactive map with live vehicle positions
- Route history visualization
- Multiple vehicle monitoring

### ⚡ Speed Monitoring
- **Current Speed**: Real-time speed display
- **Top Speed**: Maximum speed tracking
- **Average Speed**: Calculated average speed
- **Instantaneous Speed**: Speed at every instance
- **Overspeeding Detection**: Automatic alerts when speed exceeds limits

### 🔒 Vehicle Control
- **Remote Engine Lock**: Lock/unlock vehicle engines remotely
- **Start/Stop Detection**: Monitor when vehicles start and stop
- **Status Monitoring**: Real-time engine and movement status

### 📍 Geo-Fencing
- Define custom geo-fence boundaries
- Automatic alerts when vehicles leave designated areas
- Visual representation on map

### 📊 Data Management
- **Excel Integration**: Automatic coordinate updates to Excel file
- **Real-time Data Export**: Export vehicle data to Excel
- **Historical Tracking**: Complete route and speed history

### 🔔 Alerts & Notifications
- Overspeeding alerts
- Geo-fence violation alerts
- Engine status changes
- Real-time notifications panel

## Installation

### Prerequisites
- Python 3.7 or higher
- Modern web browser (Chrome, Firefox, Edge)
- Google Maps API key (for map functionality)

### Step 1: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Get Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Maps JavaScript API"
4. Create an API key
5. Copy your API key

### Step 3: Configure API Key

Open `transport-dashboard.html` and replace `YOUR_API_KEY` with your actual Google Maps API key:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_ACTUAL_API_KEY&libraries=geometry,drawing"></script>
```

### Step 4: Initialize Excel File

Run the Python script to create the initial Excel file:

```bash
python excel_coord_updater.py
```

This will create `vehicle_coordinates.xlsx` with sample data.

## Usage

### Starting the Web Dashboard

1. Open `transport-dashboard.html` in your web browser
2. The dashboard will load with sample vehicle data
3. Click on any vehicle card to view details and track on map

### Running Real-time Updates

For continuous coordinate updates, modify `excel_coord_updater.py`:

```python
# Uncomment this line in main() function:
updater.run_continuous_updates(interval=5)  # Updates every 5 seconds
```

Then run:
```bash
python excel_coord_updater.py
```

### Using Vehicle Features

#### Select a Vehicle
- Click on any vehicle card in the left panel
- The map will center on the selected vehicle
- Vehicle details will appear in the right panel

#### Remote Engine Lock
1. Select a vehicle
2. Click "🔒 Engine Lock" button
3. Engine will be locked/unlocked remotely

#### Set Geo-Fence
1. Click "📍 Set Geo-Fence" button
2. Enter fence name and radius
3. Set center coordinates (or use current map center)
4. Click "Save Geo-Fence"
5. A red circle will appear on the map

#### Set Speed Limit
1. Click "⚡ Speed Limit" button
2. Enter speed limit in km/h
3. Set alert threshold percentage
4. Click "Save Speed Limit"
5. System will alert when vehicles exceed the limit

#### Export Data
- Click "📊 Export Data" to download current vehicle data as Excel file
- Data includes coordinates, speeds, status, and timestamps

## File Structure

```
Vehicle tracker/
│
├── transport-dashboard.html    # Main web dashboard
├── transport-styles.css        # Dashboard styling
├── transport-script.js         # JavaScript for tracking and features
├── excel_coord_updater.py      # Python script for Excel updates
├── requirements.txt            # Python dependencies
├── README.md                   # This file
│
└── vehicle_coordinates.xlsx    # Generated Excel file (created after first run)
```

## Excel File Structure

The Excel file contains the following columns:
- Vehicle ID
- Vehicle Name
- Driver
- Route
- Latitude
- Longitude
- Speed (km/h)
- Max Speed (km/h)
- Avg Speed (km/h)
- Status
- Engine Status
- Timestamp
- Date
- Time

## API Integration

To integrate with your actual vehicle tracking system:

1. **Modify `loadVehicles()` in `transport-script.js`**:
   - Replace sample data with API calls to your backend
   - Use `fetch()` or `axios` to get real-time data

2. **Update `updateExcelFile()` in `transport-script.js`**:
   - Send data to your backend API
   - Backend can then update the Excel file using the Python script

3. **Modify `excel_coord_updater.py`**:
   - Connect to your database or API
   - Replace `generate_sample_data()` with actual data fetching

## Customization

### Change Default Location
Edit the `defaultCenter` in `transport-script.js`:

```javascript
const defaultCenter = { lat: YOUR_LATITUDE, lng: YOUR_LONGITUDE };
```

### Adjust Update Interval
Change the update interval in `transport-script.js`:

```javascript
this.updateInterval = setInterval(() => {
    // ... update code
}, 3000); // Change 3000 to your desired milliseconds
```

### Modify Speed Limits
Default speed limit is 60 km/h. Change in `transport-script.js`:

```javascript
this.speedLimit = 60; // Change to your desired limit
```

## Troubleshooting

### Map Not Loading
- Verify your Google Maps API key is correct
- Check browser console for API errors
- Ensure "Maps JavaScript API" is enabled in Google Cloud Console

### Excel File Not Updating
- Check file permissions
- Ensure `openpyxl` is installed: `pip install openpyxl`
- Verify Python script has write access to the directory

### Vehicles Not Moving
- Check if engine lock is enabled
- Verify vehicle status in the details panel
- Check browser console for JavaScript errors

## Security Notes

- **API Key Security**: Never commit your Google Maps API key to public repositories
- **File Permissions**: Restrict access to Excel files containing sensitive location data
- **HTTPS**: Use HTTPS in production for secure data transmission

## Future Enhancements

- [ ] Parent mobile app integration
- [ ] Push notifications for parents
- [ ] Driver incident reporting system
- [ ] Route optimization
- [ ] Fuel consumption tracking
- [ ] Maintenance scheduling
- [ ] Student attendance tracking
- [ ] Multi-school support

## Support

For issues or questions:
- Check the browser console for errors
- Verify all dependencies are installed
- Ensure API keys are correctly configured

## License

This project is developed for School Transport Management purposes.

---

**Developed with ❤️ for School Transport Safety**







# Quick Setup Guide

## Step-by-Step Installation

### 1. Install Python Dependencies

Open terminal/command prompt and run:

```bash
pip install -r requirements.txt
```

### 2. Get Google Maps API Key

1. Visit: https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Go to "APIs & Services" > "Library"
4. Search for "Maps JavaScript API"
5. Click "Enable"
6. Go to "Credentials" > "Create Credentials" > "API Key"
7. Copy your API key

### 3. Configure API Key

1. Open `transport-dashboard.html` in a text editor
2. Find this line (around line 10):
   ```html
   <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=geometry,drawing"></script>
   ```
3. Replace `YOUR_API_KEY` with your actual API key
4. Save the file

### 4. Generate Initial Excel File

Run this command:

```bash
python excel_coord_updater.py
```

This creates `vehicle_coordinates.xlsx` with sample data.

### 5. Open the Dashboard

1. Open `transport-dashboard.html` in your web browser
2. You should see the dashboard with 3 sample vehicles
3. Click on any vehicle to track it on the map

## Testing Features

### Test Vehicle Selection
- Click on "BUS-001" in the left panel
- Map should center on the vehicle
- Details appear in the right panel

### Test Engine Lock
1. Select a vehicle
2. Click "🔒 Engine Lock"
3. Vehicle should stop moving

### Test Geo-Fence
1. Click "📍 Set Geo-Fence"
2. Enter name: "School Zone"
3. Set radius: 500 meters
4. Click "Save Geo-Fence"
5. Red circle appears on map

### Test Speed Limit
1. Click "⚡ Speed Limit"
2. Set limit: 50 km/h
3. Click "Save Speed Limit"
4. Watch for overspeed alerts

### Test Export
1. Click "📊 Export Data"
2. Excel file downloads automatically

## Running Real-time Updates

To continuously update the Excel file:

1. Open `excel_coord_updater.py`
2. Find the `main()` function
3. Uncomment this line:
   ```python
   updater.run_continuous_updates(interval=5)
   ```
4. Comment out the sample data generation:
   ```python
   # sample_data = updater.generate_sample_data(num_vehicles=3)
   # updater.update_vehicle_data(sample_data)
   ```
5. Run: `python excel_coord_updater.py`
6. Excel file updates every 5 seconds

## Troubleshooting

### Map shows gray/blank
- Check API key is correct
- Verify Maps JavaScript API is enabled
- Check browser console for errors

### Excel file not created
- Check Python is installed: `python --version`
- Verify openpyxl is installed: `pip list | grep openpyxl`
- Check file permissions in the directory

### Vehicles not moving
- Check browser console (F12) for errors
- Verify JavaScript is enabled
- Try refreshing the page

## Next Steps

1. **Connect to Real Data**: Modify `transport-script.js` to connect to your vehicle tracking API
2. **Customize Vehicles**: Update vehicle list in `loadVehicles()` function
3. **Set Your Location**: Change default map center to your school location
4. **Configure Alerts**: Adjust speed limits and alert thresholds

## Support

If you encounter issues:
1. Check browser console (F12) for errors
2. Verify all files are in the same directory
3. Ensure API key is correctly configured
4. Check that Python dependencies are installed

---

**Ready to track! 🚌**







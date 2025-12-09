# Usage Guide - School Transport Management System

## Overview

The system now has **two main pages**:

1. **Dashboard** (`transport-dashboard.html`) - View data, alerts, and monitoring
2. **Controller** (`vehicle-controller.html`) - Control vehicle movement, speed, and paths

## Dashboard Features

### Viewing Data
- **Vehicle List**: See all active vehicles in the left panel
- **Live Map**: Real-time tracking with markers and routes
- **Vehicle Details**: Select a vehicle to see detailed information
- **Speed Analytics**: Current, top, and average speeds
- **Alerts**: Real-time notifications with **sound alerts** for warnings and dangers

### Loading Routes from Excel

1. Click **"🔄 Refresh"** button
2. Select `vehicle_path_template.xlsx` file
3. The system will automatically:
   - Read coordinates from Excel
   - Draw route from initial to final destination
   - Show start (green) and end (red) markers
   - Display route as blue line on map

### Excel File Format

The Excel file should have these columns:
- **Vehicle ID**: e.g., BUS-001
- **Route Name**: e.g., Route A
- **Point Order**: Sequence number (1, 2, 3, ...)
- **Latitude**: GPS latitude
- **Longitude**: GPS longitude
- **Speed (km/h)**: Speed at this point
- **Stop Duration (sec)**: How long to wait
- **Description**: Optional note

### Route Visualization

- Click **"🛣️ Show Route"** to display the route for selected vehicle
- Routes show as blue lines connecting all points
- Green marker (S) = Start point
- Red marker (E) = End/Destination point

### Geo-Fencing

- Click **"📍 Set Geo-Fence"** to create boundaries
- Click **"🗺️ Clear Geo-Fences"** to remove all geo-fences
- System alerts when vehicles leave geo-fenced areas

### Alert Sounds

- **Danger alerts** (overspeeding, geo-fence violations) play alert sounds
- **Warning alerts** also play sounds
- Info alerts are silent

## Controller Page Features

### Opening Controller

From Dashboard: Click **"🎮 Open Controller"** button

### Vehicle Control

1. **Select Vehicle**: Choose from dropdown
2. **Speed Control**:
   - Use slider to set speed (0-80 km/h)
   - Or click speed buttons (Stop, 20, 40, 60)
3. **Movement Control**:
   - **▶️ Start**: Start vehicle movement
   - **⏹️ Stop**: Stop vehicle completely
   - **⏸️ Pause**: Pause movement
4. **Engine Control**:
   - **🔒 Lock Engine**: Lock engine remotely
   - **🔓 Unlock Engine**: Unlock engine

### Path Control

1. **Load Path from Excel**:
   - Click "🛣️ Load Path from Excel"
   - Select `vehicle_path_template.xlsx`
   - System loads path points for selected vehicle

2. **Start Following Path**:
   - After loading path, click "▶️ Start Following Path"
   - Vehicle will automatically move along the path
   - Respects speed and stop duration from Excel

3. **Clear Path**: Remove loaded path

### Manual Position Control

1. Enter **Latitude** and **Longitude**
2. Click **"📍 Set Position"**
3. Vehicle position updates immediately

### Status Monitoring

Right panel shows:
- Vehicle ID
- Current status
- Speed
- Engine status
- Current position
- Number of path points loaded

### Control Logs

All actions are logged with timestamps:
- Success (green)
- Warning (yellow)
- Error (red)
- Info (blue)

## Workflow Example

### Setting Up a Route

1. **Open Controller** page
2. **Select vehicle** (e.g., BUS-001)
3. **Load path from Excel**:
   - Click "Load Path from Excel"
   - Select `vehicle_path_template.xlsx`
   - Path appears on map
4. **Start following path**:
   - Click "Start Following Path"
   - Vehicle moves automatically

### Monitoring in Dashboard

1. **Open Dashboard** page
2. **Select same vehicle** (BUS-001)
3. **View real-time updates**:
   - Position updates automatically
   - Speed changes reflected
   - Alerts appear with sounds
4. **View route**:
   - Click "Show Route" to see full path
   - Blue line shows planned route

## Excel File Management

### Creating/Editing Routes

1. Open `vehicle_path_template.xlsx`
2. Edit coordinates in "Vehicle Paths" sheet
3. Each row = one point in the route
4. **Point Order** must be sequential (1, 2, 3, ...)
5. Save the file
6. In Dashboard: Click "Refresh" to load new data
7. In Controller: Click "Load Path from Excel" to load new data

### Example Route Data

```
Vehicle ID | Route Name | Point Order | Latitude  | Longitude | Speed | Stop Duration | Description
BUS-001    | Route A    | 1           | 17.6868   | 83.2185   | 0     | 0             | Starting Point
BUS-001    | Route A    | 2           | 17.6900   | 83.2200   | 40    | 0             | Checkpoint 1
BUS-001    | Route A    | 3           | 17.6950   | 83.2250   | 45    | 0             | Checkpoint 2
BUS-001    | Route A    | 4           | 17.7000   | 83.2300   | 0     | 60            | Destination - School
```

## Tips

1. **Two Windows**: Keep Dashboard and Controller open in separate windows for best experience
2. **Excel Updates**: Always save Excel file before loading in system
3. **Route Planning**: Plan routes with realistic coordinates and speeds
4. **Alert Sounds**: Ensure browser allows audio for alert sounds
5. **Real-time Sync**: Controller changes appear in Dashboard automatically

## Troubleshooting

### Routes Not Showing
- Check Excel file has correct column names
- Verify coordinates are valid numbers
- Ensure Point Order is sequential

### Controller Not Updating Dashboard
- Refresh Dashboard page
- Check browser console for errors
- Ensure both pages are open

### Alert Sounds Not Playing
- Check browser audio permissions
- Try clicking on page first (some browsers require user interaction)
- Check browser console for audio errors

### Excel File Not Loading
- Ensure file is .xlsx format
- Check file is not open in another program
- Verify column names match expected format

---

**Happy Tracking! 🚌**






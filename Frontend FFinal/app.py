from flask import Flask, send_from_directory, request, jsonify
import os

# Import your Python scripts
import excel_coord_updater
import excel_template_creator

app = Flask(__name__, static_folder='.', static_url_path='')

# ---------------------------
# Serve Frontend Files
# ---------------------------

@app.route('/')
def serve_home():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# ---------------------------
# Example API: Process Excel (Modify as Needed)
# ---------------------------

@app.route('/process-coordinates', methods=['POST'])
def process_coordinates():
    try:
        file = request.files['file']
        filepath = "uploaded_input.xlsx"
        file.save(filepath)

        # Call your Python script here
        excel_coord_updater.process_file(filepath)

        return jsonify({"status": "success", "message": "Excel file processed"})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/create-template', methods=['GET'])
def create_template():
    try:
        output_file = excel_template_creator.create_template()
        return jsonify({"status": "success", "output": output_file})
    
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

# ---------------------------
# Run App Locally
# ---------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

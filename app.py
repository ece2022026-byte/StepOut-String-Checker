
from flask import Flask, request, jsonify, render_template
import parser
import evaluator
import visualizer

app = Flask(__name__)
TIME_TOLERANCE_MS = 4000

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/evaluate", methods=["POST"])
def evaluate():
    # 1. Capture text from the textareas
    gold_content = request.form.get("gold_text", "")
    trainee_content = request.form.get("trainee_text", "")

    if not gold_content or not trainee_content:
        return jsonify({"error": "Missing input data"}), 400

    try:
        # 2. Clean and Split data using the Rulebook-aligned parser
        gold_list = [parser.normalize(s) for s in gold_content.split(',') if s.strip()]
        trainee_list = [parser.normalize(s) for s in trainee_content.split(',') if s.strip()]

        # 3. Perform Match Evaluation
        result = evaluator.evaluate_match(
            gold_list,
            trainee_list,
            time_tolerance=TIME_TOLERANCE_MS
        )
        
        # 4. Generate All 3 Visualizations (Synced with your requested keys)
        # Ensure your visualizer.py has these exact function names
        result['field_chart'] = visualizer.generate_error_chart(result.get('field_errors'))
        
        result['pie_chart'] = visualizer.generate_pie_chart(
            result['correct'], 
            result['missed_count'], 
            result['extra_count'], 
            result['mismatch_count']
        )
        
        # This includes your 5-minute interval logic
        result['timeline_chart'] = visualizer.generate_timeline_chart(result['mismatched_details'])

        # 5. Return JSON (All keys requested will be sent here)
        return jsonify(result)

    except Exception as e:
        print(f"Server Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)

from flask import Flask, jsonify, render_template, request

from io import BytesIO
import os
import re
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile

import evaluator
import parser


app = Flask(__name__)
TIME_TOLERANCE_MS = 6000
ALLOWED_UPLOAD_EXTENSIONS = {".txt", ".docx"}


def _extract_docx_text(file_bytes):
    try:
        with ZipFile(BytesIO(file_bytes)) as docx_zip:
            xml_content = docx_zip.read("word/document.xml")
    except (BadZipFile, KeyError) as exc:
        raise ValueError("Invalid DOCX file") from exc

    root = ET.fromstring(xml_content)
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs = []

    for paragraph in root.findall(".//w:p", namespace):
        text_parts = [node.text for node in paragraph.findall(".//w:t", namespace) if node.text]
        if text_parts:
            paragraphs.append("".join(text_parts))

    return "\n".join(paragraphs)


def _read_uploaded_text(file_storage):
    if not file_storage or not file_storage.filename:
        return ""

    extension = os.path.splitext(file_storage.filename)[1].lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise ValueError("Unsupported file type. Upload .txt or .docx only.")

    file_bytes = file_storage.read()
    file_storage.stream.seek(0)

    if extension == ".txt":
        return file_bytes.decode("utf-8-sig", errors="ignore")
    if extension == ".docx":
        return _extract_docx_text(file_bytes)
    return ""


def _split_input_strings(raw_content):
    parts = re.split(r"[\r\n,]+", raw_content or "")
    cleaned = []
    for part in parts:
        normalized = parser.normalize(part)
        if normalized:
            cleaned.append(normalized)
    return cleaned


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/evaluate", methods=["POST"])
def evaluate():
    gold_content = request.form.get("gold_text", "")
    trainee_content = request.form.get("trainee_text", "")
    gold_file = request.files.get("gold_file")
    trainee_file = request.files.get("trainee_file")

    if gold_file and gold_file.filename:
        gold_content = _read_uploaded_text(gold_file)
    if trainee_file and trainee_file.filename:
        trainee_content = _read_uploaded_text(trainee_file)

    if not gold_content or not trainee_content:
        return jsonify({"error": "Missing input data"}), 400

    try:
        gold_list = _split_input_strings(gold_content)
        trainee_list = _split_input_strings(trainee_content)

        result = evaluator.evaluate_match(
            gold_list,
            trainee_list,
            time_tolerance=TIME_TOLERANCE_MS,
        )
        return jsonify(result)
    except Exception as exc:
        print(f"Server Error: {exc}")
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True)

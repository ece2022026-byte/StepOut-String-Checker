from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge
from werkzeug.utils import secure_filename

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
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_REQUEST_BYTES = 5 * 1024 * 1024
MAX_TEXT_INPUT_CHARS = 2_000_000
MAX_PARSED_STRINGS = 20_000
app.config["MAX_CONTENT_LENGTH"] = MAX_REQUEST_BYTES


class APIError(Exception):
    def __init__(self, message, status_code=400, details=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def _json_error(message, status_code, details=None):
    payload = {"error": message, "status": status_code}
    if details:
        payload["details"] = details
    return jsonify(payload), status_code


def _is_api_request():
    return request.path.startswith("/evaluate")


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

    safe_name = secure_filename(file_storage.filename or "")
    if not safe_name:
        raise APIError("Invalid upload filename.", 400)

    extension = os.path.splitext(safe_name)[1].lower()
    if extension not in ALLOWED_UPLOAD_EXTENSIONS:
        raise APIError("Unsupported file type. Upload .txt or .docx only.", 415)

    file_bytes = file_storage.read(MAX_UPLOAD_BYTES + 1)
    file_storage.stream.seek(0)
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise APIError(
            f"{safe_name} exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB upload limit.",
            413,
        )

    if extension == ".txt":
        return file_bytes.decode("utf-8-sig", errors="ignore")
    if extension == ".docx":
        try:
            return _extract_docx_text(file_bytes)
        except ValueError as exc:
            raise APIError(str(exc), 400) from exc
    return ""


def _split_input_strings(raw_content):
    parts = re.split(r"[\r\n,]+", raw_content or "")
    cleaned = []
    for part in parts:
        normalized = parser.normalize(part)
        if normalized:
            cleaned.append(normalized)
    return cleaned


def _validate_text_payload(raw_content, field_name):
    if raw_content and len(raw_content) > MAX_TEXT_INPUT_CHARS:
        raise APIError(
            f"{field_name} is too large. Keep each input under {MAX_TEXT_INPUT_CHARS:,} characters.",
            413,
        )


def _validate_string_list(items, field_name):
    if not items:
        raise APIError(f"{field_name} did not contain any valid strings.", 422)
    if len(items) > MAX_PARSED_STRINGS:
        raise APIError(
            f"{field_name} contains too many strings. Limit is {MAX_PARSED_STRINGS:,}.",
            413,
        )


@app.errorhandler(APIError)
def handle_api_error(error):
    return _json_error(error.message, error.status_code, error.details)


@app.errorhandler(RequestEntityTooLarge)
def handle_request_entity_too_large(error):
    if _is_api_request():
        return _json_error(
            f"Request too large. Combined uploads and form data must stay under {MAX_REQUEST_BYTES // (1024 * 1024)} MB.",
            413,
        )
    return error


@app.errorhandler(HTTPException)
def handle_http_exception(error):
    if _is_api_request():
        return _json_error(error.description, error.code or 500)
    return error


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if _is_api_request():
        app.logger.exception("Unhandled API error")
        return _json_error("Internal server error", 500)
    app.logger.exception("Unhandled application error")
    return ("Internal server error", 500)


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
        raise APIError("Both gold and trainee inputs are required.", 400)

    _validate_text_payload(gold_content, "Gold input")
    _validate_text_payload(trainee_content, "Trainee input")

    gold_list = _split_input_strings(gold_content)
    trainee_list = _split_input_strings(trainee_content)
    _validate_string_list(gold_list, "Gold input")
    _validate_string_list(trainee_list, "Trainee input")

    result = evaluator.evaluate_match(
        gold_list,
        trainee_list,
        time_tolerance=TIME_TOLERANCE_MS,
    )
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)

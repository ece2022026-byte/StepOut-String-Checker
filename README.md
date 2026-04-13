# StepOut String Checker

StepOut String Checker is a Flask-based analyst evaluation app for comparing gold strings and trainee strings, generating insights, and storing trainee progress history.

## Local Run

1. Create and activate a virtual environment.
2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Start the app:

```powershell
python app.py
```

The app runs on `http://127.0.0.1:8000`.

## Render Deployment

This repo includes a `render.yaml` blueprint so Render can provision both:

- a Python web service
- a managed PostgreSQL database

### Deploy Steps

1. Push the latest code to GitHub.
2. In Render, choose **New +** -> **Blueprint**.
3. Connect this GitHub repository.
4. Render will detect `render.yaml` and create:
   - `stepout-string-checker`
   - `stepout-string-checker-db`
5. Approve the blueprint and deploy.

### Important Notes

- The web service starts with:

```bash
gunicorn app:app
```

- Health checks use:

```text
/healthz
```

- `DATABASE_URL` is injected automatically from the managed PostgreSQL database.

## Project Structure

```text
backend/
  app.py
  comparator.py
  database.py
  evaluator.py
  parser.py

frontend/
  templates/
    index.html
  static/
    app.js
    style.css
    js/
```

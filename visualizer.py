import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64


def generate_error_chart(field_errors):
    """Generates a bar chart showing which fields have the most errors."""
    if not field_errors:
        return None

    plt.figure(figsize=(10, 5))
    plt.bar(list(field_errors.keys()), list(field_errors.values()), color='#ff4d4d')
    plt.title('Errors by Field Type')
    plt.xticks(rotation=45)
    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode('utf8')


def generate_pie_chart(correct, missed, extra, mismatch):
    """Generates a pie chart for overall performance."""
    labels = ['Correct', 'Missed', 'Extra', 'Mismatch']
    sizes = [correct, missed, extra, mismatch]
    colors = ['#4CAF50', '#FF9800', '#2196F3', '#F44336']

    plt.figure(figsize=(6, 6))
    plt.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=140, colors=colors)
    plt.title('Performance Distribution')

    buf = io.BytesIO()
    plt.savefig(buf, format='png')
    buf.seek(0)
    return base64.b64encode(buf.getvalue()).decode('utf8')


def generate_timeline_chart(mismatched_details):
    """Returns 5-minute timeline buckets as data for the frontend charts."""
    if not mismatched_details:
        return {"labels": [], "values": []}

    error_minutes = []
    for detail in mismatched_details:
        try:
            # StepOut format expected at index 6: H:MM:SS (e.g., 0:08:26)
            ts_parts = detail['gold'].split('-')[6].split(':')
            if len(ts_parts) < 2:
                continue
            total_min = int(ts_parts[0]) * 60 + int(ts_parts[1])
            error_minutes.append(total_min)
        except (KeyError, IndexError, ValueError, AttributeError):
            continue

    if not error_minutes:
        return {"labels": [], "values": []}

    max_time = max(max(error_minutes) + 5, 95)
    bins = list(range(0, max_time + 5, 5))

    values = []
    labels = []
    for i in range(len(bins) - 1):
        start = bins[i]
        end = bins[i + 1]
        count = sum(1 for minute in error_minutes if start <= minute < end)
        values.append(count)
        labels.append(f"{start}-{end}")

    return {
        "labels": labels,
        "values": values
    }

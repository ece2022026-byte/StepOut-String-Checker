from .parser import parse_string, validate_rulebook


def convert_time_to_milliseconds(t: str) -> int:
    try:
        parts = list(map(int, t.split(":")))
        if len(parts) == 3:
            h, m, s = parts
            return h * 3600000 + m * 60000 + s * 1000
        return -1
    except Exception:
        return -1


def compare_timestamp(t1: str, t2: str, tolerance: int = 2000) -> bool:
    ms1 = convert_time_to_milliseconds(t1)
    ms2 = convert_time_to_milliseconds(t2)
    if ms1 == -1 or ms2 == -1:
        return False
    return abs(ms1 - ms2) <= tolerance


def _requires_strict_grid_check(main: dict, trainee: dict) -> bool:
    """
    Grid mismatch should be a hard error only when CN/GK is involved
    as action or special_action in either string.
    """
    strict_tokens = {"CN", "GK"}
    values = {
        main.get("action"),
        main.get("special_action"),
        trainee.get("action"),
        trainee.get("special_action"),
    }
    return any(v in strict_tokens for v in values)


def _should_ignore_foot_mismatch(main: dict, trainee: dict) -> bool:
    """
    Relax foot comparison only for a normal SP-1 event.

    This keeps the pair fully matched when both strings represent
    SP-1 with no special action, even if the foot differs.
    Special-action variants must still keep the foot mismatch error.
    """
    return (
        str(main.get("action", "")).upper() == "SP"
        and str(trainee.get("action", "")).upper() == "SP"
        and str(main.get("attribute", "")) == "1"
        and str(trainee.get("attribute", "")) == "1"
        and str(main.get("special_action", "")).upper() == "X"
        and str(trainee.get("special_action", "")).upper() == "X"
    )


def compare_strings(main_string: str, trainee_string: str, time_tolerance: int = 2000):
    try:
        main = parse_string(main_string)
    except Exception as exc:
        return 0.0, {"rule_main_format": {"expected": "valid 12-part action string", "predicted": str(exc)}}, {}

    try:
        trainee = parse_string(trainee_string)
    except Exception as exc:
        return 0.0, {"rule_trainee_format": {"expected": "valid 12-part action string", "predicted": str(exc)}}, {}

    matched = 0
    total = len(main)
    errors = {}
    warnings = {}
    strict_grid_check = _requires_strict_grid_check(main, trainee)

    # 1) Compare half first (strict)
    if main.get("half_notation") == trainee.get("half_notation"):
        matched += 1
    else:
        errors["half_notation"] = {
            "expected": main.get("half_notation"),
            "predicted": trainee.get("half_notation"),
        }

    # 2) Compare timestamp second (with tolerance)
    main_ts = main.get("timestamp")
    trainee_ts = trainee.get("timestamp")
    if compare_timestamp(main_ts, trainee_ts, time_tolerance):
        matched += 1
        ms1 = convert_time_to_milliseconds(main_ts)
        ms2 = convert_time_to_milliseconds(trainee_ts)
        if ms1 != -1 and ms2 != -1 and ms1 != ms2:
            warnings["timestamp_within_tolerance"] = {
                "expected": main_ts,
                "predicted": trainee_ts,
                "drift_ms": abs(ms1 - ms2),
            }
    else:
        errors["timestamp"] = {
            "expected": main_ts,
            "predicted": trainee_ts,
        }

    # 3) Compare remaining fields
    # Z-axis fields are intentionally ignored for now.
    skip_keys = {"half_notation", "timestamp", "z_axis_1", "z_axis_2"}
    grid_keys = {"starting_grid", "end_grid"}
    ignore_foot_mismatch = _should_ignore_foot_mismatch(main, trainee)
    for key in main:
        if key in skip_keys:
            continue
        if main[key] == trainee.get(key):
            matched += 1
        else:
            if key == "foot" and ignore_foot_mismatch:
                matched += 1
                continue
            if key in grid_keys and not strict_grid_check:
                matched += 1
                warnings[f"{key}_deviation"] = {
                    "expected": main[key],
                    "predicted": trainee.get(key),
                    "reason": "grid mismatch ignored unless CN/GK is involved",
                }
            else:
                errors[key] = {"expected": main[key], "predicted": trainee.get(key)}

    # Rulebook validation on trainee action. Rule violations are shown as rule_* fields.
    rule_errors = validate_rulebook(trainee)
    if strict_grid_check:
        errors.update(rule_errors)
    else:
        for field, detail in rule_errors.items():
            if field in {"rule_starting_grid", "rule_end_grid"}:
                warnings[f"{field}_ignored"] = {
                    "expected": detail.get("expected"),
                    "predicted": detail.get("predicted"),
                    "reason": "grid rule ignored unless CN/GK is involved",
                }
            else:
                errors[field] = detail

    accuracy = (matched / total) * 100 if total else 0.0
    return round(accuracy, 2), errors, warnings
